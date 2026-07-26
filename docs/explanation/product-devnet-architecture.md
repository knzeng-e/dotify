# Product DevNet Architecture

## Decision

Dotify uses an adaptive dual-host architecture:

- the standalone Netlify app remains a complete public entry point;
- the Product DevNet build publishes the same listener and room experience as
  `dotify.dot`;
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
https://muzinga.netlify.app           https://dotify.dev-dot.li
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
| Protected key request | EIP-191 | EIP-191 | Backend-verified Product signature scheme |
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

## Proposed Contract Port

The next contract phase should split the current integration into two typed
ports rather than add Product conditionals throughout feature hooks:

```text
RuntimeReadPort
  listArtists()
  listReleases()
  getAccessDecision()
  getRoyaltyState()

RuntimeWritePort
  createArtistRuntime()
  publishRelease()
  setAccessMode()
  payForAccess()
```

Adapters:

- `ViemRuntimeAdapter`: current standalone EVM implementation;
- `ProductRuntimeAdapter`: generated CDM/ABI bindings submitted with the host
  PAPI signer;
- `CatalogApiAdapter`: the existing server-side read model, shared by both
  frontends.

The backend authentication protocol must then gain an explicit signature
scheme field. A Product signature is accepted only after the server can bind
the signed payload, Product account public key, derived H160, chain, nonce,
purpose, and expiry. EIP-191 remains supported for standalone clients. Unknown
schemes fail closed.

This avoids a second frontend business model and allows Product mode to replace
one infrastructure adapter at a time.

## Permission And Failure Rules

1. Host detection may run on startup; account access only runs after the user
   chooses **Use Polkadot app**.
2. The integration does not request a username, identity proof, transaction
   permission, or personhood proof before value is visible.
3. If the host is absent, catalog browsing, Free playback, and room links still
   work. The wallet modal explains why the Product account is unavailable.
4. A Product account without an EVM signing adapter is not a protected
   listener. Dotify passes no requester address to the key service.
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
| Product domain | `dotify.dot` |
| Public gateway | `https://dotify.dev-dot.li` |
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
- [Platform Services SDK guide](https://docs.polkadotcommunity.foundation/guides/platform-services-sdk/)
- [Product network reference](https://docs.polkadotcommunity.foundation/reference/networks/)
- [Product identity architecture](https://docs.polkadotcommunity.foundation/architecture/identity/)
- [Product messaging architecture](https://docs.polkadotcommunity.foundation/architecture/messaging/)
