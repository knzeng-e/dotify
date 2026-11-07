# Dotify technical memory

## Explicit player lifetime and Room-to-solo continuity, 2026-11-07

The November 7 candidate removes the local listening checkpoint and retires the actual source/output on player dismissal through useCatalog.clearPlayback. Normal catalog authorization selects a new generation on reopening. An explicitly confirmed host Room exit retains the existing local output/play-pause state while retiring peers; guest/remote closure stops and dismisses. Artist-profile history takes ownership of a departing sheet entry before deferred motion to avoid a cleanup pop race. Catalog focus/scroll restoration remains with the catalog journey controller.
See the [candidate and evidence](../backlog/implementation/evidence/listening-session-continuity-2026-11-07.md). This is not deployed; physical phone close/reopen and native presentation remain acceptance gates.

The follow-up adds a provider-free presentation slot to ListeningSheet and reuses existing playback through ListeningNowPlaying. RoomChat uses a bounded textarea; signaling preserves sanitized newlines only for chat, while requests remain single-line. Limits, membership checks and ephemeral history stay unchanged. Matching signaling rollout is required for end-to-end paragraphs; no service is deployed by the candidate.

## Room lifecycle delivered in 0.1.78, 2026-11-06

[Web and Product 0.1.78](../backlog/implementation/evidence/product-0.1.78-rollout-2026-11-06.md) publish merged #400 from frozen source
`6898863d`. Both CIs and independent Web/CAR/finalized-retention/DotNS readback pass;
the signer is removed. Failed preparation cannot create a silent Room; observed
output interruption pauses at position with visible explicit recovery. Solo and
Room share rounded Dotify petal artwork without tiny room text. The owner confirms
startup without retry and host/guest sound during the requested short phone lock.
Broader lifecycle/recovery and artwork checks remain open in #395/#388.
This bounded application-only operation uses 14 stores / 5,259,623 bytes and
6 immediate renewals / 4,214,282 bytes, one operation per dependency.
Preserve 391 future renewals / 131,511,566 bytes. No automatic renewal, musical
write, API/custody change or service restart. Older checkpoints remain dated facts.

## Full-length Room correction delivered in 0.1.77, 2026-11-06

[Web and Product 0.1.77](../backlog/implementation/evidence/product-0.1.77-rollout-2026-11-06.md) publish merged #399 from frozen source
`0587442d`. CI and independent Web/block/CAR/DotNS checks pass; the local signer
is removed. Complete mobile Room preparation uses at most four authenticated
reads and a complete local AAC index, preserving payloads, access checks,
existing deadlines and the 40 MiB cap; solo remains progressive.
The owner confirms eventual full-length phone-host sound at Web/Desktop guests,
but startup still has delays/errors/retries and locking the phone silences both
host and guests until unlock. Reliable startup, background and lifecycle checks
remain open in #395; the eight-second 0.1.76 result stays separate.
Reserve 371 future renewals / 122,037,661 bytes; no renewal/scheduler is activated.
API/custody, musical assets and policies are unchanged; no service restart occurs.
Older dated checkpoints retain their state at that time.

## Mobile room capture delivered in 0.1.76, 2026-11-05

