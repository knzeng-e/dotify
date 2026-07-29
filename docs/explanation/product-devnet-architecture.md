# Product DevNet Architecture

## Decision

Dotify uses an adaptive dual-host architecture:

- the standalone Netlify app remains a complete public entry point;
- the Product DevNet build publishes the same listener and room experience as
  `dotify-test01.dot`;
- Product-host capabilities are added through explicit adapters;
- a missing or denied host capability never enables a demo secret, hidden
  signer, or weaker access path.

This keeps Dotify's north star intact. A guest can still follow a room link and
hear a host without first adopting wallet infrastructure. An artist's access
policy and protected source remain authoritative regardless of which frontend
host serves the app.

## Why The Host Is An Adapter

The Product environment and Dotify's existing runtime do not expose the same
signing contract.

The Product SDK returns an app-scoped account and a PAPI `PolkadotSigner`.
Dotify's deployed contract writes and content-key requests currently use viem,
EIP-1193, and EIP-191. Treating those signers as interchangeable would either
fail at runtime or create an unverifiable access claim.

The first Product adaptation therefore uses the host account for:

- an explicit, user-initiated Product account connection;
- an SS58 account for display and future Product-native adapters;
- a derived H160 address for local room-name persistence and read-only
  runtime/catalog correlation.

It does not use that account for:

- Classic payments;
- artist runtime creation or release publication;
- protected content-key requests;
- Bulletin artist publication through the existing PAPI v1 integration.

Those actions continue to require the existing passkey or EVM wallet until the
chain and backend adapters described below are delivered.

## Runtime Topology

```text
Standalone browser                    Product host
https://muzinga.netlify.app           https://dotify-test01.dev-dot.li
         |                                      |
         +---------------+----------------------+
                         |
                 same Dotify frontend
                         |
             +-----------+-----------+
             |                       |
   dotify-api.fly.dev       dotify-signal.fly.dev
   catalog, uploads,        room discovery, SDP/ICE,
   access, content keys     chat and presence
             |                       |
             +-----------+-----------+
                         |
             Product DevNet Asset Hub
             existing Dotify runtimes
```

The Product build is a normal relative-path Vite bundle. `pad` publishes its
files to Bulletin and binds the result to DotNS. Keeping multiple static chunks
allows incremental uploads; the older single-file Bulletin build remains
available for its original workflow.

The two frontend origins share the same Fly services. `API_ORIGINS` and
`SIGNAL_ORIGINS` are explicit comma-separated allowlists. This is required for
cross-origin catalog reads, key requests, Socket.IO, and WebRTC signaling.

## Capability Matrix

| Capability | Standalone | Product build now | Product-native target |
| --- | --- | --- | --- |
| Browse catalog | Fly cache + EVM RPC | Same | Host-routed read adapter where it improves reliability |
| Play Free track | No wallet | No wallet | Same |
| Join room link | No wallet | No wallet | Same |
| Host room | Socket.IO + WebRTC | Same | Keep until a multiparty replacement proves equivalent UX |
| Product identity | Not applicable | App-scoped SS58/H160 | Host identity with explicit capability grants |
| Classic payment | Passkey/EVM wallet | Passkey/EVM wallet | CDM/PAPI write adapter |
| Protected key request | EIP-191 or session token | `product-sr25519-v1` when a Product account is connected; EIP-191 or session token otherwise | Frontend-host signed Product key/session requests, with captured host signing evidence |
| Artist publication | viem/EVM | viem/EVM | Generated CDM contract adapter |
| Personhood | Current on-chain policy source | No new claim | Privacy-preserving Product proof after verification |
| Static delivery | Netlify | Bulletin + DotNS | Bulletin + DotNS |

## Rooms Stay Host-Neutral

Rooms are a product primitive, not a deployment detail. The current signaling
service supports anonymous discovery, one host with multiple listeners,
short-lived chat/reactions/requests, and WebRTC negotiation. Product messaging
and Statement Store do not currently provide a verified drop-in replacement
for that wallet-free multiparty flow.

The Product build therefore keeps the Socket.IO/WebRTC room layer. It adds one
important boundary: `VITE_PUBLIC_APP_URL` makes every copied room link point to
the public `.dev-dot.li` origin rather than an internal container or content
gateway URL.

A future Product-native presence spike may mirror a compact host-signed
heartbeat into Statement Store. It must not carry SDP, ICE candidates, audio,
durable chat, or source keys, and it must remain optional for guests.

## Storage Boundaries

Product static hosting replaces the web server for the Product build. It does
not replace:

- Pinata-backed artist uploads;
- DAV2 audio encryption;
- backend-held `CONTENT_KEY_MASTER_SECRET`;
- server-side access verification;
- the durable catalog snapshot.

