# Deploy Dotify To Product DevNet

This runbook publishes the Product build to Bulletin/DotNS and connects it to
the existing Fly API and signaling services. It does not deploy contracts or
change production secrets.

## Contracts Need No Redeploy

Product DevNet is a preset over the Paseo system parachains - Asset Hub (1000),
People (1004), Bulletin (1010) - at EVM chain `420420417`. Dotify's contracts
are already deployed on that chain, so porting to DevNet is a configuration
change, not a migration. The addresses in `deployments.json` are DevNet
addresses.

Confirm before every publish:

```bash
cd web
npm run smoke:devnet
```

It reads `web/.env.product-devnet` and `deployments.json` and checks, read-only,
that the configured Asset Hub reports chain `420420417`, is producing blocks
past the 2026-07 halt, still serves bytecode for the ArtistDirectory and
ArtistRuntimeFactory, and that the Bulletin RPC and IPFS gateway respond. It
sends no transaction and prints no credential.

Do not point the build at **Asset Hub Next (1500)** or **People Next (1502)**.
The Product documentation is explicit that those belong to a different network;
Dotify has no contracts there, and the catalog would load empty.

## Prerequisites

- Node.js 22 and npm 10+
- a clean build from the intended commit
- access to the `dotify-test01.dot` deployment account
- Fly access for `dotify-api` and `dotify-signal`
- the current `@polkadot-community-foundation/polkadot-app-deploy` DevNet prerequisites

The CLI is reference/experimental tooling. Do not store a mnemonic in the
repository, shell history, `.env` files, Netlify, or Fly.

Before the first publish, the signing account also needs:

- DevNet native tokens on Asset Hub;
- an EVM account mapping (`dotns account map --env devnet`);
- a live Bulletin storage authorization for the same SS58 account;
- ownership of `dotify-test01.dot`, or eligibility to register it during deploy.

`dotify.dot` currently requires full personhood on Product DevNet. Until the
project has that proof level, use `dotify-test01.dot` and
`https://dotify-test01.dev-dot.li` for operator deployments.