[Web and Product 0.1.76](../backlog/implementation/evidence/product-0.1.76-rollout-2026-11-05.md) publish merged #397/#398 from frozen source
`e195e3ab`. CI and independent Web/CAR/Bulletin/DotNS checks pass;
the local signer is removed. Managed-only room hosts use authenticated complete
96 kb/s AAC with the existing buffer cap, while solo stays progressive. Room
queue/suggestions/details share listening-sheet motion and access-gate ownership.
The owner confirms foreground mobile-host sound at Web/Desktop guests on the
eight-second release; full-length Room preparation still fails (#395).
Physical lifecycle/background checks (#395) and matching panel acceptance (#396)
remain open. Reserve 351 renewals /
112,567,204 bytes; no renewal or conservation activation occurs.
API/custody source/media/policies are unchanged. An already-stopped custody
instance was restored during preparation after database-lock loss; the code-0
exit/supervisor defect remains a separate reliability follow-up.

## Continuous listening published in 0.1.75, 2026-11-05

[Web and Product 0.1.75](../backlog/implementation/evidence/product-0.1.75-rollout-2026-11-05.md) deliver merged #391/#393 from frozen source
`e095f427`. Exact-source CI and independent Web/block/CAR/DotNS readback
pass; the local signer is removed. Player/Queue motion, title-adjacent room
discovery and room-branded system context are delivered. API/custody, media and
policies are unchanged; no restart or renewal occurs. Reserve
331 renewals / 103,099,297 bytes. Matching
physical #392/#388 acceptance remains open. W33 retains protected denial and
conservation/recovery gates; the merged read-only conservation CLI is not
activated/deployed by this client rollout.

## Listening controls published in 0.1.74, 2026-11-05

[Web and Product 0.1.74](../backlog/implementation/evidence/product-0.1.74-rollout-2026-11-05.md) deliver merged #389 from frozen source `e8d3be90`.
Independent Web/block/CAR/DotNS readback and exact-source CI pass; the signer is
removed. Mobile-player account access, live room release/artist discovery and
corrected system artwork/actions are delivered. API/custody, music, access policy
and the independent lab are unchanged; no renewal or restart occurs. Reserve
311 renewals / 93,634,213 bytes. Physical native #388 acceptance remains open;
W33 retains signed denial, account switching, room-guest silence, conservation
and coherent off-volume recovery. The read-only conservation implementation in
this PR is a separate candidate, not part of the deployed client/API source.

## Conservation assessment candidate, 2026-11-05

[The operator command](../operations/bulletin-conservation.md) keeps conservation
separate from publishing: explicit dependency plan → one finalized metadata
snapshot → per-block/account/quota severity. Supports Product SHA-256 and media
BLAKE2b without loosening media readers; shared CID sizes must agree. Existing
reserve floors are preserved; unknown reads are critical. No signer, automatic
renewal, alert schedule or live activation. Complete inventory, retrievable bytes
and coherent off-volume key/data restoration remain W33/#288 gates.

## Protected account interruption published, 2026-11-05

[Web and Product 0.1.73](../backlog/implementation/evidence/product-0.1.73-rollout-2026-11-05.md) deliver merged #386 from exact tested
source `560e7332`. Disconnect/account/network changes retire the old protected
source and producer; reopening requires explicit normal authorization checks.
Free/profile-only playback is preserved. Independent Web/CAR/DotNS readback passes;
12 app stores / 3,557,988 bytes, eight reuses and two signing requests stay within
the approved cap. The local signer is removed; API/custody, media, admission and
keys are unchanged. The public Free route rejects Classic with NOT_FREE and no
key; this is not a signed unentitled-listener test. The owner confirms sound
stops on disconnect and explicit recovery works on Web, Desktop and mobile.
Account switching, signed denial and room-guest silence remain unverified.
Reserve 291 renewals / 84,178,313 bytes; no renewal is
submitted and earliest reused expiry remains block 1,532,185. W33 stays open for
physical access/interruption, conservation and coherent off-volume recovery.

Next iteration: [#388 listening controls and discovery](../backlog/listening-controls-and-discovery.md) records the
owner's mobile Player disconnect, room track-details and lock-screen artwork/
previous-next requests. The [client implementation candidate](../backlog/implementation/evidence/listening-controls-and-discovery-2026-11-05.md) reuses the existing account sheet,
current room identity and shared playback ownership. Public artwork is resolved
for Media Session and relative-seek actions are cleared. Local automated checks
pass; review, matching delivery and physical lock-screen evidence remain open.
No service/storage policy or deployed version changes.

## Registered Bulletin playback published, 2026-11-04

[Web and Product 0.1.72](../backlog/implementation/evidence/product-0.1.72-rollout-2026-11-04.md) publish merged #385 from exact tested source
`018011d4`. Independent block/CAR/DotNS/Web readback passes; 12 app stores /
3,557,283 bytes, eight reused blocks and two signing requests stay within the
owner-approved cap. The local signer is removed. The fresh eight-second release
is already registered as **Thot Nzeng**, at block 15,321,680 / 1.42 PAS; this
client-only rollout preserves its audio, metadata and access checks. API/custody
remain source `e2dd6148`, with no restart or policy change. The owner confirms hearing all eight seconds on Web, Desktop and mobile.
Next: protected denial/interruption, dependency conservation and coherent
off-volume recovery. W33/#288 remains open.
Older dated checkpoints below describe their state at that time.

## Product 0.1.70 and exact repair admission, 2026-11-03

The [verified rollout](../backlog/implementation/evidence/product-0.1.70-rollout-2026-11-03.md) deploys the required artist-name checks and admits
one exact **Thot Nzeng** metadata repair for the preserved synthetic pilot.
Audio, cover, old metadata, receipts and original allowances remain intact;
no re-encoding or attempt reset occurs. The permit itself sends no metadata and
registers no release. Next: resume the saved draft through normal artist upload
and wallet approval, then verify protected Web/physical Host allowed and denied
listening. Conservation/renewals and off-volume restore remain W33 gates.
Older dated checkpoints below retain their historical meaning.

## Product 0.1.69 deployment, 2026-11-02

The [verified rollout](../backlog/implementation/evidence/product-0.1.69-rollout-2026-11-02.md) updates Web, Product and the existing API/custody
services, and activates one bounded Bulletin cover/metadata policy without Pinata
fallback. The artist no longer chooses an optional archive. At this rollout, the
synthetic audio job still needed controlled recovery with its three attempts
preserved. [The subsequent recovery record](https://github.com/knzeng-e/dotify/pull/380)
confirms ready audio; merged #382 prepares the remaining name-only metadata repair,
without activating it. Registration and protected physical-device acceptance remain
open. No allowance/counter reset, new service or key installation occurred.
Conservation monitoring/renewal and off-volume restore remain open; Capacity stays
deferred research. Older checkpoints below retain their dated meaning.


## Bulletin publication UX, 2026-11-02

The [publication cleanup](../backlog/implementation/evidence/bulletin-publication-ux-2026-11-02.md) removes the obsolete optional client archive
and development-signer choice. The upload service remains authoritative for
storage routing; artist approval, access checks and bounded publication allowances
are unchanged. The server-side public-asset path is merged in #376; this cleanup
does not activate it. The owner selected Bulletin stabilization first; Capacity
remains deferred research. Next: reviewed public-asset activation and pilot
recovery, then conservation inventory, bounded renewal and off-volume restore.


> 2026-10-28 owner decision: retire the optional 3D renderer and Three.js.
> Radar and List remain the supported discovery views. Historical 3D delivery
> notes below are evidence, not a request to restore it. Immersive metaverse
> exploration is deferred, with no implementation commitment.


## Owner priority: stabilize Bulletin, 2026-11-01

Bulletin remains the active storage direction. [Capacity stays deferred research](../research/capacity-storage-evaluation-2026-11-01.md), with no integration, provider switch or live canary in the current delivery scope.

The next bounded work is to finish the public-asset path in #376, then retire the old optional client-side Bulletin archival checkbox so artists do not select infrastructure or trigger a duplicate signer-dependent write. Conservation follows: account authorization and per-block retention are separate clocks; implement verified renewal scheduling/alerts for every dependency, plus coherent off-volume encrypted-data/key recovery and an honest artist-facing availability commitment. Reserved quota alone does not renew data. Preserve existing jobs, attempts, account cursors and immutable budgets; real writes and rollout retain their explicit reviewed bounds. Physical protected Web/Host publication/listening remains acceptance, not inferred from code or a healthy endpoint.

## Public assets follow-up, 2026-11-01

The owner chose Bulletin covers/metadata after confirming the Pinata account's file cap. [ADR 0044](../adr/0044-bulletin-public-release-assets.md) prepares one cover/metadata pair through the existing private writer, with separate caps, the same durable account cursor, signed grants and renewed canonical authority checks. Host-aware reads use native preimages with existing API recovery; Web uses a bounded public image/JSON relay. This is not deployed or an audio-attempt reset. Exact write approval, failed-job recovery, physical protected acceptance and retention remain gates. Older preparation checkpoints below describe their historical state.

## Bulletin publication checkpoint, 2026-11-01

[ADR 0043](../adr/0043-bulletin-artist-publication.md) connects the authenticated
artist audio queue to an explicitly selected Bulletin writer in private custody.
[Product 0.1.68 and its bounded pilot are deployed](../backlog/implementation/evidence/product-0.1.68-rollout-2026-11-01.md).
The private writer admits one exact runtime/content scope and one durable job;
its allowance cannot repeat across new uploads or restarts. Web and Host use the
application readers from #371; server-side signed key access remains authoritative.
Covers/metadata still use Pinata. Normal artist registration and real-runtime
protected Web/physical Host listening, representative timings/costs, off-volume
recovery and recurring retention remain gates. No audio is sent by the rollout
itself, no broader artist allowance is activated, and no new hosting service or
permanent old-runtime layer is introduced. The owner-approved server key reuses
the DotNS account and retains its full authority; it is confined to private custody.

## Delivery checkpoint, 2026-10-26

Use the [current backlog reconciliation](../backlog/implementation/evidence/backlog-reconciliation-2026-10-26.md)
and [candidate plan](../operations/pilot-release-plan.md) before acting on older
snapshots below. They distinguish delivered work, Product 0.1.62 publication,
pending client corrections and the remaining physical/pilot acceptance gates.

## Current architecture

Dotify currently uses:

- React + Vite frontend under `web/`;
- Socket.IO signaling server for rooms;
- WebRTC host-to-listener audio transport;
- Pinata/IPFS for audio, cover, and metadata references;
- server-selected Bulletin publication under an explicit operator allowance;
- no artist-facing optional archive or development-signer choice;
- Paseo Asset Hub EVM contracts;
- artist-owned SmartRuntime model;
- ArtistRuntimeFactory and ArtistDirectory;
- music pallets for registry, NFT ownership, royalties, access, and personhood gating.
- Fastify catalog read model with confirmed event indexing, deterministic
  reconciliation, and an atomic persisted snapshot.

## Active product surfaces

Execution update (September 2026): use
`docs/backlog/implementation/README.md` for implementation order and acceptance.
Product DevNet now has explicit pilot acceptance alongside standalone web;
capability adaptation remains mandatory. Responsive discovery is followed by
optional 3D rendering, measured musical activity, and opt-in coarse-area
discovery, promoted to the next product expansion on 2026-10-14. W19 adds separate
approximate host/listener km radii after schema/privacy review; existing v1
protocol remains inert until implementation. Stablecoins are deferred; Product
compatibility, runtime feature inventory and key portability follow the dated
`docs/backlog/polkadot-alignment-and-nearby-priority.md` decision. These are planned increments, not claims about delivered capability.
Earlier limitations below are historical snapshots: reconcile them with current
code and live evidence before implementing, especially personhood and Product.

### Music / Listen

Catalog browsing, track cards, artwork, description, access badges, player, room-hosting controls, and real open-room discovery.

### Rooms

Room discovery, manual room-code entry, WebRTC join flow, Socket.IO signaling.

Room playback is host-access based: the host may receive a temporary content key after access verification; room guests receive only WebRTC media and should not need wallet/signature friction.

### Artist portal

Wallet-gated onboarding, runtime creation, upload, encryption, IPFS publication, metadata, primary artist share plus additional rights-holder royalty splits, access mode configuration, on-chain registration.

## Current important limitations

- Browser-side protection is demo-grade and should stay local/demo only.
- Production key delivery uses the backend-held `CONTENT_KEY_MASTER_SECRET`;
  `VITE_CONTENT_SECRET` is not a production key boundary.
- Pinata uploads from the browser are unsafe for public production; use the
  backend API when `VITE_DOTIFY_API_URL` is configured.
- Access model v2 retired the separate preview asset path. Denied listeners and
  unauthorized room hosts receive an unlock/personhood CTA and no audio.
- Proof of Personhood is currently mocked/dev-operated.
- Public rooms require hosted signaling.
- Room guests do not receive keys/source files, but WebRTC audio heard by guests can still be recorded outside Dotify.
- `App.tsx` is now a thin shell switch; the remaining frontend risk is targeted
  provider/view profiling rather than wholesale extraction.
- Frontend/e2e coverage exists for the core Classic unlock, artist publish, and
  room join trust flows; broader wallet-provider/device coverage remains open.
- Legacy registry paths should be archived or removed.
- Frontend contract ABIs are generated from Hardhat artifacts; generation must
  stay checked so drift does not return.
- The October 28 [0.1.63 rollout](../backlog/implementation/evidence/product-0.1.63-rollout-2026-10-28.md)
  activates two warm API edges, verified-TLS PostgreSQL with bounded independent
  sessions, and one private custody writer. Keep the shared namespace and
  permanent encryption reservations on rollback; pre-W36 local-state images
  are not compatible rollback targets. Physical/pilot acceptance remains open.
- Production catalog browsing is one backend request when
  `VITE_DOTIFY_API_URL` is set. Local mode uses single-writer
  JSON; the deployed W36 generation uses the migrated PostgreSQL shared store. W37 separates catalog content
  from compact progress, bounds RPC reads/replay ranges, and reuses lookup
  indexes; see [ADR 0036](../adr/0036-bounded-catalog-indexing.md). The dated rollout above records the activated deployment; synthetic scale
  tests do not measure real provider capacity.
- Product SDK / Playground / Humanity integration is a progressive enhancement
  track. The current verified Product SDK snapshot is prototype/reference/
  unaudited, Host APIs require a compatible container, contracts target
  `pallet-revive` / PolkaVM CDM flows, Product sr25519 key/session signatures
  are wired for Product frontend protected playback after explicit host-account
  connection, and Statement Store is constrained to small signed ephemeral data.

## Production spine

Production readiness means the following must work reliably:

1. Artist connects a real wallet.
2. Artist creates or resolves their SmartRuntime.
3. Artist uploads protected audio through a backend boundary.
4. Artist registers a track on-chain.
5. Listener sees track in catalog.
6. Unauthorized individual listener receives no audio and an unlock/personhood CTA.
7. Classic listener pays and unlocks individual full playback.
8. Backend releases a temporary content key only after wallet signature and access check.
9. Host creates room from playable track.
10. Room guest joins through a simple link without wallet/signature.
11. Protected room playback checks host access only.
12. Room guests never receive content keys or source files.
13. Free tracks play without wallet/signature after the backend verifies the on-chain Free mode.
14. Critical flows are covered by tests.
15. Product-host features fail explicitly when the Host or permission is
    unavailable; they do not silently fall back to demo secrets or bypass access.

## Backend direction

Introduce a lean backend service for:

- Pinata uploads;
- content-key custody and delivery;
- wallet signature verification, including EIP-191 and Product sr25519
  request schemes;
- nonce/replay protection;
- access checks against SmartRuntime;
- room host key requests;
- denial responses without keys for unauthorized hosts;
- Free-track unauthenticated key delivery after on-chain zero-address verification;
- health and version endpoints;
- cacheable catalog list/detail endpoints with block-lag metadata;
- confirmed SmartRuntime event indexing and deterministic reconciliation;
- future WebAuthn backend support.

The backend should be boring, typed, and auditable.

Recommended baseline:

- Node.js 22;
- TypeScript;
- Fastify or similarly lean framework;
- viem for EVM reads;
- Zod/Valibot for validation;
- structured logs;
- strict env validation.

## Audio protection direction

Do not claim full DRM.

The target is distribution access protection:

```txt
wallet signature -> backend verifies signature -> backend checks runtime access -> backend releases key -> browser decrypts local audio
```

For room playback, the key is released to the host only. Room guests receive only the ephemeral WebRTC stream.

This prevents bundled frontend secrets and direct full-track source access by unauthorized listeners. It does not prevent recording after authorized playback or after receiving a WebRTC stream.

Document this honestly.

## Room direction

Rooms must become production-stable:

- hosted signaling;
- join links;
- room TTL;
- heartbeat;
- cleanup;
- clear states;
- explicit unsupported-browser behavior;
- simple user language;
- no wallet requirement for room guests;
- host-based access metadata;
- no protected stream plus host CTA when host lacks protected-track access.

Room UX should be benchmarked against Spotify Jam and Jukebox Duo for low friction.

## Contracts direction

The active direction is artist-owned SmartRuntime, not the legacy monolithic registry path.

Maintain and test:

- runtime creation;
- one runtime per artist;
- track registration;
- deactivation;
- Classic payment;
- royalty settlement with claimable fallback for failed recipients;
- personhood-gated access;
- NFT transfer gating;
- isolation between artist runtimes;
- safe upgrade/facet mechanics.

Generate frontend ABIs from Hardhat artifacts.

## Frontend direction

Refactor toward feature modules:

```txt
web/src/app/
web/src/features/catalog/
web/src/features/player/
web/src/features/rooms/
web/src/features/artist-studio/
web/src/features/wallet/
web/src/features/access/
web/src/features/runtime/
web/src/features/uploads/
web/src/shared/
```

Keep chain calls out of presentational components.

Keep user-facing blockchain complexity low.

## Testing direction

Add deterministic tests for:

- Classic unlock;
- artist publish;
- room join;
- room guest no-wallet join;
- authorized host full protected stream;
- unauthorized host no-stream fallback;
- listener never receives room content keys;
- access-state logic;
- locked/full playback state;
- signature verification;
- key request failure modes;
- upload failure modes;
- chain/RPC unavailable states.

Contracts already have meaningful tests; frontend and e2e must catch up.

## Security principles

- No unrestricted Pinata JWT in frontend.
- No production key material in frontend bundle.
- No dev fallback signer in public flows.
- Access checks must fail closed.
- Backend must not trust frontend-provided access results.
- Wallet signatures must include nonce, chain ID, content hash, requester
  address, request purpose, and expiration; Product signatures must also bind
  the Product account public key to the derived H160 requester.
- Replay protection is mandatory for key requests.
- Room listeners must never receive content keys or encrypted source files.
- Logs must never expose secrets, keys, or raw uploaded contents.

## Deployment principle

A public testnet MVP should be reproducible.

A fresh contributor should understand:

- how to run web;
- how to run signaling;
- how to run backend;
- how to compile/test contracts;
- which environment variables are needed;
- which flows are local demo only;
- which flows are production-ready.

Product-mode deployment is a separate readiness track. Playground/Bulletin/DotNS
can make publication easier, but they do not replace backend upload validation,
content-key custody, or room guest/source-key separation.

## Technical mantra

Keep the roots deep, but the fruit easy to reach.

## Prepared Bulletin recovery, 2026-11-02

[Maintenance-only recovery](../operations/bulletin-prepared-job-recovery.md)
authenticates existing output and binds an operator continuation to an inspected
plan. Three preparation attempts, storage caps, account cursors and nonce history
are preserved. There is no new artist action or public route. This implementation
is not live recovery; artist approval and protected Web/physical Host acceptance
remain open, followed by retention/restore work.

## Synthetic pilot recovery completed, 2026-11-02 21:49 UTC

The [approved API-only intervention](../backlog/implementation/evidence/bulletin-prepared-recovery-rollout-2026-11-02.md)
made the original job ready through 16 verified stores / 712,737 bytes. Attempts
remain three; custody and public readiness are restored. Product/Web stay 0.1.69.
The subsequent artist-name rejection is addressed by merged #381/#382, awaiting
client rollout and separately authorized metadata repair. Then the artist can
resume the preserved draft and approve registration.
Protected physical/Web acceptance, conservation/renewal and off-volume restore
remain gates; no broader artist allowance or automatic renewal is enabled.


## Prepared-release recovery rollout, 2026-11-04

[API/custody, Web and Product 0.1.71](../backlog/implementation/evidence/product-0.1.71-rollout-2026-11-04.md)
serve exact source `e2dd6148`. Product finalized 12 stores / 3,556,058 bytes,
reused eight blocks and made two DotNS signing requests. Independent exact
CAR/record/gateway readback passes; the local signer is removed. The original audio remains ready at three attempts,
all original inventory hashes and the name-only repair permit are unchanged.
Explicit recovery previews/restores the admitted title, note, cover and 1.21 PAS
price, then requires an ordinary Publish and wallet action. No new admission,
metadata write or registry transaction occurred during the service/Web rollout.
Custody had stopped after losing its database lease before deployment; same-image
restart restored inspection. Investigate supervised recovery separately while
preserving fail-closed shared-writer ownership. Conservation of reused app blocks
(expiry 1,532,185), protected acceptance and off-volume restore remain open.


## Fresh Bulletin publication trial active, 2026-11-04

[New empty publisher/queue paths](../backlog/implementation/evidence/bulletin-fresh-pilot-activation-2026-11-04.md)
replace the abandoned repair draft as the active target. Same source/image and
installed signer; Product/Web remain 0.1.71. Owner-approved cap: audio 16/1 MiB,
cover 16/512 KiB, metadata 4/64 KiB. Four permanent encryption reservations are
copied and verified, account floor is 1120, and 14 old small state files remain
byte-identical. No musical or registry/DotNS write occurs during maintenance.
The artist starts a normal New release. General draft editing/multi-release
admission, protected acceptance, conservation and off-volume restore remain gaps.