Product cloud storage is host-scoped and experimental. Moving encrypted media
or key custody there requires a separate threat model, Range/startup evidence,
and a recovery plan. Until then, Fly remains the security boundary and IPFS
gateways remain the delivery boundary.

## Runtime Port

The contract integration is split into two typed ports rather than Product
conditionals throughout feature hooks:

```text
RuntimeReadPort
  resolveArtistRuntime()
  listArtistRuntimes()
  listRuntimeTracks()
  canAccess()
  hasPaid()
  listRoyaltyPaymentLogs()

RuntimeWritePort
  createRuntime()
  installRuntimeStep()
  registerTrack()
  setAccessMode()
  setReleaseActive()
  payForAccess()
```

Adapters:

- `ViemRuntimeAdapter`: current standalone EVM implementation behind the typed
  ports;
- `ProductCdmRuntimeAdapter`: CDM/PAPI implementation behind the same ports,
  now backed by a real contract resolver (`productCdmContracts.ts`) over a
  generated snapshot manifest. It remains opt-in behind
  `VITE_DOTIFY_RUNTIME_ADAPTER=product-cdm` until host transaction evidence
  exists;
- `CatalogApiAdapter`: the existing server-side read model, shared by both
  frontends.

The CDM adapter has one deliberate gap: royalty payment history is not read
through Product contract handles because the current SDK surface exposes
method queries and transactions, not the viem-style historical log query used
by the artist console. Product mode must use the backend catalog/read-model
indexer, or a future Product event/indexer API, for that history.

### The CDM Manifest Is Generated, Not Installed

Dotify has no CDM-registered packages, and `cdm install` is not available. It
also does not need them. Dotify's Solidity contracts are deployed through Asset
Hub's `eth-rpc`, which is a compatibility layer over `pallet-revive` - the same
pallet the Product SDK contract helpers target. The deployed H160 addresses are
therefore already reachable through `@parity/product-sdk-contracts` with no
PolkaVM recompilation and no registry entry.

`CdmJsonContract` needs only `version`, `address`, and `abi` for
`getContract()`, and `new ContractManager(...)` is documented as snapshot-only.
`web/scripts/generate-cdm-manifest.mjs` emits exactly that snapshot from the
same Hardhat artifacts the viem bindings come from, so the two adapters cannot
disagree about an ABI:

| Output | Contents |
| --- | --- |
| `cdm.json` | `@dotify/artist-directory` and `@dotify/artist-runtime-factory` with their `deployments.json` addresses |
| `smartRuntime.ts` | merged artist-runtime diamond facet ABI, bound to a per-artist address at call time |
| `cdm.d.ts` | `Contracts` module augmentation for typed `getContract()` handles |

Artist runtimes are deliberately absent from the manifest: a diamond is
deployed per artist, so its address is known at call time, not build time.
Inventing a placeholder address would misrepresent the deployment.
`productCdmContracts.ts` resolves those through `createContract`, which needs no
manifest entry.

### Two Constraints On Product Contract Mode

**It only runs inside a Product host.** `createChainClient`/`getChainAPI` route
exclusively through the host provider and throw when none is present - there is
no direct-WebSocket fallback. Product CDM mode is therefore impossible in the
standalone build, and `validateProductionEnvironment` rejects
`VITE_DOTIFY_RUNTIME_ADAPTER=product-cdm` unless `VITE_DOTIFY_HOST_MODE` is
enabled.

**The host decides which chain an environment resolves to.** Dotify's runtimes
are deployed on Polkadot Hub TestNet (EVM chain `420420417`), which the Product
chain client reaches through its `paseo` preset - *not* `devnet`. If the host
connects an environment that does not hold them, every manifest address
resolves to an account with no code, which would look like a catalog of artists
with no releases. `verifyDeployment()` queries `artistCount` on the directory
and fails closed with a named error instead.

**Selection is build-time, and reads only.** `VITE_DOTIFY_RUNTIME_ADAPTER` is
inlined by Vite, so a `viem` build tree-shakes the entire Product contract graph
away - 4.4 MB output versus 10 MB when opted in. The difference is
`@parity/product-sdk-descriptors`, whose shared descriptors module references
every chain's metadata; only one chunk is ever fetched, but all are published,
and Bulletin storage is a finite quota. Contract *writes* stay on the viem
signer path in every mode, since routing a payment or a publication through an
unproven signer is not a reasonable default.

This is the real remaining gate for Product contract writes: not UI rewiring,
and no longer missing manifest or types, but confirming the Product host serves
a chain that holds Dotify's runtimes, plus `pallet-revive` account mapping and
real host-signed transaction smoke evidence. Until that evidence exists,
`VITE_DOTIFY_RUNTIME_ADAPTER` defaults to `viem`.

