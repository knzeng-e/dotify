# Product DevNet Architecture

## Decision

Dotify uses an adaptive dual-host architecture:

- the standalone Netlify app remains a complete public entry point;
- the Product DevNet build publishes the same catalog and link-first room
  experience as `dotify-test01.dot` where host capabilities allow it;
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
- a derived H160 address for local room-name persistence, protected key requests,
  and Product-native runtime write candidates.

The tracked Product deployment does not yet use that account for:

- Classic payments;
- artist runtime creation or release publication;
- Bulletin artist publication through the existing PAPI v1 integration.

Classic payments and artist runtime writes now go through `RuntimeWritePort`,
so a Product CDM build can submit them through the generated contract adapter.
The tracked Product deployment still keeps `VITE_DOTIFY_RUNTIME_ADAPTER`
unset/`viem`, so those actions continue to require the existing passkey or EVM
wallet until host-signed transaction evidence is captured.

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

The standalone frontend and observed Product host origins share the same Fly
services. `API_ORIGINS` and `SIGNAL_ORIGINS` are explicit comma-separated
allowlists. This is required for cross-origin catalog reads, key requests,
Socket.IO, and WebRTC signaling.

## Capability Matrix

| Capability            | Standalone                                    | Product build now                                                                                                                     | Product-native target                                                                  |
| --------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Browse catalog        | Fly cache + EVM RPC                           | Same                                                                                                                                  | Host-routed read adapter where it improves reliability                                 |
| Play Free track       | No wallet                                     | No wallet                                                                                                                             | Same                                                                                   |
| Join room link        | No wallet                                     | No wallet                                                                                                                             | Same                                                                                   |
| Host room             | Socket.IO + WebRTC                            | Product Desktop/web host: same. Product Mobile iOS: external-browser continuation until the host exposes Product WebRTC.              | Keep until a multiparty replacement proves equivalent UX                               |
| Product identity      | Not applicable                                | App-scoped SS58/H160                                                                                                                  | Host identity with explicit capability grants                                          |
| Classic payment       | Native runtime payment intent through `RuntimeWritePort`; the asset label is derived from the connected EVM `chainId` (`PAS` on Product DevNet/Paseo, `DOT` on a DOT-backed Polkadot Hub EVM chain) | Passkey/EVM wallet in the tracked build; Product CDM writer only when `VITE_DOTIFY_RUNTIME_ADAPTER=product-cdm` is explicitly enabled | CASH settlement after the Product payment rail is designed                             |
| Protected key request | EIP-191 or session token                      | `product-sr25519-v1` when a Product account is connected; EIP-191 or session token otherwise                                          | Frontend-host signed Product key/session requests, with captured host signing evidence |
| Artist publication    | viem/EVM                                      | viem/EVM                                                                                                                              | Generated CDM contract adapter                                                         |
| Personhood            | Current on-chain policy source                | No new claim                                                                                                                          | Privacy-preserving Product proof after verification                                    |
| Static delivery       | Netlify                                       | Bulletin + DotNS                                                                                                                      | Bulletin + DotNS                                                                       |

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