Bulletin authorization is a finite quota and may expire. A deploy that starts
failing at the upload stage after previously working should recheck that quota.
See the official
[build and publish guide](https://docs.polkadotcommunity.foundation/guides/build-and-publish/)
for the current faucet, storage console, mapping, and DotNS registration steps.

## 1. Verify The Fly Origin Boundary

The tracked Fly configuration must contain:

```txt
API_ORIGINS=https://muzinga.netlify.app,https://dotify-test01.dev-dot.li,polkadot://app.dotify-test01.dot
SIGNAL_ORIGINS=https://muzinga.netlify.app,https://dotify-test01.dev-dot.li,polkadot://app.dotify-test01.dot
```

Three frontends reach these services: Netlify, the DotNS web gateway, and the
app as served inside the Product host container, which uses a custom scheme.
Both lists must carry all three - a container with only the signaling origin
gets rooms but no content keys, because catalog and key delivery go to the API.

`polkadot:` is a non-special scheme, so its origin is opaque and a browser may
send `Origin: null` rather than the literal value. If a host request is still
refused after this change, read the actual `Origin` header from the Fly log
before widening either list. Never add a bare `null`: that admits every
sandboxed iframe and `file://` page on the web to the authenticated upload and
content-key routes. A regression test in `services/api/src/cors.test.ts` pins
that refusal.

Deploy both services before publishing the frontend. `cd` into each service
first - this is not cosmetic:

```bash
cd services/api
flyctl deploy

cd ../../web
flyctl deploy -c fly.signal.toml
```

`-c` selects the config file only; it does not set the Docker build context,
which is always the shell's working directory. Running
`flyctl deploy -c services/api/fly.toml` from the repository root fails at
`COPY src ./src`, because the Dockerfile is written against `services/api` as
its context and there is no `src/` at the root. It also uploads a ~1.3 GB
context, since Docker reads `.dockerignore` from the context root and only the
service directories have one. Passing the directory positionally
(`flyctl deploy services/api`) works too, because that sets the context.

An earlier cached layer can hide the mistake: `COPY package*.json ./` and
`npm ci` may report `CACHED` from a previous correct build, so the failure
surfaces at the first genuinely uncached step rather than the first wrong one.

Keep backend secrets unchanged. `API_ORIGINS` supersedes singular
`API_ORIGIN`; the latter remains only as a compatibility fallback.

## 2. Verify The Browser-Safe Build Profile

Review `web/.env.product-devnet`. It must contain only public endpoints and
identifiers. In particular:

```txt
VITE_DOTIFY_HOST_MODE=required
VITE_DOTIFY_PRODUCT_ID=dotify-test01.dot
VITE_PUBLIC_APP_URL=https://dotify-test01.dev-dot.li
VITE_DOTIFY_API_URL=https://dotify-api.fly.dev
VITE_SIGNAL_URL=https://dotify-signal.fly.dev
VITE_PINATA_JWT=
VITE_CONTENT_SECRET=
```

`VITE_PUBLIC_APP_URL` is the URL copied for room invitations. Do not replace it
with an internal host URL or a raw CID gateway.

## 3. Build Locally

```bash
cd web
npm ci
npm run test:unit
npm run smoke:devnet
npm run build:product-devnet
```

Expected output is `web/dist-product`. The production guard must fail if a
browser upload token or content secret is present.

The default build keeps the viem runtime adapter, which tree-shakes the Product
contract graph away and publishes at roughly 4.4 MB. Building with
`VITE_DOTIFY_RUNTIME_ADAPTER=product-cdm` pulls in the Product SDK descriptors
and roughly doubles that. Bulletin storage is a finite quota, so only opt in
when the Product contract path is actually being exercised.

## 4. Authenticate The Deploy Tool

The repository pins the CLI version in the npm deploy command but does not add
the experimental deploy tool to the application dependency tree.

```bash
npx --yes --package @polkadot-community-foundation/polkadot-app-deploy@0.13.1 pad login --env devnet
npx --yes --package @polkadot-community-foundation/polkadot-app-deploy@0.13.1 pad whoami --env devnet
```

Follow the mobile-wallet flow. Confirm the selected account owns, or can
receive, `dotify-test01.dot` and satisfies the DevNet registration/funding
rules.

## 5. Publish

```bash
npm run deploy:product-devnet
```

The command:

1. rebuilds `dist-product`;
2. validates `polkadot-app-deploy.config.ts`;
3. creates content-addressed chunks with the JavaScript merkle implementation;
4. uploads changed content to Product DevNet Bulletin;
5. binds `dotify-test01.dot`;
6. writes the Product manifest and executable records.

Publisher listing is deliberately not part of the default deploy. It requires
the current Product proof-of-personhood level and signer support, and the
0.13.1 CLI help still describes environment-specific limitations. After the
app URL is verified, follow the current official **List it in Browse** guide
and record that result separately. A listing failure must not obscure a
successful static deployment.

Record the commit, CLI version, resulting CID, DotNS transaction references,
and final public URL in the release evidence.

## 6. Validate

Check service CORS from both origins:

```bash
curl -s -D - -o /dev/null \
  -H 'Origin: https://dotify-test01.dev-dot.li' \
  https://dotify-api.fly.dev/health

curl -s -D - -o /dev/null \
  -H 'Origin: https://muzinga.netlify.app' \
  https://dotify-api.fly.dev/health
```

Then verify in the Product host:

1. `https://dotify-test01.dev-dot.li` opens and shows catalog tracks.
2. Free playback starts without connecting an account.
3. **Use Polkadot app** connects an app-scoped Product account only after the
   button is selected.
4. A protected track requests its key through the Product identity using
   `product-sr25519-v1`. Record which happened:
   - accepted, and playback starts: capture the request/response pair as the
     Product signing evidence this build needs;
   - denied with `PRODUCT_SIGNATURE_REJECTED`: the key and requester bound
     correctly but the host signing envelope is not one this API accepts.
     Capture the Fly log line and the raw host signature length before
     changing anything;
   - denied with any other code: treat as a normal fail-closed denial.

   In every rejected case, playback must stop and offer a passkey/EVM wallet.
   No path may release a key without a verified signature.
5. A Product-origin host creates a room and copies a
   `https://dotify-test01.dev-dot.li/#/rooms/<code>` link.
6. A wallet-free browser joins that link from outside the Product host.
7. A Netlify-origin host and Product-origin guest also connect.
8. Closing the host ends the room as before.

Inspect the browser console and Fly logs for CORS, catalog, Socket.IO, and
WebRTC failures.

## Rollback

The Product deployment is static. To roll back:

1. switch to the last known-good commit;
2. run `npm ci`;
3. run the full build and smoke checks;
4. republish with `npm run deploy:product-devnet`;
5. confirm DotNS resolves to the restored content;
6. record the replacement CID and incident reason.

Do not roll back Fly origin allowlists while either public frontend remains
active.

## Known Limits

- Product account signing is accepted by the API only through the explicit
  `product-sr25519-v1` session/key-request scheme. The Product UI now submits
  that proof shape after an explicit host-account connection, but each published
  Product build still needs real Host smoke evidence before gated playback is
  considered production-ready on Product DevNet.
- The Host `signRaw` wire format is not pinned by the SDK: the response
  signature is untagged, and a Substrate host may sign the payload verbatim or
  inside a `<Bytes>` envelope. The API accepts both envelopes and both a bare
  64-byte and a MultiSignature-tagged 65-byte sr25519 signature, so a correct
  host signature verifies regardless of which shape it uses. Step 6.4 above
  records which shape the live host actually produced - that observation is the
  evidence, and until it is captured the accepted set stays deliberately wide.
- Contract writes still require passkey/EVM signing in the shipped UI. The
  Product CDM/PAPI runtime adapter now has its generated manifest, contract
  types, and a live resolver, so the only thing still missing before it can be
  selected is `pallet-revive` account mapping plus real host-signed transaction
  evidence.
- Rooms still depend on one in-memory Fly signaling machine.
- Product-host cloud storage does not hold Dotify audio or content keys.
- Product personhood is not yet an access decision source.
- A durable `CATALOG_SNAPSHOT_PATH` remains recommended for production-grade
  catalog recovery but is not required for API startup.
- Product contract mode (`VITE_DOTIFY_RUNTIME_ADAPTER=product-cdm`) covers
  catalog reads only, and only inside the Product host. Contract writes stay on
  the passkey/EVM signer in every mode until `pallet-revive` account mapping and
  host-signed transaction evidence exist.