The backend authentication protocol now has an explicit signature scheme field.
Standalone clients use the default `eip191` scheme. Product-host clients can
use `product-sr25519-v1` after signing the same canonical Dotify message bytes
with the app-scoped Product account; the server binds the signature to the
Product public key, derived H160 requester, chain, nonce, purpose, and expiry
before consuming the nonce or running access checks. Unknown schemes fail
closed. The Product frontend now sends this proof shape after explicit
Product-host account connection; real Host smoke evidence is still required
for each Product publication before gated listening is treated as
production-ready.

### Host Signing Envelope

The SDK does not pin the `signRaw` wire format. `HostSignPayloadResponse`
carries an untagged signature, and a Substrate host may sign a raw payload
verbatim or inside the conventional `<Bytes>...</Bytes>` envelope. Guessing one
shape would make every Product key request fail on a wrong guess, and the
failure would be indistinguishable from a wrong signer.

Verification therefore accepts a bounded set:

- the canonical message verbatim, or wrapped in `<Bytes>`;
- a bare 64-byte sr25519 signature, or a 65-byte value carrying the
  MultiSignature sr25519 tag `0x01`.

This is not a weakening. Every accepted variant carries the identical
domain-bound message, so no new replay, cross-app, cross-chain, or cross-track
surface is created; an ed25519 or ECDSA tag is still rejected. A request whose
key parses and derives to the requester but verifies under no variant returns
`PRODUCT_SIGNATURE_REJECTED`, kept distinct from `SIGNATURE_INVALID` so
operators can separate an envelope problem from a wrong-account problem.

`product-sr25519-v1` additionally rejects EVM-derived account ids - a 20-byte
H160 padded with `0xee`. Such a value derives straight back to the H160 it
contains, so accepting it would let a caller name any paying EVM listener as
the requester and rest the whole boundary on the curve check alone. A real
Product account is a native `AccountId32`, so that shape is refused outright.

Once live host evidence records which envelope the host actually produces, the
accepted set can be narrowed to it.

This avoids a second frontend business model and allows Product mode to replace
one infrastructure adapter at a time.

## Permission And Failure Rules

1. Host detection may run on startup; account access only runs after the user
   chooses **Use Polkadot app**.
2. The integration does not request a username, identity proof, transaction
   permission, or personhood proof before value is visible.
3. If the host is absent, catalog browsing, Free playback, and room links still
   work. The wallet modal explains why the Product account is unavailable.
4. A Product account without an EVM signing adapter can request protected keys
   only through `product-sr25519-v1`; contract writes still require a
   passkey/EVM signer until Product CDM transaction evidence lands.
5. A denied key, RPC failure, or unsupported signature never falls back to a
   browser content secret.
6. The Product SDK and deploy tooling are prototype/reference dependencies.
   Version changes require the compatibility checks below.

## Compatibility Gate

The initial baseline is:

| Component | Pinned/target value |
| --- | --- |
| Node | 22 |
| `@parity/product-sdk` | `0.19.1` |
| `@polkadot-community-foundation/polkadot-app-deploy` | `0.13.1` in the deploy command |
| Product network | `devnet` |
| Product domain | `dotify-test01.dot` |
| Public gateway | `https://dotify-test01.dev-dot.li` |
| Asset Hub EVM chain ID | `420420417` |

For every SDK or deploy-tool upgrade:

1. verify host detection outside and inside the container;
2. connect the Product account only on explicit action;
3. verify SS58 and derived H160 stability;
4. run normal and Product builds;
5. join one room across Netlify and Product origins;
6. verify Free playback remains walletless;
7. verify protected actions still fail closed without a supported signer;
8. inspect the static bundle and npm audit delta;
9. update this document, the environment reference, and the deployment runbook.

## Source References

- [Product documentation](https://docs.polkadotcommunity.foundation/)
- [Build and publish guide](https://docs.polkadotcommunity.foundation/guides/build-and-publish/)
- [Deploy and register contracts with CDM](https://docs.polkadotcommunity.foundation/guides/deploy-contracts-cdm/)
- [Smart contracts and CDM](https://docs.polkadotcommunity.foundation/architecture/contracts/)
- [Platform Services SDK guide](https://docs.polkadotcommunity.foundation/guides/platform-services-sdk/)
- [Product network reference](https://docs.polkadotcommunity.foundation/reference/networks/)
- [Product identity architecture](https://docs.polkadotcommunity.foundation/architecture/identity/)
- [Product messaging architecture](https://docs.polkadotcommunity.foundation/architecture/messaging/)