There is one current mobile exception. The iOS Product container removes
`window.RTCPeerConnection` from Product scripts, so Dotify cannot create a
browser WebRTC peer inside that sandbox even after requesting the `WebRtc`
permission. Executable `[0, 1, 11]` and later detect that pre-ICE boundary and
open the same canonical HTTPS room URL in the external browser instead. Native
in-app room audio now depends on a Product Mobile host capability such as a
permission-gated peer connection API or media bridge; the upstream clarification
request is tracked in
[Polkadot-Community-Foundation/dotli-community#27](https://github.com/Polkadot-Community-Foundation/dotli-community/issues/27).

### Room Beacons

That presence spike is now implemented, and ships dormant. A host inside the
Product container can publish a compact beacon to the Statement Store so a room
is discoverable without Dotify's signaling server. It carries the room code,
host name, and an aggregate listener count - never SDP, ICE, audio, chat,
listener identities, or source keys. Now-playing is opt-in per host, because a
beacon is globally readable and outlives the room by up to the statement TTL.

Joining deliberately does not move here, and cannot. A WebRTC offer is 1.5-4 KB
against a 512-byte statement ceiling and a 1024-byte per-account total, so a
peer cannot hold even one. More decisively, a guest would have to publish an
answer to complete the handshake, which requires an identity and an allowance -
turning every listener into a registered person. Only the host publishes,
because the host is already identified.

Beacons are per-room channels for last-write-wins, so one hosted room occupies
exactly one live statement no matter how often it refreshes. Host mode signs
through the product's allowance account on the RFC-10 sponsored path, so
hosting does not require the host to hold an Individuality allowance.

`VITE_DOTIFY_ROOM_BEACONS` is `off` in the tracked Product profile: nothing
reads beacons yet, so publishing room records would be exposure with no
consumer, and the publish path has no live host evidence. See the deployment
runbook for the opt-in build and the evidence procedure.

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
  payForAccess(nativeRuntimeIntent)
```

Adapters:

- `ViemRuntimeAdapter`: current standalone EVM implementation behind the typed
  ports;
- `ProductCdmRuntimeAdapter`: CDM/PAPI implementation behind the same ports,
  now backed by a real contract resolver (`productCdmContracts.ts`) over a
  generated snapshot manifest. It remains opt-in behind
  `VITE_DOTIFY_RUNTIME_ADAPTER=product-cdm` until host transaction evidence
  exists. Classic unlock payments already call the same `RuntimeWritePort`, so
  this flag changes the signer/transport seam without touching listener UI;
- `CatalogApiAdapter`: the existing server-side read model, shared by both
  frontends.

Classic unlock no longer passes a loose `(runtimeAddress, contentHash, value)`
triple into runtime writers. The catalog hook creates a typed native runtime
payment intent first: asset symbol derived from the configured EVM chain
(`PAS` on the current Product DevNet/Paseo Asset Hub chain, `DOT` on a
DOT-backed Polkadot Hub EVM chain), rail
`runtime-native`, runtime address, content hash, and 18-decimal native amount.
The amount comes from the runtime or catalog API `pricePlanck` value when
available; `priceDot` is only the rounded display string. The viem and Product
CDM adapters both submit that same intent as `musicRoyPayAccess(contentHash)`
plus `msg.value`.

CASH is represented separately as an unsupported `product-cash` rail. That is
intentional. CASH lives on People chain while Dotify entitlements live in Asset
Hub runtimes, so the Product-native path needs an explicit receipt or bridge
model before any listener payment can execute. Dotify must not silently convert
CASH to native runtime value or mark access paid without runtime evidence.

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

| Output            | Contents                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| `cdm.json`        | `@dotify/artist-directory` and `@dotify/artist-runtime-factory` with their `deployments.json` addresses |
| `smartRuntime.ts` | merged artist-runtime diamond facet ABI, bound to a per-artist address at call time                     |
| `cdm.d.ts`        | `Contracts` module augmentation for typed `getContract()` handles                                       |

Artist runtimes are deliberately absent from the manifest: a diamond is
deployed per artist, so its address is known at call time, not build time.
Inventing a placeholder address would misrepresent the deployment.
`productCdmContracts.ts` resolves those through `createContract`, which needs no
manifest entry.

### Registering `@dotify/*` Without Redeploying

`cdm deploy` builds, deploys, publishes metadata, and registers in one pass.
Dotify cannot use it: the contracts are already deployed and already hold the
live catalog, so deploying again would mint new addresses and orphan every
existing artist runtime.

The registry contract itself provides the operation that is actually needed.
`publishLatest(contract_name, contract_address, metadata_uri)` binds a name to
an arbitrary address, and the contract's own comment states the rule: "The
caller only has permission to publish a new version of `contract_name` if
either the name is available or they are already the owner of the name." So a
free name is claimable by anyone, and afterwards only by its owner.
`metadata_uri` is stored verbatim and never validated - it is a pointer, not a
checked reference.

`npm run cdm:publish:testnet` (task `cdm:publish`) performs that registration
for the addresses in `deployments.json`. It is read-only by default: it prints
the plan and the exact calldata, and stops. Registration is first-writer-owns
and the registry exposes no release or transfer entry point, so a claimed name
is permanent - execution therefore requires `--confirm` and an explicit key.

The task refuses to proceed when a target address has no bytecode on the
connected chain, or when a name is already owned by another account. Publishing
a name that points at nothing would be worse than not publishing it.

| Registry        | Address                                      | Network                                     |
| --------------- | -------------------------------------------- | ------------------------------------------- |
| `devnet` preset | `0x59b0245778917af55224e5f8fb55f7f8d452619f` | Paseo Asset Hub, para 1000, chain 420420417 |

CDM's own documentation confirms the preset distinction that
`VITE_DOTIFY_PRODUCT_CHAIN` encodes: "the `paseo` preset targets **paseo-next**
... para 1500 - not the Paseo testnet. The `devnet` preset targets the Paseo
testnet Asset Hub (para 1000, EVM chain id 420420417)." Publishing against the
`paseo` registry would register Dotify's names on a network where its contracts
do not exist.

Note also that CDM does support Solidity, through a `/// @custom:cdm @org/name`
NatSpec tag and first-pass Hardhat and Foundry templates. The architecture page
mentions only PolkaVM bytecode, so this is easy to miss - it means Dotify's
existing toolchain is not an obstacle to CDM participation.

### Why `cdm deploy` Cannot Be Used, Even With A Fresh Redeploy

The obvious objection to the task above is that a redeploy would avoid all of
it. Dotify's on-chain data is test data, so that was worth checking properly
rather than assuming. It does not work, and the reason is a hard chain limit
rather than a preference.

CDM's Solidity path compiles with `resolc` to PolkaVM, not with `solc` to EVM
bytecode. `resolc` compiles Dotify's contracts successfully - all 24 files,
including the diamond's `delegatecall` fallback and every one of its 17 inline
assembly blocks, with only an informational `extcodesize` warning from
`LibDiamond`. Feasibility is therefore not the blocker.

Size is. The Asset Hub initcode limit is 49,152 bytes, and `resolc` emits
roughly 4-10x more bytecode than `solc` for the same source:

| Contract               | Deployed EVM | resolc PolkaVM | Against the 48 KB limit |
| ---------------------- | ------------ | -------------- | ----------------------- |
| `MusicRegistryPallet`  | 8,855        | 71,252         | **over by 45%**         |
| `SmartRuntime`         | n/a          | 41,142         | under                   |
| `DiamondCutPallet`     | 4,753        | 39,408         | under                   |
| `ArtistRuntimeFactory` | 9,999        | 38,926         | under                   |
| `ArtistDirectory`      | 1,829        | 17,325         | under                   |
| `MusicRightsRegistry`  | not deployed | 88,955         | **over by 81%**         |

`MusicRegistryPallet` is the pallet that holds the catalog, so this is not an
optional component. Clearing the limit would mean splitting it into a
storage-only contract and a logic contract - and the practitioner report that
documents that workaround also records that diamond-style generic mappings were
_ineffective_ at reducing size, which is precisely Dotify's architecture.

So the ordering is: Asset Hub's `pallet-revive` accepts both EVM bytecode
through `eth-rpc` and PolkaVM blobs through `resolc`, and for Dotify the EVM
path is not a legacy compromise - it is the only one that currently fits. The
existing deployment sits comfortably inside the limit on every contract.

`publishLatest` registration is therefore the correct mechanism, not a
workaround for an unwillingness to redeploy. Revisit only if `resolc` output
size improves substantially, or if the registry pallet is split for reasons of
its own.

### Two Constraints On Product Contract Mode

**It only runs inside a Product host.** `createChainClient`/`getChainAPI` route
exclusively through the host provider and throw when none is present - there is
no direct-WebSocket fallback. Product CDM mode is therefore impossible in the
standalone build, and `validateProductionEnvironment` rejects
`VITE_DOTIFY_RUNTIME_ADAPTER=product-cdm` unless `VITE_DOTIFY_HOST_MODE` is
enabled.

**The host decides which chain an environment resolves to**, and only one
environment is correct. See "DevNet Is Not A Separate Chain" below.
`verifyDeployment()` queries `artistCount` on the directory before any catalog
read, so a wrong-chain connection fails closed with a named error instead of
looking like a catalog of artists with no releases.

### DevNet Is Not A Separate Chain

Product DevNet is a _preset_, not a network. It targets the Paseo system
parachains - Asset Hub (1000), People (1004), Bulletin (1010) - with EVM chain
id `420420417` and the `dev-dot.li` web gateway.

That is the chain Dotify is already deployed on. Verified read-only on
2026-07-29 by querying both endpoints for the ArtistDirectory at
`0xcf1534c6e2b0e43b9436c1e86a076466dc0f2108`:

| Endpoint                                         | `eth_chainId` | Block    | Directory bytecode             |
| ------------------------------------------------ | ------------- | -------- | ------------------------------ |
| `https://eth-rpc-testnet.polkadot.io/`           | `0x190f1b41`  | 11546347 | 3660 chars, sha256 `36707b24…` |
| `https://paseo-assethub-rpc.laissez-faire.trade` | `0x190f1b41`  | 11546348 | 3660 chars, sha256 `36707b24…` |

Same chain id, blocks one apart, byte-identical contract code. The two URLs are
different providers for one chain.

**No contract redeploy is required to port Dotify to Product DevNet.** The
addresses in `deployments.json` are already DevNet addresses.

The trap is the SDK's `paseo` preset, which points at the Paseo **Next** v2
deployment (Asset Hub Next 1500 / People Next 1502). The Product documentation
is explicit that those "belong to a different network" and that "funds sent
there will not appear on this Devnet". Dotify has no deployment there, so
`ProductChainEnvironment` admits only `devnet` - a wrong preset is not a
configuration option, it is a bug.

**Selection is build-time, and fail-closed.** `VITE_DOTIFY_RUNTIME_ADAPTER` is
inlined by Vite, so a `viem` build tree-shakes the entire Product contract graph
away - 4.4 MB output versus 10 MB when opted in. The difference is
`@parity/product-sdk-descriptors`, whose shared descriptors module references
every chain's metadata; only one chunk is ever fetched, but all are published,
and Bulletin storage is a finite quota. Runtime _writes_ use the same adapter
selection as reads: `viem` uses the connected EVM/passkey wallet, and
`product-cdm` submits through Product SDK contract handles. The production
default remains `viem`, since routing a payment or a publication through an
unproven signer is not a reasonable default.

The remaining gate for Product contract _writes_ is now narrow. Dotify verifies
the selected host signer public key and derived `pallet-revive` H160 address
against the Product account that the UI and backend use for key/session
requests before any Product CDM write can be submitted. Product CDM Classic
unlocks also poll `musicAccHasPaid` and `musicAccCanAccess` for the same H160
account after inclusion before the UI marks the track open. If the write is
included but the read-back never confirms the grant, the UI reports
**Payment included, access not verified** and keeps the transaction hash
visible as the user's receipt. The remaining evidence must come from inside
the container: native value forwarding for Classic unlock, explicit host
approval UX, and a successful post-payment read-back. The chain question is
settled, the manifest and types exist, and reads/writes share one port. Until
that write evidence exists,
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
   through `product-sr25519-v1`; contract writes use `viem` by default and only
   use Product CDM in an explicit `VITE_DOTIFY_RUNTIME_ADAPTER=product-cdm`
   build after operator validation.
5. A denied key, RPC failure, or unsupported signature never falls back to a
   browser content secret.
6. The Product SDK and deploy tooling are prototype/reference dependencies.
   Version changes require the compatibility checks below.

## Compatibility Gate

The current baseline is:

| Component                                            | Pinned/target value                |
| ---------------------------------------------------- | ---------------------------------- |
| Node                                                 | 22                                 |
| `@parity/product-sdk`                                | `0.23.0`                           |
| `@parity/product-sdk-host`                           | `0.16.0`                           |
| `@parity/product-sdk-statement-store`                | `0.6.5`                            |
| `@parity/product-sdk-descriptors`                    | `0.10.0`                           |
| `polkadot-api`                                      | `1.23.3`                           |
| `@polkadot-community-foundation/polkadot-app-deploy` | `0.13.1` in the deploy command     |
| Product network                                      | `devnet`                           |
| Product domain                                       | `dotify-test01.dot`                |
| Public gateway                                       | `https://dotify-test01.dev-dot.li` |
| Asset Hub EVM chain ID                               | `420420417`                        |

Checked against npm on 2026-08-30: npm now publishes Product SDK `0.25.0`,
host `0.18.0`, statement-store `0.6.7`, and descriptors `0.11.0`. Dotify keeps
the baseline above for this branch and defers that migration to a dedicated SDK
compatibility PR. npm also publishes `polkadot-api` `3.0.0`, but Dotify keeps
root PAPI on `1.23.3` for now. The current pinned Product SDK packages bring
their own PAPI `2.2.x` tree, while `@polkadot-apps` chain-client/keys/signer
still depend on PAPI `1.23.x`. A direct root PAPI 3 trial removed the public
`PolkadotSigner` export and broke `ChainDefinition` / `TypedApi` compatibility
at the Bulletin and wallet seams. Root PAPI 3 therefore remains a blocked
compatibility migration until the upstream SDK graph converges.

For every SDK or deploy-tool upgrade:

1. verify host detection outside and inside the container;
2. connect the Product account only on explicit action;
3. verify SS58 and derived H160 stability;
4. run normal and Product builds;
5. join one room across Netlify and Product Desktop/web origins, then verify
   Product Mobile shows the external-browser continuation when
   `RTCPeerConnection` is unavailable;
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
