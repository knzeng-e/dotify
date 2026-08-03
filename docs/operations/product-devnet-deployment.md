# Deploy Dotify To Product DevNet

This runbook publishes the Product build to Bulletin/DotNS and connects it to
the existing Fly API and signaling services. It does not deploy contracts or
change production secrets.

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
API_ORIGINS=https://muzinga.netlify.app,https://dotify-test01.dev-dot.li
SIGNAL_ORIGINS=https://muzinga.netlify.app,https://dotify-test01.dev-dot.li
```

Deploy both services before publishing the frontend:

```bash
cd services/api
flyctl deploy -c fly.toml

cd ../../web
flyctl deploy -c fly.signal.toml
```

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
npm run build:product-devnet
```

Expected output is `web/dist-product`. The production guard must fail if a
browser upload token or content secret is present.

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
4. A protected track asks for a passkey/EVM wallet; it does not release a key
   through the Product identity.
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

- Product account signing is identity/presence only in this phase.
- Contract writes and key requests still require passkey/EVM signing in the
  shipped UI. The experimental Product CDM/PAPI runtime adapter is present in
  code, but it is not selected until Dotify has CDM-installed runtime packages,
  generated contract types, and real host-signed transaction evidence.
- Rooms still depend on one in-memory Fly signaling machine.
- Product-host cloud storage does not hold Dotify audio or content keys.
- Product personhood is not yet an access decision source.
- A durable `CATALOG_SNAPSHOT_PATH` remains recommended for production-grade
  catalog recovery but is not required for API startup.
