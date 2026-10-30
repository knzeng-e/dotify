# Deployment Configuration Runbook

## Publication recovery deployed in Product 0.1.67

Merged #351 is deployed on Web, API/custody releases 36/5 and Product 0.1.67.
Progress/retry ownership and bounded uploads now preserve actionable errors;
custody exposes only allowlisted failure categories. Durable job/nonce formats,
PostgreSQL identity, secrets, Host permissions and contracts are unchanged.
Keep failed jobs available for explicit artist recovery; never reset the nonce
ledger to retry storage. The encoder and signaling were not restarted.
See the [rollout record and rollback](../backlog/implementation/evidence/product-0.1.67-rollout-2026-10-29.md).
Bulletin media storage remains an exploration, not a production setting.

## Bulletin segmented-media prototype, not deployed

The [Bulletin media prototype](../../research/bulletin-prototype/README.md) is
also isolated from deployment. Offline tests/CI use simulated storage and never
load a signer or submit transactions. The separate local operator command can
send the explicitly authorized synthetic canary to the pinned Bulletin DevNet:
19 blocks / 870,498 bytes plus one immediate renewal per block. It uses the
owner-selected account, a local signer descriptor and finalized metadata/raw CID
readback; it has no automatic environment signer or public-pool fallback.
See its [operator and recovery steps](../../research/bulletin-prototype/README.md#network-canary).
Do not change Pinata/read origins or put the DotNS key in a server. Production
SDK/protocol pins remain unchanged and there is no production enable flag.
The operator lock survives abrupt termination for explicit reconciliation;
keep the private fixture/nonce ledger/receipts, and remove the temporary local
signer after the run. Recurring renewal, real AAC, physical Host retrieval and
first sound remain separate acceptance gates.
The [2026-10-30 canary](../backlog/implementation/evidence/bulletin-network-canary-2026-10-29.md)
verified 19 stores and 19 immediate renewals, with no additional store during
read-only timeout recovery. The local signer is removed. This does not activate
Bulletin media in the app; the sequential prototype's roughly twelve-minute
publication is an explicit throughput limitation.

The [real-AAC Host reader preparation](../backlog/implementation/evidence/bulletin-aac-host-canary-2026-10-30.md)
adds a separate generated eight-second fixture and a loopback-only test page.
Its 16 stores / 713,199 bytes were finalized and read back without a signer;
46 transactions remained. A full renewal cycle was reserved but not executed
for this fixture. Run it only with the private generated fixture;
never tunnel or publish its key endpoint. Native modes have no API/gateway/local
fallback. Installed Desktop preimage reads timed out and its chain adapter
refused the content RPC; the SHA-256/BLAKE2b compatibility lead is in the evidence.
Mobile distribution and physical native first sound remain unverified;
no deployed origin, signer, Host permission or production storage is changed.

The next isolated addressing diagnostic uses exactly three public-marker
blocks / 387 bytes, with SHA-256 and BLAKE2b-256 hashes and one named directory.
Its separate budget reserves three stores plus three possible renewals, but
only stores are planned. Follow the [controlled comparison](../../research/bulletin-prototype/README.md#controlled-addressing-comparison);
its public session has no key and the audio session endpoint returns 404.
The normal generated-AAC session remains private and loopback-only. A passing
marker test must not activate production delivery or be presented as AAC proof.

## W39 room scaling research, not deployed

[ADR 0037](../adr/0037-room-scaling-and-sfu.md) and the
[isolated harness](../../research/room-scaling/README.md) evaluate two-process
room authority and a 25-guest synthetic SFU. Their dependencies and local
settings are not frontend/Fly configuration. No production Redis, SFU, region,
permission, key, secret, storage migration or paid resource is introduced.
Do not scale `dotify-signal` above one machine or raise `SIGNAL_MAX_LISTENERS`
from this local experiment. Keep current production origins and room access.
The reduced prototype is not a deployable server; native media, polling/Fly
affinity, privacy/discovery and live-authority migration require separate review.

## W38 fresh runtime generation deployed in Product 0.1.66

The 2026-10-28 owner decision is a fresh internal contract deployment. API,
ordinary Web and Product now enumerate through `musicRegTrackHashesPage` and
require the new factory/runtime generation. There is no old-runtime fallback.
Do not mix these readers with the previous runtime generation.
The authorized 2026-10-29 reset uses factory `0x61dd19a0d4f6bd21c6ffa4a7a9d9e771af95bb13`,
directory `0x79b21cad3848a3019edee17b089142282f4a13a3`, finalized CDM versions 3
and an empty client bootstrap. API, custody, signaling, Web and Product are now switched together.
The PostgreSQL operator changes only `dotify_state_identity.identity.directory`
for namespace `dotify`, with an exact old-directory guard and unchanged chain,
version and session epoch. Preserve nonces, revocations, quotas, custody and
receipts; the catalog rebuilds from the new directory. No schema or role change.
See the [rollout record](../backlog/implementation/evidence/product-0.1.66-rollout-2026-10-29.md)
for publication status and rollback boundaries. No new service, paid resource or environment variable is added.

Snapshots may include bounded-release exclusions (`excludedReleases`: ID/reason);
catalog response metadata includes `excludedReleaseCount` when nonzero. This is
public metadata, not payment authority. Ordinary transport errors still stop the
checkpoint. Inspect exclusions and correct the source record rather than silently
truncating rights. Existing SQL schema is unchanged; shared snapshots already store
JSON documents. Roll back the matching contract/API/client generation together.
See [W38 limits, evidence and activation](../backlog/implementation/evidence/W38.md).

## Managed mobile reader published in Product 0.1.65, 2026-10-28

The client now uses AAC ManagedMediaSource when standard AAC MSE is unavailable.
There is no new environment variable, server, key, format, migration or paid
service. Product 0.1.65 is published and Web serves merged `bd813f7e`;
see the [exact rollout record](../backlog/implementation/evidence/product-0.1.65-rollout-2026-10-28.md).
About identifies the chosen audio capability and build. Physical mobile
acceptance remains open; this is not a measured first-sound guarantee.

The managed reader disables URL-based remote playback only on its own audio
element, before attaching its source. No public clear-media alternative is
provided. Native AAC decoding passes on local desktop WebKit; Product mobile
still requires cold Free, paid-authorized and denied playback, seek/repeat,
next-track adoption, background/resume, room-host capture and actual audible
output checks. Keep the room guest key boundary unchanged. Record exact client
SHA/CID/version, Host/OS, network, sample count and first-sound export; compare
like-for-like cold/warm samples. If native capability is absent, About must say
Compatibility AAC, not pretend this optimization is active.

Rollback is the previously reviewed client artifact; backend trust state and
custody remain unchanged. Do not roll back W36 storage. See the
[implementation evidence](../backlog/implementation/evidence/managed-mobile-audio-2026-10-28.md).

## Free first-sound correction published in Product 0.1.65

The client removes the redundant runtime read before an encrypted v3 Free-key
request. The existing API remains authoritative; no secret, environment setting,
CORS change, infrastructure scaling or migration is introduced. Product 0.1.65
publishes this correction; 0.1.64 is its compatible client rollback.

The same client adds **You → About Dotify**, available without an account.
Product version comes from the embedded Product manifest version; Web identifies
itself by build SHA. Copying uses only allowlisted build/media capability fields,
not account/session data. The Host application version is not inferred. Older
published clients do not gain this entry until they are updated.

Before calling mobile startup resolved, bind a new Product CID/version and test
on the affected physical mobile Host: cold Free playback, a denied key, replay
of a cached track after denial, cancellation and retry. Record the visible
startup phase, installed Host/OS version and whether audio is actually heard.
Separate key wait, ciphertext download and native readiness. Desktop playback
and browser fixtures do not establish that mobile uses progressive AAC.
See the [audit and evidence](../backlog/implementation/evidence/mobile-first-sound-audit-2026-10-28.md).

## Product 0.1.63 and W36 activated, 2026-10-28

The combined test deployment now includes W35, W36, W37 and #335-#337.
Product uses clean packaging `5de94989f2e36e6ee8e9e871471233e07d9381f1`;
API release 34 and custody release 3 use its tested dual-stack image. Two warm
public replicas share PostgreSQL; one private custody owns encrypted jobs,
permanent encryption reservations and receipts. Web serves tested dev `200d6195`.
See the [0.1.63 rollout](../backlog/implementation/evidence/product-0.1.63-rollout-2026-10-28.md) for exact CID, image, backups,
readback and the separate physical-device acceptance boundary.

Fly MPG uses the owner-approved managed-writer row policies in
`services/api/migrations/002-managed-runtime-policies.sql`. Operator DDL remains
separate. Follow the [migration, rotation and rollback procedure](shared-api-state.md);
never restore a local-state API after shared writes. New publication stays
closed until 2026-10-27T23:40:05Z (00:40 October 28, Paris) while conservative
legacy quota usage expires. Existing listening is available. Retire both
previous-session fields after the recorded family-retention deadline; preserve
content-key material.

The edge Pinata diagnostic remains role-unaware (`degraded`, readiness 200).
Custody readiness and actual publication/history proxy paths pass independently.
Do not put Pinata credentials back on public edges to hide that diagnostic.

## W37 catalog deployment, 2026-10-28

[Bounded indexing and recovery](../adr/0036-bounded-catalog-indexing.md) changes
API indexing only. It is deployed in API release 34 and introduces no frontend permission,
secret, contract upgrade or SQL schema migration. W36's activation migration
and custody-volume requirements remain mandatory.

| API setting                 | Default | Bounds and purpose                                                          |
| --------------------------- | ------- | --------------------------------------------------------------------------- |
| `CATALOG_READ_CONCURRENCY`  | `8`     | 1-32 outstanding catalog RPC reads, including nested hash/split enumeration |
| `CATALOG_LOG_BLOCK_RANGE`   | `1000`  | 1-10,000 blocks per committed replay range; lower for stricter RPC limits   |
| `CATALOG_LOG_ADDRESS_BATCH` | `100`   | 1-1,000 runtime addresses per event filter                                  |

Retain both `CATALOG_SNAPSHOT_PATH` and its `.checkpoint` sidecar in local-mode
backups. Shared mode uses `catalog-v1` plus `catalog-checkpoint-v1` in the same
PostgreSQL namespace, written on the elected connection. Existing schema-1 bases
load without a sidecar; missing or mismatched progress replays from that base.
Do not remove or fabricate a checkpoint to claim freshness. Intermediate catch-up
is explicitly stale and cannot grant keys.

Validation: run the API tests (including the 1,000-artist/10,000-release synthetic
fixture), then `test:shared-state` against an isolated loopback database. At
activation record catalog state, block lag and RPC response time/429s through a
restart and an outage longer than the configured range. Check both ordinary
Web and Product catalog/key flows; synthetic tests do not prove provider quotas
or first sound. For RPCs without historical state, use the operator's explicit
`catalog:reindex` command rather than skipping failed ranges automatically.

Rollback within W37 preserves both records. An older API ignores the compact
checkpoint: quiesce the elected writer, force a full reindex with the rollback
binary and verify fresh canonical evidence before reopening key delivery.
W36's prohibition on reverting shared auth/custody to local state still applies.

## W35 client deployment, 2026-10-28

W35 adds no secret, Host permission, server API, contract or persistent server
migration. The combined Web/Product deployment is recorded above. #335-#337 and W35 are
published in Product 0.1.63; the earlier 0.1.62 executable did not contain them.

Verify adaptive 96/160/320 AAC playback on variable networks, an authorized
queued-track handoff, pause/seek/skip/repeat/dismiss cancellation and room entry
while a successor is prepared. Guests must retain zero source-key calls and the
same WebRTC transport. Test lock-screen actions and phone/desktop backgrounding
on exact Host builds, recording unsupported capabilities explicitly.

Include denied Classic/personhood access and an unavailable runtime read for
non-encrypted policy-managed sources: neither preparation nor selection may
start a media request before permission. A previously ready local candidate
must not bypass a newly applied artist policy; an allowed selection still plays
through its ordinary access check.

Resume stores one bounded account/network-scoped checkpoint in browser storage
(`dotify:listening-checkpoint:v1`), never keys, source URLs or room membership.
It is optional when storage is blocked. Dismiss saved listening or close the
mini-player to remove it; old clients ignore the versioned key on rollback.
No custody, nonce, session, receipt or catalog files change. Existing W34 routes
remain the prerequisite; W33's gateway activation is independent. The first-sound
export keeps schema 6 with optional local aggregate continuity metrics.
See [design and boundaries](../explanation/continuous-listening.md) and
[actual verification](../backlog/implementation/evidence/W35.md).

The dedicated W35 browser CI job needs a running audio service: it starts
PulseAudio with an explicit null sink on the hosted Linux runner. This keeps
AAC/MSE and native-error assertions enabled; it is test infrastructure only and
does not prove physical sound or require a deployed server/Host setting.

## Mobile audio startup follow-up, 2026-10-28

The [startup correction](../backlog/implementation/evidence/mobile-host-audio-startup-2026-10-28.md)
is client-only: no server rollout, secret, Host permission, custody migration or
runtime upgrade is required. Product 0.1.64 now includes #342; finalized DotNS
and exact public artifact checks pass. See the
[0.1.64 rollout](../backlog/implementation/evidence/product-0.1.64-rollout-2026-10-28.md).
This publication does not deploy Web. Verify the loaded client before accepting
device results. On exact mobile Host versions, test a cold Free and
an authorized protected track, gesture-required Play, in-place retry after a
stalled startup, track replacement and room entry. A prepared source must leave
Play usable before metadata, without enabling it before authorization. A new
source must load explicitly; adopting an already buffered successor must not
reset it. Verify the 60-second post-authorization timeout offers retry and that
cancelled or expired work cannot revive playback. WebKit fixtures do not certify
the installed Polkadot App or its background execution.

## Client corrections published in 0.1.63, 2026-10-28

Product 0.1.63 now publishes payment approval-expiry recovery (#335), automatic
return to artist releases (#336), room exits and mini-player dismissal (#337).
The 0.1.62 publication below is historical. No new environment
variable, permission, server restart, contract or secret is required for these
client corrections.

Before publishing a reviewed candidate, verify missed approval recovery without
a duplicate payment, confirmed publication returning to releases, and room exit
returning home. On physical Product mobile/Desktop, verify the mini-player
confirmation/cancel paths, stopped audio after dismissal, no late-source revival,
cleared room invitations after refresh and continuity when entering the studio.
Preparing an artist release must not replace a live room's source. Preserve
existing unresolved payment journals; browser CI is not native signing evidence.
See [current scope and evidence](../backlog/implementation/evidence/backlog-reconciliation-2026-10-26.md).

## W34 API/Web and Product 0.1.62 published, 2026-10-25

API release 32 serves clean packaging source `781f1c5`, based on tested merged
`dev` `c71947a` (#333). Netlify deploy `6add7a9dc6222369213efa6d` serves the
merged dev SHA; its temporary production-branch selection was restored to
`main`. Product 0.1.62 is published from clean packaging `781f1c5` at root/app
CID `bafybeiaxgf3x4s6c6cwmxd3wm4gsllwl6gxuedqrejb3gmepo62ux2dto4`.
Finalized manifest/version readback and all 135 public CAR hashes plus exact
entry/graphics bytes pass. The local signer is removed. Product 0.1.61 remains
the client rollback artifact. See the [rollout record](../backlog/implementation/evidence/product-0.1.62-rollout-2026-10-25.md)
for exact identities, the transient RPC denial/rollback/recheck, Web build-clean
limitation and physical-device acceptance. Preserve the existing single API
writer, UID 1000, secrets and volume. Signaling/encoder/contracts are unchanged.

Deploy the W34 API before its Web/Product clients. No config variable, permission,
contract or secret changes are required. `/api/tracks/keys/prepare` accepts at most
five full identities with an existing identity session (12 requests/client/minute).
`free-key` has its own 30 requests/client/minute limit. Both inherit W30's
`API_TRUST_PROXY` client resolver; retain Fly's trusted-header deployment boundary.
All key responses, including denials and quota errors, remain `no-store`.

Verdicts live in a bounded process cache (512 entries, <=30 seconds, observed
block number/hash plus full identity); a failed head read never serves an old
allow. Clients hold at most five prepared grants in memory and drop them on
identity/network/session changes. A batch expiry does not extend a cached verdict.
No Redis or shared store is added. The existing single-writer/session topology
remains; W36 owns shared trust state. See [design](../explanation/fast-access-preparation.md)
and [evidence](../backlog/implementation/evidence/W34.md).

Before release, verify a signed-in warm Next, expired/denied fallback, sign-out,
account/network change, Free and protected playback, and a guest with zero key
calls on ordinary Web and physical Product. Record actual first sound separately
from the synthetic key-wait benchmark. Roll back clients first; keep custody,
nonce, revocation and catalog files unchanged. Restarting only clears verdicts.

## Product 0.1.61 scoped 3D published, 2026-10-24

Merged `dev` `620f7c6` (#330, with #327's publication record) is packaged from clean
commit `c294e21651ab007725d7fafa18be5c6de8e03419` as executable `[0,1,61]` at CID
`bafybeiavq23ghgrkkrq5frcwzy3zcnnq7tvp5umgixdz3exmllfxrd3wbi`.
Finalized root/app readback at block 14867115, all 135 public CAR blocks and exact
entry/graphics bytes pass. The local signer is removed. Native profile, permissions, contracts
and frozen catalog are retained. This is a Product-only publication; the owner
handles Web, and API/signaling/encoder stay running. Radar remains the initial
view and 3D is an explicit presentation choice over the same public results.

See [publication evidence and rollback](../backlog/implementation/evidence/product-0.1.61-rollout-2026-10-24.md).
Physical Host graphics, audio continuity and location remain acceptance checks.

## Product 0.1.60 Host compatibility published, 2026-10-23

Product 0.1.60 publishes merged dev `a60a89f` (#326 included) from clean
packaging `cb63d0749aba0a43980f1d3dd3f52a3c9866cf66`. Root and executable resolve to
`bafybeia2dhkny3yv4oy2dzubqa24qlt2kacnd64sy5mjf3qw47dhdveuum` at finalized block 14811178.
The manifest version, all 127 downloaded CAR blocks and exact executable
bytes are verified; the local signer was removed and its absence checked.

This Product-only release targets the inspected Desktop 0.1.4-rc.3 TrUAPI 0.25
protocol. API/signaling/encoder, ordinary Web, CDM and artist contracts were not
redeployed. #324's signaling authority endpoint and new contribution facet still
require their separate rollout. Media-edge configuration stays unset; the supplied
dedicated Pinata gateway is not activated while it returns HTTP 401.

See [publication evidence and remaining gates](../backlog/implementation/evidence/product-0.1.60-rollout-2026-10-23.md).
Physical Desktop and mobile connection, same-account continuity, signing/audio
and location consent remain acceptance checks. Earlier 0.1.59/0.1.58 sections
retain historical publication and server/reset evidence.

## Product bootstrap follow-up published, 2026-10-22

Product 0.1.59 publishes merged #323's native peak-storage-deposit correction
at root/app CID `bafybeia7d6qbsqq7tj32tgvzc3z3vr3x6cxhtlyve6fc3k52zqeqmjhhum`.
Finalized manifest, all 124 public CAR blocks and exact index/entry identity
are verified; the local signer is removed. API 29/signaling 37/encoder 1 and
contracts/CDM were not restarted or changed. Ordinary Web remains on the
previous streaming-reset source. See [the Product-only evidence](../backlog/implementation/evidence/product-0.1.59-rollout-2026-10-22.md).
The artist must resume their pending runtime through normal user approval;
publication alone does not complete registration. The following 0.1.58 section
records the earlier coordinated server/catalog reset.

## Streaming reset deployed, 2026-10-22

API 29, signaling 37 and private encoder 1 serve tested source `142fc63`.
Product 0.1.58 is finalized at root/app CID
`bafybeiguwd2uaz7qv3l66rxpviw5aajmu6xka74vzqgd2regl2vnbh7x7y`;
Web serves the matching merged application source. The fresh factory/directory
and empty catalog are active. The existing API volume was backed up and migrated
without changing persisted bytes, then streaming custody was initialized once.
The API runs as UID 1000 with 1 GiB; the 512 MiB encoder is private and warm.

See the [rollout evidence](../backlog/implementation/evidence/product-0.1.58-rollout-2026-10-22.md)
for exact images, backup, integrity and live checks. Real artist publication and
physical-device listening/value flows still require acceptance. Earlier dated
preparation and rollback notes are historical; 0.1.57 is not a compatible
standalone rollback after this reset. Preserve the latest nonce/revocation
custody and follow the streaming recovery procedure.

## Current audio reset policy, 2026-10-21

The owner retires the internal catalog under [#320](../backlog/streaming-only-reset.md)
and [ADR 0033](../adr/0033-streaming-only-internal-reset.md). Only authenticated
v3 streaming is supported after the coordinated #319 cutover. Earlier dated
DAV2/range/inline-worker/legacy rollback notes below describe historical builds,
not the current deployment recipe. The coordinated rollout is recorded above.

- Deploy the API/isolated encoder and matching Web/Product clients together,
  using the fresh directory and empty bootstrap. Recreate artist runtimes and
  republish originals. Missing worker settings return 503 on audio upload.
- The ciphertext relay serves only `/api/media/:cid/stream/manifest.json` and
  fixed rendition init/media objects for active canonical encrypted releases.
  No bare CID, Range, archive or arbitrary URL relay remains. Two cold reads,
  16 MiB/64 cached entries, 256 KiB manifests and 1 MiB+16 byte segments bound
  transport; every request, including cache hits, rechecks catalog eligibility.
  Independent subscriber cancellation, no-store responses and reviewed HTTPS
  gateway redirects remain enforced. Restart clears only in-memory ciphertext.
- The browser reads authenticated manifest/init/segments; it never derives keys
  from a frontend secret. A 4 MiB/16-entry/30-second manifest/init ciphertext
  cache may warm two neighbors without any key request. Playback still checks
  access and authenticates every object. AAC Blob compatibility uses the same
  rendition on hosts without standard MSE; no old file codec is retained.
- Key versions 2+ remain release-bound to chain/runtime/hash. Keep v2 secrets
  when rotating to v3 and retain the permanent actual-key nonce ledger union.
  A catalog reset is not permission to erase custody or recycle nonces.
- First-sound evidence is schema 6 with manifest/segment events. Earlier schema
  5 exports are historical and cannot qualify the new candidate. Physical
  Product/device acceptance remains required; browser automation is not proof
  of installed Host behavior.

See [publication, provisioning and recovery](streaming-publication.md) for the
resource/token/volume boundaries and explicit operator sequence.

## Clean testnet contract preparation, 2026-10-21

The owner-requested fresh core deployment is live on the existing testnet,
chain 420420417: factory `0x708d35eee7c1416f6d332344068be9d714aec24c`,
directory `0x8e611ef60169f8ed93019de4a3034a504ae2ad29`. Both CDM package names
are finalized at version 2. All ten core contracts are source-verified, and the
fresh owner-guard audit finds zero finalized/pending runtimes. No previous core
contract, artist state, claim or IPFS data was deleted.

These contract transactions did not themselves cut over the applications. The
2026-10-22 rollout above subsequently activated their
staged configuration, empty frozen bootstrap, directory-scoped browser cache and
recorded CDM versions together after W30/W32 review and provisioning.
See [identities, evidence, rollout and rollback](fresh-testnet-2026-10-21.md).
Existing session/custody/receipt state and keys must survive that rollout. Do not refresh a fresh-directory bootstrap from an API still serving an older directory.

## Release publication and documentation hosting, 2026-10-20

GitHub 1.4.0 tags final main `9788ec0`; Product `[0,1,57]` was separately signed
from clean packaging `a789d8e` at root/app CID
`bafybeifba24wrvu2ywkurapvsjmeub3llviu2tybc3hkzljobww3ordqqm`.
The native profile, frozen catalog, origins and permissions are unchanged.
Netlify deploy `6ad794bc91a585c41cecef08` already serves tested dev `615ad44`,
whose full tree equals the final main source, so no redundant rebuild was made.
API 28/signaling 36 remain source-compatible and healthy without restart or
configuration/key/contract changes. Client rollback is 0.1.56. See the
[rollout record](../backlog/implementation/evidence/product-0.1.57-rollout-2026-10-20.md)
for byte/finality evidence and remaining native/latency acceptance.

GitHub Pages is enabled using **legacy source `main`, path `/docs`**, with the
existing `docs/.nojekyll`. It serves https://knzeng-e.github.io/dotify/.
The source build from `9788ec0` and public gallery return 200. Keep optional
`ENABLE_GITHUB_PAGES` unset: the two opt-in Actions workflows publish different
app/docs outputs and must not compete. Future docs changes appear there only
when promoted to main. This is documentation hosting, not an app deployment or
new API/CORS origin. Restore this exact source if Pages configuration drifts;
do not enable both optional workflows as a workaround.

## API non-root preparation, 2026-10-21

The default API image now runs as UID/GID 1000 and checks storage access before
loading persisted session/catalog services. At preparation time API 28 still
ran the older root image; API 29 completed the migration on 2026-10-22 above.
Do not deploy the new runner against the existing root-owned volume without
following the [offline ownership and rollback procedure](api-nonroot-storage.md).
An explicit maintenance image changes only reviewed file ownership/modes;
startup never performs a privileged recursive repair. No new environment
variables, secrets, origins, mounts, scaling or key rotation are introduced.
See the [isolated rehearsal evidence](../backlog/implementation/evidence/W30-api-nonroot-2026-10-21.md).

## W32 new-publication preparation, 2026-10-21

New code connects signed/scoped artist uploads to a durable encrypted queue,
a separately isolated private encoder, 202 progress/retry and v3 player/room
playback. This was not deployed at preparation time; the 2026-10-22 rollout
above activated it. The subsequent owner reset retires the
old catalog and removes DAV1/DAV2 compatibility; artists republish. See [activation, resources and rollback](streaming-publication.md).

The activation plan adds a dedicated worker token/URL and permanent streaming
custody subtree to the existing API volume. It requires one private 512 MiB
encoder, a 1 GiB single-writer API and at most two concurrent uploads, based on
local 15-minute resource evidence. No frontend secrets, new CORS origins,
content-key rotation, paid listener gate or room-guest key path is introduced.
W30 non-root/ownership must precede provisioning; initialization is explicit,
never a missing-ledger repair. These resources/configuration were prepared in that PR and applied in the
2026-10-22 rollout above. Do not run an old three-file maintenance tool recursively
across the new nonce subtree. Ordinary Web and native Product acceptance and real
Pinata load remain release gates.

## W32 format foundation, 2026-10-20

The inactive W32 format/codec slice does not change upload routes, running
playback, keys, contracts, service images, secrets, origins, volumes or scaling.
Existing releases remain DAV2. Its FFmpeg dependency is used in CI and local
network-isolated probe images only; the production API image is unchanged.
See [W32 evidence](../backlog/implementation/evidence/W32.md) and the
[format/nonce decision](../adr/0032-streaming-renditions.md).

Before eventual activation, review the W30 non-root/volume remainder, bounded
durable job admission, measured worker packaging and real Host compatibility.
Nonce reservations are permanent custody metadata: never recreate a missing
ledger, recycle failed-job prefixes or restore an older ledger alone while its
keys remain usable. A code/media-index rollback must preserve the union of all
reservations. No initialization command, service restart or migration is
authorized by this documentation-only operations amendment.

## Live room invitations and contribution continuity, 2026-10-18

Published as Product 0.1.55 from clean packaging commit
`74effe95da53394dec9394666f30d4e14bac024c`; signaling release 36 preceded the
clients. See the [rollout record](../backlog/implementation/evidence/product-0.1.55-rollout-2026-10-19.md)
for finalized CID/version, public-byte verification and live tests. Physical
Desktop/mobile background, location, audio and funded-tip acceptance remains open.
For subsequent rollouts, deploy signaling before the Web/Product client. There are no new
credentials, environment flags, CORS origins, storage mounts or contract changes.
The v5 search protocol adds scoped `nearby:updated` snapshots and
`nearby:unwatch`; legacy schemas remain available. New clients negotiate down on
`INVALID_AREA` only. Older servers cannot offer live pushes, optional room profile
editing or background holds. Keep single-process signaling; no horizontal
subscription/presence coherence is implemented. Rollback requires both client and
signaling if withdrawing the new background policy.

A 200 ms coalescer updates only watchers intersecting the changed room's old or
new public area; private/no-op activity does no watch work. Identical queries
share a snapshot/enrichment within that batch. A one-second sweep handles expiry.
There are at most 2,000 watched sockets and two 45-second queries each. Public
snapshots only are emitted. Payloads, coarse areas and watch IDs must not enter
logs, analytics, persistence or diagnostic endpoints. See the authoritative
[privacy amendment](../design/dotify-nearby-discovery-privacy.md#live-invitations-and-background-continuity-2026-10-18).

A held background host stays discoverable at its last area while transport pongs
or host activity prove the session lives. Disconnection enters an eight-second
discovery grace after transport failure is detected. Explicit close removes the
invitation on the next coalesced push. Browser/OS suspension is not equivalent to
intentional room closure. Verify screen lock, app switching, network loss,
authenticated resume and opt-out on the exact supported Desktop/mobile builds;
local fixtures cannot prove native lifecycle or uninterrupted audio.

Room names/invitations are optional, bounded, host-only and ephemeral. The public
artist-presence flag is derived from a verified announced member and the current
release. Test artist arrival, discreet entry, track change, departure and
revocation; never trust a client-supplied artist badge.

Contributions keep only amount/open state across wallet connection, then quote
again for the connected payer. Financial state remains scoped to account,
network, runtime and work. Product lifecycle callbacks update progress while
waiting for finality; the installed SDK exposes status only, not an early hash.
The returned reference/block is saved before receipt verification. A pending
receipt recheck resumes on foreground return without another payment. No timer
assumes failure or resubmits. UI success still requires
a matching finalized receipt. The reported live pending tip has not been
independently reconciled: the supplied hash has no indexed EVM receipt or
native explorer detail, so its native receipt block is still needed. Absence
from an index does not establish payment failure.

Validate with the focused evidence in
[room presence and tip continuity](../backlog/implementation/evidence/room-presence-tip-continuity-2026-10-18.md).
Earlier background/disconnect statements below are historical where superseded.

Netlify was observed following `main` automatically, with manually published
`dev` artifacts. This rollout temporarily selected `dev`, published tested SHA
`893418de06b9eda8379a350b3bca8912a8ebb4b8`, then restored `main` and read the
setting back. Branch deploys and PR previews remain disabled. Future `dev` merges
need an explicit Web deployment unless the owner changes that policy. Verify the
served entry SHA after each publication; merging a release record alone is not
proof that Netlify updated. Product remains independently signed and resolved.

## Playback and discovery stability follow-up — 2026-10-17

Deploy the API and signaling before the matching Web/Product clients. The API
adds `GET /api/media/:cid` as a bounded ciphertext read-through; the client uses
the existing `VITE_DOTIFY_API_URL` and keeps direct IPFS readers as fallbacks.
There is no new secret, environment variable, origin, volume or paid service.
Keep the API single-writer topology. This is a small process-local recovery
cache, not the multi-region edge delivery planned in W33.

The route accepts only the exact encrypted CID of an active release in the
current catalog. Plain audio, arbitrary URLs, asset paths, query parameters,
suffix/open/multi-range requests and unknown CIDs are refused. It sends no
credentials upstream and never accesses a content key. CORS uses the existing
origin allowlist and exposes `Content-Range` and `Accept-Ranges`. Decryption,
AES-GCM authentication and access checks stay with their existing owners.

Limits: two cold upstream reads at once (at most one complete-object read),
a 66 MiB reservation for their worst-case bodies, coalesced identical reads, a 64 MiB /
128-entry encrypted memory cache, 64 MiB per complete object, 2 MiB per range,
12 seconds per upstream attempt, three fixed gateways and a separate 64 MiB
budget for responses still being sent to slow receivers. HTTP 503 with
`Retry-After` protects overload; the client can try direct readers. Complete
DAV2 bodies are structurally validated before caching, with a 64 KiB JSON header
limit on complete objects to bound parsing work; range boundaries and
lengths are checked. Failures are not cached. Cache clearing is an API restart,
which must follow the normal active-room/session prechecks. HTTP responses use
`no-store`, since catalog eligibility is checked on every request, including
internal cache hits. The cache contains no keys, clear audio, identity or
location. Warmth is lost at restart; regional latency and load acceptance remain
W33/W30 gates. No speed or global availability guarantee follows from this patch.

Each HTTP media request subscribes to its shared cold read. A disconnected or
aborted client leaves that read; the last departure cancels upstream headers/body
delivery and releases its slot/reservation when transport settles. An abandoned
read is detached immediately, cannot populate the cache, and does not try another
gateway. Other subscribers keep their shared read. Upstream timeouts still allow
fallback while a subscriber remains. For rollout validation, disconnect one of
two clients reading the same range, then the last client: verify the survivor
receives audio, and an abandoned read does not block a new cold request.

Nearby no longer revokes a valid announcement after a transient refresh error.
It retries a fresh fix within the existing lease; it cannot extend the lease
with old coordinates. Explicit opt-out, denial, backgrounding and disconnect
still stop publication. Search results keep only their original deadlines.
Metadata-only capture updates do not invalidate discovery responses or duplicate
chat track announcements. True release changes still do both.

Rollback is the preceding client and API/signaling images, preserving the v4
privacy contract and stable API session epoch. Before release, verify the API
with Range and full ciphertext reads, rejected unregistered/plain refs, allowed
CORS origins, cold/warm and overloaded behavior. Then verify automatic recovery
and join UX in Web and installed Product Hosts. Browser fixtures do not certify
native geolocation or background audio.

The matching radar restores count-driven cover size and halo intensity. Check
arrival and departure updates in Web and Product: counts include the host,
unknown legacy counts keep neutral decoration, and visual growth is bounded at
25 connected sessions while larger exact totals remain readable. Mobile/dense
radars use smaller caps and tighter orbits; reduced-motion settings disable the
size/halo transitions. No discovery payload, service setting or access rule changes.

## Previous Product release - 0.1.56

Published after #307 merged at `b08966698709b06378349a6ffd0567cda5dc8f53`,
from clean green packaging commit `c9becc990b26949445e9af69da357c08789d4f28`.
Executable `[0, 1, 56]` and root/app CID
`bafybeieactmt5ci6iqp62foewyh7frb6gqamvo6d7hdivgy2tiyinfgn2u` preserve
`product-cdm` on `devnet`, existing permissions and the paired 13-release catalog.
The shared form viewport and sheet refinement is frontend-only. API release 28
and signaling release 36 are unchanged and were not restarted. Web independently
serves the merged application SHA above; its existing Netlify deployment was
verified rather than repeated or reconfigured.

The client rollback artifact at that rollout was **Product 0.1.55**, CID
`bafybeig5b2hue5db3oftgvjzlvb2wezslwdn7j5efj547225s4y4b5zwmy`.
Keep the existing API/signaling pair on a presentation rollback. See the
[0.1.56 rollout record](../backlog/implementation/evidence/product-0.1.56-rollout-2026-10-19.md)
for finalized root/app identity, public-byte verification, Web and bounded
native Desktop smoke. The signer is removed. On 2026-10-20, the owner confirmed
expected mobile keyboard behavior. Full device-matrix, rotation and prolonged
listening acceptance remains open.

## Previous Product release - 0.1.55

Published after #303/#304 merged at
`893418de06b9eda8379a350b3bca8912a8ebb4b8`, from clean green packaging commit
`74effe95da53394dec9394666f30d4e14bac024c`. Executable `[0, 1, 55]` and root/app
CID `bafybeig5b2hue5db3oftgvjzlvb2wezslwdn7j5efj547225s4y4b5zwmy` retain
`product-cdm` on `devnet` and the paired frozen 13-release catalog. Signaling
release 36 was deployed before the clients after a fresh zero-session check.
The compatible API remains on release 28, preserving its writer, volume,
session epoch and content-key secrets. Netlify independently serves the merged
application SHA above; its automatic branch remains `main`, so later `dev`
merges require an explicit Web deployment and served-entry verification.

See the [0.1.55 rollout record](../backlog/implementation/evidence/product-0.1.55-rollout-2026-10-19.md)
for exact service images, finalized Product/public-byte read-back and live
room checks. The local signer was removed. Physical Host permission,
background/audio and funded-tip acceptance remains open.

The client rollback artifact for that release was **Product 0.1.54**, CID
`bafybeiepuhymockmxkkqkjtjqrgak4fhlxyxjep2k7aev7mt4h45nb5csa`.
Withdrawing the background-hold policy also requires the compatible signaling
release 35 image recorded in the rollout record. Recheck active sessions before
any restart and preserve privacy-safe discovery and API state.

## Historical Product release - 0.1.54

Published after #302 merged at `02bb83595754672870d136d743509e718117faa1`,
from clean green packaging commit `0d002e373f42c5a4a03100306a58efcc9156da2d`.
Executable `[0, 1, 54]` and root/app CID
`bafybeiepuhymockmxkkqkjtjqrgak4fhlxyxjep2k7aev7mt4h45nb5csa` retain the native
Product profile and frozen 13-track catalog. API release 28 and signaling release
35 were deployed after fresh zero-session checks, before Product publication.
Netlify serves the merged application SHA independently. The API session epoch,
content-key secret digests, volume and one-machine topology were preserved.
No contract, permission, secret, origin, storage or scaling change was required.

See the [rollout record](../backlog/implementation/evidence/product-0.1.54-rollout-2026-10-18.md)
for exact images, finalized/public read-back, deployed media and discovery
checks, and remaining physical acceptance. The local signer was removed.
Product 0.1.53 was the client rollback artifact for that release. Do not restore globally
enumerating signaling when rolling clients back. A fresh-profile Web check also
found that direct `#/rooms` landed on Music; the Rooms navigation
worked, and that W19 browser-recovery routing observation is recorded without
claiming that native Host location has been repaired.

## Historical Product release - 0.1.53

Product `[0, 1, 53]` is published from source `83512f708c34304338e6a70c599d38027a9bf68c` at executable/root CID
`bafybeihj6vrdu3dqnaqfofw4l3qiysc4by4rau3mldmlom637waemgmqr4`. The client rollback recorded for that release was Product `[0, 1, 52]`, CID
`bafybeicn6kz5i5yyuoalubbe3hsl7sr7qbunccysju5rki3wrtgi2dbz7m`.
Use the [0.1.53 rollout record](../backlog/implementation/evidence/product-0.1.53-rollout-2026-10-17.md)
for the signaling image, Web identity, finalized publication read-back and remaining
device checks. Keep v4 privacy-safe signaling on client rollback.
The API now has a stable server-only `SESSION_EPOCH`; content-key secrets were preserved.
Netlify production follows `dev`, as observed in the hosted dashboard during this rollout.
The Web identities in the dated record apply to that observation, not every
later `dev` build. Each merge requires a fresh served-entry SHA/config-digest
check before candidate-bound acceptance; record that observation in the merged
PR's rollout follow-up without claiming the Product CID changed.
The dated sections below preserve historical release/rollback pairs.

## Publication and room follow-up (#269)

Product `[0, 1, 48]` was published on 2026-10-12 from tested `dev`
`fc7faf5a49e6d5b3392285bab2ee957d325b4cb6` at executable CID
`bafybeicqj4ekyiz7pmbt7ry2ixpwvpa24v5liialmhe3zwonjslt47wvna`, preserving `product-cdm` on
`devnet`. API and signaling were deployed from that same source before signed
Product publication; Netlify's merge-triggered build already served the matching
commit. Exact images, transactions, read-back and remaining acceptance are in
[the rollout record](../backlog/implementation/evidence/product-0.1.48-rollout-2026-10-12.md).

For this coordinated rollout, stage matching receipt tokens on both Fly apps
before deploying either service, then deploy API, signaling, ordinary Web and
Product. Keep one active API writer and one signaling machine. Signaling restart
clears ephemeral rooms/chat/intent links; paid tips must not be repeated.
Retain Product 0.1.47 at executable CID
`bafybeiht6sq4c3ehc3oku7fbvuonq3hbywnnwot6c5wf4jyi5pjgdgmv74` and
the pre-rollout Fly images as rollback artifacts: API
`registry.fly.io/dotify-api:deployment-01M4P0WQZB9V4DZV1G1181BG1B`, signaling
`registry.fly.io/dotify-signal:deployment-01M4K1454N8JD5TPAQBNM1KDBG`.
The matching native-receipt token is deployed in both Fly secret stores as of
2026-10-12. A live request from signaling received the trusted 300/minute quota;
the public route retained 20/minute. No token value is stored in the repository,
artifacts or this record. Keep #269 open through owner-approved metadata
activation and physical checks. No Redis service, storage mount or CORS origin
was introduced.

The browser uses `dotify-public-artwork-v1` Cache Storage for public immutable
IPFS images only: at most 48 persisted images of up to 1 MiB each. Larger
originals up to 8 MiB are accepted in memory only, with an in-memory LRU
capped at 16 MiB/48 entries, four concurrent complete-image reads and a bounded
queue. Gateway hedging waits 500 ms; attempts have an 8 s header budget and the read
has a 30 s total network budget. Cosmetic fallback after 1.2 s no longer
aborts a progressing native image download. Host storage/CORS failures retain native image
loading and bounded gateway switching. Uploaded canonical cover variants are
warmed while publication proceeds. Keys, session tokens and protected audio
are never admitted to this cache. Clearing it affects artwork speed only.

Signaling must retain `SIGNAL_CONTRIBUTION_API_URL` with its `/api` suffix,
pointing to the trusted Dotify API, and a matching chain ID. Product announcements
call its bounded native-receipt verifier with an extrinsic hash/block; clients
cannot supply trusted event logs. EVM announcements still require canonical
finalized receipts. An unbound host uses an ordinary tip with no host allocation;
its chat linkage is a server-only, bounded 30-minute intent record. Signaling
restart loses that linkage, so an already-paid tip may lack a chat announcement;
the payment stays valid and must never be repeated to restore chat.
If an account is bound but the attestor is unavailable, quoting fails rather
than silently removing that host's allocation.

Set the same randomly generated 32–256-character value as API
`NATIVE_RECEIPT_SERVICE_TOKEN` and signaling
`SIGNAL_NATIVE_RECEIPT_SERVICE_TOKEN`. Keep it in their server secret stores,
never a `VITE_` variable or a frontend artifact. Signaling sends it only in the
Authorization header to the trusted API; API logging redacts that header.
Authenticated receipt traffic has a separate, bounded 300/minute service
bucket; public and spoofed requests retain the 20/minute per-IP limit. This
changes quota identity only: every receipt still undergoes the same canonical
chain verification. Missing signaling configuration fails the announcement
without affecting an already-confirmed tip. Roll out matching tokens on both
services; coordinate rotation, and revoke/replace both values if exposed.

Editorial editing requires installing the additive `MusicMetadataPallet`
selector `musicRegUpdateMetadata(bytes32,string,string,string,string)` on each
artist runtime. This PR does not deploy or install a live facet. Deploy the new
facet from the reviewed artifact, verify its bytecode, and have the runtime owner
approve an **Add** diamond cut of that single selector with zero initializer.
Preserve the audited registry facet, storage layout and all existing selectors.
The editor checks the loupe before any upload and explains the upgrade requirement
if absent. A full development reset must likewise install this additive facet
for each new runtime; the existing factory bootstrap does not install it.
Only the original registered artist can edit title/story/metadata reference;
the expected previous reference prevents stale concurrent editors overwriting
another correction. Audio, artwork, access, NFT ownership and royalty state
remain unchanged. Capture before/after records, paid access and splits during
the owner-approved upgrade and test both Product and Web correction/read-back.

Release checks: delayed catalog convergence without resubmission; exact
runtime/hash confirmation; studio-to-listener navigation without a reload;
cold/warm cover transfer and a stalled/CORS-failed gateway; connected host and
walletless host tip quotes; native tip plus one chat announcement; reconnect and
account changes; empty queue search and explicit Browse; corrected metadata in
the artist and listener release sheets. Physical-device evidence remains W13.

## Structured release metadata rollout (2026-10-11)

PR #263 changes new artist publications from `dotify.track.v1` to the strict
`dotify.track.v2` manifest. It introduces no environment variable, secret,
contract or catalog-read-model change, but the API upload validator and both
ordinary/Product frontend bundles must be deployed from the same commit. Pause
test publishing during the rollout, deploy the API validator, publish the web
and Product bundles immediately afterward, then reopen installed Hosts before
publishing the first v2 release.

The coordinated Product release is `[0, 1, 47]`, published from tested `dev`
`1075800ea1e60acaa05923c966d4ed498448cb92` at executable CID
`bafybeiht6sq4c3ehc3oku7fbvuonq3hbywnnwot6c5wf4jyi5pjgdgmv74`. The
version bump refreshes cache-sensitive room controls, the artist publishing
flow, and the listener release sheet. The release preserves `product-cdm` on
`devnet`; no contract or signaling deployment was required. Product 0.1.46 is
the rollback artifact while installed-host and physical-device checks remain
open.

The API was deployed first and `/version` returned the exact release SHA. Its
health and Netlify CORS checks passed. Netlify then served a bundle containing
the same SHA. Bulletin finalized the stable upload at block `1169320` in
transaction `0x52a4948882fe0def1869d466894d3d140290a2f361474a2d0e1781d43ea43f0b`
and the full-CAR root at block `1169323` in transaction
`0x23bc505a62c99b770322a2c45b00406218b52226c881e34b3a6535c8357183ed`.
All 25 content nodes reached finality. DotNS content linking finalized at Asset
Hub block `14311095` in transaction
`0x676701b6560840052e842effce63e81506fc471ca538ea675d5a747ac5db0be7`;
the executable manifest update finalized in transaction
`0x5b091dcd24e179aba50b7b8ddea172c309f3845f404c47ff7bbbfa4682b2444b`.
P2P retrieval passed in 44 ms. An independent public gateway read returned the
14,623,653-byte CAR and found the exact source SHA and release entry bundle.

This construction-phase rollout assumes the owner-approved development-data
reset. Do not claim that old prose was migrated: rich release facts appear only
after a track is republished with v2 metadata. Smoke one artist publication with
an album/project, year, two genres and one contributor; reopen it from the
listener catalog and confirm that the story, facts and credit load from IPFS,
while access price and recipients still match the runtime. Rollback requires
the prior API and frontend together; reset releases created with v2 before
returning to a v1-only frontend.

## Room life and artist visits (2026-10-10 candidate)

The published Product `[0, 1, 46]` release creates a reusable artist session
on explicit announced entry when none exists, and fixes chat/suggestion loss
under fetch-polling backpressure. It was published from tested `dev`
`e5d92b5af2a8f9c2b9860db8d0ee91163c2f08b3`. This was a frontend-only rollout; the
existing signaling acknowledgement and registry-verification paths are reused.
It also restores the native Product payment profile: `.env.product-devnet`
explicitly selects `product-cdm` and `devnet`. The Product build refuses missing,
EVM-only or wrong-chain adapter settings. Release 0.1.45 used the default viem
profile, causing Product tips to request an EVM wallet before submission. Existing
pending receipts remain intact; this correction must not resubmit a payment.

Release 0.1.46 deployed only the Product frontend. Signaling was already
deployed for the earlier room-life rollout and was not redeployed with 0.1.46.
No contract, database, content-key or upload migration was required. Events
and optional join fields are additive; old clients can still join. A new client
explicitly reports an ordinary join if an older server cannot confirm its
requested artist announcement.

Artist verification reuses `SIGNAL_CONTRIBUTION_API_URL`,
`SIGNAL_CONTRIBUTION_RPC_URL`, `SIGNAL_CONTRIBUTION_CHAIN_ID` and
`SIGNAL_CONTRIBUTION_DIRECTORY`. They must identify the same API/network as the
frontend session. The attestor private key is not needed for artist badges.
Missing verification services fail the announcement; the explicit announced
Join action can create a reusable session when the connected artist has none.
Anonymous entry remains available. No new frontend secrets or environment variables.

Smoke with two guests and one artist: typing expires without transmitting drafts;
short reconnects avoid duplicate activity; only the host can pin; the dashboard
follows start/pause/track changes; discreet entry is the default; announced entry
uses registry labels; wrong-account and stale-session announcements fail. Verify
Product Desktop and Mobile entry without a new signature while the session is
valid. Inspect `/status` for absence of private social state and continuity tokens.

Social history and pending continuity die with the room or service restart.
For the 0.1.46 rollback, restore only the prior Product frontend artifact;
signaling remains on its current deployed version. No durable data needs
rollback. Counts are connected sessions, not historical listens. See the
[protocol and trust boundaries](../explanation/room-life-and-artist-visits.md).

This runbook is the operator checklist for Dotify's hosted configuration across
Netlify, Product DevNet, and Fly.io. Use it when changing dashboard values, deploy contexts,
`*.toml` settings, hosted origins, secrets, catalog persistence, or production
smoke settings.

## Maintenance Rule

Every PR that changes deployment configuration must check this file.

Update this runbook, or state why no update is needed, when a change:

- adds, removes, renames, or changes the meaning of an environment variable;
- changes `netlify.toml`, `services/api/fly.toml`, `web/fly.signal.toml`, or any
  `.env.example` file;
- changes a public app URL, CORS origin, gateway, RPC endpoint, contract
  address, deploy context, storage mount, scaling setting, or health check;
- moves a value between frontend, backend, signaling, or contract deployment
  responsibility;
- changes the production safety guard, catalog read model, upload path, content
  key boundary, or room-signaling behavior.

Keep this document aligned with
`docs/reference/environment-variables.md`, `web/README.md`, the relevant
`docs/backlog/XX-*.md` ticket, and the hosted dashboard state.

## Playback synchronization verification

The [room clock fix](../explanation/room-playback-synchronization.md) changes
signaling behavior without new configuration or storage. Release the signaling
server and ordinary/Product frontend builds together for fresh late-join
snapshots and pause silencing; refresh host and guest clients. Rollback uses the
previous builds and requires no migration.

After release, join halfway through a track from a second device, seek in both
directions, and repeat pause/resume while comparing the two progress indicators.
Confirm silence during pause and continued sound after resume. Test foreground,
background, and relay-only paths: a missing playing update for 2.5 seconds now
silences guest output and shows "Syncing with host" until fresh state arrives.
A late join must show the same interrupted state, not "Host paused". Also seek
while paused with a busy signaling transport: the forced command must arrive
after the transport drains, without requiring playback to resume.
Record device/browser and drift; local Chromium coverage does not establish
physical-device acoustic synchronization.

Product candidate `[0, 1, 29]` adds local host-output gating, paused track
switching, source retirement, and mobile room color parity. These fixes need
only updated ordinary/Product frontend bundles; no additional signaling, API,
CDM, or contract deployment is needed. After publishing, reopen Dotify in the
mobile host, play A, pause, choose B, and confirm silence until Play starts B.
Repeat Previous/Next, background/foreground, and the same sequence with a room
guest. Compare the same room and track on desktop/mobile. Record the actual
build SHA, CID, Product/OS/device versions and results; automated WebKit tests
do not certify the physical host. Rollback republishes the prior frontend.

## Hosted Surfaces

| Surface          | Host                                  | App/project         | Source config                                                  | Purpose                                           |
| ---------------- | ------------------------------------- | ------------------- | -------------------------------------------------------------- | ------------------------------------------------- |
| Frontend         | Netlify                               | `muzinga`           | `netlify.toml`                                                 | Static Vite web app                               |
| Product frontend | Bulletin + DotNS                      | `dotify-test01.dot` | `web/.env.product-devnet`, `web/polkadot-app-deploy.config.ts` | Product-host static app                           |
| Backend API      | Fly.io                                | `dotify-api`        | `services/api/fly.toml`                                        | Uploads, key delivery, catalog read model, health |
| Signaling        | Fly.io                                | `dotify-signal`     | `web/fly.signal.toml`                                          | Socket.IO room discovery and WebRTC signaling     |
| TURN relay       | Managed provider or self-hosted relay | TBD                 | Backend `TURN_*` env                                           | WebRTC media relay for restrictive networks       |

Production URLs currently assumed by the app and docs:

```txt
Standalone:          https://muzinga.netlify.app
Product public URL:  https://dotify-test01.dev-dot.li
Product Host origin: https://dotify-test01.app.dev-dot.li
Product Host dot.li: https://dotify-test01.app.dot.li
Product mobile origin: https://dotify-test01.dot
Product mobile native: polkadot://dotify-test01.dot
Backend API:         https://dotify-api.fly.dev
Signaling:           https://dotify-signal.fly.dev
Product IPFS:        https://devnet-ipfs.api.polkadotcommunity.foundation
Track asset IPFS:    https://gateway.pinata.cloud, https://ipfs.io, https://dweb.link
Asset Hub RPC:       https://eth-rpc-testnet.polkadot.io/
```

Use the exact current frontend origins for CORS and signaling values. Do not
include a trailing slash. The Product URL visible in the browser remains
`dotify-test01.dev-dot.li`, but the Host executes the Product inside an HTTPS
iframe whose requests carry `Origin: https://dotify-test01.app.dev-dot.li`.
Product host requests have also been observed from
`Origin: https://dotify-test01.app.dot.li`, and Product mobile host webviews can
carry `Origin: https://dotify-test01.dot` or
`Origin: polkadot://dotify-test01.dot`. Allow all observed exact Product
origins; keep `VITE_PUBLIC_APP_URL` on the public URL so shared room links do
not expose the internal execution origin.

## Security Boundary

The frontend is a public Vite bundle. Any `VITE_*` value can be read by users.

Set only browser-safe values in Netlify. Never set these in Netlify production
or deploy-preview contexts:

```txt
VITE_PINATA_JWT
VITE_CONTENT_SECRET
```

Keep production upload and key material server-side on Fly:

```txt
PINATA_JWT
CONTENT_KEY_MASTER_SECRET
CONTENT_KEY_MASTER_SECRETS
CONTENT_KEY_ACTIVE_VERSION
```

`CONTENT_KEY_MASTER_SECRET` is the compatibility secret for existing v1/v2 key
derivation. `CONTENT_KEY_MASTER_SECRETS` is the optional retained version map,
and `CONTENT_KEY_ACTIVE_VERSION` selects which version encrypts new backend
uploads. Do not remove an old version until every release encrypted with it has
been re-encrypted and republished; the API fails closed instead of guessing a
different secret.

## Netlify Frontend

Dashboard:

```txt
https://app.netlify.com/projects/muzinga/overview
```

Open the project, then use `Project configuration` -> `Environment variables`.
Netlify environment changes require a new build and deploy before the Vite app
uses them.

Build settings for the repo-root Netlify site:

| Setting           | Value                                                                 |
| ----------------- | --------------------------------------------------------------------- |
| Base directory    | `web`                                                                 |
| Build command     | `npm run build`                                                       |
| Publish directory | `web/dist` in the UI, equivalent to `dist` relative to `base = "web"` |
| Node version      | `22`                                                                  |

Required production variables:

| Key                       | Value                                                                                    | Notes                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `VITE_DOTIFY_DEPLOYMENT`  | `production`                                                                             | Enables fail-closed production env validation.                   |
| `VITE_DOTIFY_HOST_MODE`   | `off`                                                                                    | Prevents the standalone build from probing Product host APIs.    |
| `VITE_SIGNAL_URL`         | `https://dotify-signal.fly.dev`                                                          | Public Socket.IO signaling origin.                               |
| `VITE_DOTIFY_API_URL`     | `https://dotify-api.fly.dev`                                                             | Backend API for uploads, key delivery, and cached catalog reads. |
| `VITE_PINATA_GATEWAY`     | `https://gateway.pinata.cloud`                                                           | Primary browser read gateway for Pinata-backed track assets.     |
| `VITE_IPFS_READ_GATEWAYS` | `https://ipfs.io,https://dweb.link,https://devnet-ipfs.api.polkadotcommunity.foundation` | Ordered fallback gateway list.                                   |

Optional production variables:

| Key                            | When to set                                                                                                                                                            |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_DOTIFY_DEBUG_PANEL=true` | Temporary operator smoke checks plus first-sound, Product CDM, and room evidence exports under `You -> Production readiness`; unset for ordinary listener deployments. |
| `VITE_TURN_URL`                | Browser-visible TURN fallback for DevNet/static credentials. Prefer API grants for production. Accepts comma-separated `turn:` / `turns:` URLs.                        |
| `VITE_TURN_USERNAME`           | Static fallback only. Do not use long-lived production credentials here.                                                                                               |
| `VITE_TURN_CREDENTIAL`         | Static fallback only. Do not use long-lived production credentials here.                                                                                               |
| `VITE_ETH_RPC_URL`             | Override the default Paseo Asset Hub EVM RPC. Must be HTTPS in production.                                                                                             |
| `VITE_WS_URL`                  | Override the default Polkadot WebSocket RPC. Must be WSS in production.                                                                                                |
| `VITE_BULLETIN_WS_URL`         | Override the default Product DevNet Bulletin RPC. Must be WSS in production.                                                                                           |
| `VITE_BLOCKSCOUT_BASE_URL`     | Override explorer links. Must be HTTPS in production.                                                                                                                  |

Deploy-preview note:

Netlify deploy previews usually have their own origin. The signaling service
and backend both allow multiple exact origins with `SIGNAL_ORIGINS` and
`API_ORIGINS`. Add only the specific preview origin needed for evidence, then
remove it after validation. Never use `*` on the backend.

## Product DevNet Frontend

The browser-safe Product build profile is tracked in
`web/.env.product-devnet`. The manifest is
`web/polkadot-app-deploy.config.ts`.

Required Product values:

| Key                             | Current value                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| `VITE_DOTIFY_DEPLOYMENT`        | `production`                                                                              |
| `VITE_DOTIFY_HOST_MODE`         | `required`                                                                                |
| `VITE_DOTIFY_PRODUCT_ID`        | `dotify-test01.dot`                                                                       |
| `VITE_PUBLIC_APP_URL`           | `https://dotify-test01.dev-dot.li`                                                        |
| `VITE_DOTIFY_API_URL`           | `https://dotify-api.fly.dev`                                                              |
| `VITE_SIGNAL_URL`               | `https://dotify-signal.fly.dev`                                                           |
| `VITE_DOTIFY_ROOM_BEACONS`      | `off`                                                                                     |
| `VITE_DOTIFY_ROOM_REALTIME`     | `off`; `observe` or `dual` only for an authorized Product measurement candidate           |
| `VITE_BULLETIN_WS_URL`          | `wss://bulletin-paseo.tservices.es:8443`                                                  |
| `VITE_PINATA_GATEWAY`           | `https://gateway.pinata.cloud`                                                            |
| `VITE_IPFS_READ_GATEWAYS`       | `https://ipfs.io,https://dweb.link,https://devnet-ipfs.api.polkadotcommunity.foundation`  |
| Product executable `appVersion` | `[0, 1, 58]` streaming reset; pre-reset clients are historical, not a standalone rollback |

The Product executable version is part of the published Product manifest. Bump
it whenever the Product bundle changes runtime behavior, host SDK integration,
permissions, metadata, or cache-sensitive assets. A new CID alone proves the
bundle changed on-chain, but the mobile host can still use executable metadata
when deciding whether to refresh a previously opened app.

The 2026-10-10 owner report establishes a connection incident on Desktop 0.1.3
and mobile 0.10.0 after the 0.1.44 rollout. Published recovery release
`[0, 1, 45]` restores the previous SDK family and pins TruAPI 0.13.1 (codec 1).
The 0.1.44 bundle uses codec 3; mock identity tests did not exercise that wire
boundary. Confirmation on both reported devices remains required. Preserve
existing account derivation, access and pending-contribution storage; no server
or contract migration is required.

Version `[0, 1, 46]` was published on 2026-10-10 from clean, tested `dev`
`e5d92b5af2a8f9c2b9860db8d0ee91163c2f08b3`. It restores the explicit
`product-cdm`/`devnet` profile for native Product payments, opens a reusable
artist session on explicit announced entry when needed, and makes chat and
suggestions survive connected fetch-polling backpressure. Ordinary web retains
viem; Netlify's entry bundle was checked against the same source SHA. API,
signaling and contracts were not redeployed.

The executable CID is
`bafybeif3sjmbjz3hmpcnozz2btkewimxr3a4xy5pjia47pxgqfe636voty`.
Bulletin finalized the stable upload at block `1159609` in transaction
`0x948a75fe6a73827203d8958df9210faaab0afc9d54c8dae68fa739108ac97003`
and the full-CAR root at block `1159612` in transaction
`0x4255259f8134c7a0edc5f23a9ede4b8484e28e26aa1ac17ac95318de786ea7a0`.
All 24 content nodes reached GRANDPA finality. Content linking finalized at
Asset Hub block `14274629` in transaction
`0xc3724b5ccb63d0d5be278bcafd53d3d1dd4d2db9e66dc99c9ee9b9e96dfc3f3f`;
the atomic executable manifest update finalized in transaction
`0x59fa755d7761c39ef21a8f658f61ef3266eba8ebeb0f7da111233a0831d60acd`.
P2P retrieval passed in 44 ms. Independent public gateway read returned the
14,599,935-byte CAR and matched all 77 files against the published local build.
Remote Config matched before and after publication.
The public Product wrapper loaded the application frame without page errors;
the served entry bundle embeds the exact source SHA, `[0, 1, 46]` and
`product-cdm`. Installed Desktop/mobile
announced visits, native tips and room-chat recovery remain physical-device
acceptance. The preceding 0.1.45 artifact is the immediate rollback target,
but it has the documented EVM-wallet-only Product payment regression.

Version `[0, 1, 45]` published the reviewed Product Host connection recovery,
room-presence UX and artist live-room changes on 2026-10-10 from clean, tested
`dev` merge `b45c2f700c2c36eed06d23dad2ea51c917842c80`. The executable CID is
`bafybeicrl7vkxowvwddmptksezhzvop7xwxl7mwk6ptoxxtdwsmfn5mcfq`.
Bulletin finalized the stable upload at block `1156565` in transaction
`0x7d8ece12c78b1a0540b758f08a78c576c9ed74e539ec690e5c928fee4197f0a9`
and the full-CAR root at block `1156568` in transaction
`0x3f6a39805b3d273320a08ea2ac5b66ce8980509dd9300c3153c448edf57e6680`.
Content linking finalized at Asset Hub block `14262803` in transaction
`0x8047c3404e54d4e991b3eebe7284c8ae9a69824c1f3615ab2410a3bd48676da8`;
the atomic executable manifest update finalized in transaction
`0x5ec4f5f72bc55d9eeea7174f1b6c9b7db6e6976318fe9b91f7185687d8b5adf4`.

All 14 content chunks reached GRANDPA finality and P2P retrieval passed in
1,857 ms. The public Product wrapper resolved the new executable and loaded the
app frame from `dotify-test01.app.dev-dot.li` without browser errors. Product
Remote Config checks before and after publication matched the pinned DevNet
registry and content resolver. The coordinated signaling deployment runs image
`registry.fly.io/dotify-signal:deployment-01M4K1454N8JD5TPAQBNM1KDBG`
(manifest digest
`sha256:aab04e153a410972ed7116426911980f440fceb0e6d043814f81d7236cc58631`);
health and the configured ordinary/Product origin smokes passed. The API and
contracts were not redeployed. Reopen the installed Hosts, verify version
0.1.45 and source SHA, then capture connection, signing, protected playback and
room behavior on Desktop 0.1.3 and mobile 0.10.0 before closing compatibility
epic #85. Version 0.1.44 remains the rollback artifact.

Version `[0, 1, 44]` published the October 2026 Product SDK/Host compatibility
alignment on 2026-10-09 from clean, tested `dev` merge
`97bf831679a5cfb1177d62475907625e40a8ebaf`. This was a frontend-only release;
the API and signaling services were not redeployed. The executable CID is
`bafybeihcn3ffl5aveabuaukuloaje5ckyhgklhrfxtmkf3w77yupfkekg4`.
Bulletin finalized the stable upload at block `1149269` in transaction
`0x450a6ea545445d055e5d655d9ec1f8e78d16359ac0a232e33c89ebe6be051cfc`
and the full-CAR root at block `1149272` in transaction
`0xe3cc643d9123121fb618b4475f447f2e3c2cae9baaf20701098d8b67981340f7`.
Content linking finalized at Asset Hub block `14233097` in transaction
`0xd98a58dc9bea93a84acebd80a6902996cbf3065d751392a415a19948c7131c68`;
the atomic executable manifest update finalized in transaction
`0xb281118d7f2578927c0f709038eaf661c63a7f21dbf35889b33ffb00105c0cd5`.

All 14 content chunks reached finality and the deployer's P2P retrieval passed.
A separate public DevNet gateway read returned a 5,821,636-byte CAR whose 26
files all match the frozen local build byte-for-byte. Its entry bundle contains
the full deployed source SHA and Product `[0, 1, 44]`. Remote Config checks
before and after publication matched the pinned registry and content resolver.
Installed-host refresh and real Product Desktop/Web account connection,
signing, protected playback, and room creation/joining remain live acceptance
work for compatibility epic #85.

Version `[0, 1, 43]` published the merged playback-continuity, scoped room-tip,
UX clarity and reusable listening-session changes on 2026-10-09 from clean
candidate `c394c2354b128f5bb71cc039142835450ae210f6`, based on tested `dev`
merge `3183de87d4ab90b74e889fae4c317c2b1dc97d2d`. This was a frontend-only
release; the API and signaling services were not redeployed. The executable CID
is `bafybeid6izin3sjhmeb7yrslf4snerngjmt4ttt5tsysazf7vju5h3gpkq`.
Bulletin finalized the stable upload at block `1147924` in transaction
`0x32d6f14c8fa24828341f2a4dac829a50cfb5270c4b30d0373934c823d58c132c`
and the full-CAR root at block `1147928` in transaction
`0x25a17aaaf896cd9a1f788ca4f7bdc6ace64582d3a3d094fde83e2cad906fc4db`.
Content linking finalized at Asset Hub block `14227528` in transaction
`0x0842921760de6896a1475ac90e914e3a4b807428949a1e48f18959e4eb29a56a`;
the atomic executable manifest update finalized in transaction
`0xadecfa8c78dbb042f6605588097b676523652bef83304947d5273af0290c2276`.

All 14 content nodes reached GRANDPA finality, the deployer's P2P retrieval
passed, and a separate public gateway read returned a 5,766,617-byte CAR. That
CAR contains the exact local `index.html` bytes and the full candidate source
SHA. The pre- and post-publication Product Remote Config checks matched the
pinned registry and resolver. An initial preflight stopped before upload because
the shared Bulletin pool authorization had expired; after the operator renewed
pool account `5DDa6Wx3AV7UNCF7rf7dvHuU29Q6scojoQMohpMnCUiQN7BJ`, the clean
candidate published successfully. Installed-host cache refresh, prompt counts
over real protected tracks, long-session audio continuity and host/guest room
behavior remain physical-device acceptance work.

Version `[0, 1, 42]` published the merged room-tip metadata recovery on
2026-10-07 from clean candidate
`42661dafe9740e19d46121e7de5f29c481904380`, based on tested `dev` merge
`ac9f05c75609113c3734d98ffde1b1629d894fd2`. This was a frontend-only release:
the API remains on its verified 0.1.41 candidate and its persistent contribution
ledger was not redeployed. The executable CID is
`bafybeie672slb6kaqlo7hydj3tvqdynvzkge2eg2kmy4q7wsess52wg3uq`; content linking
finalized at block `14155468` in transaction
`0x118f540e550821486f89e0f008e47900d065b6394cec2ceeeaba9aab8a977af3`, and the
atomic executable manifest update finalized in transaction
`0xbe0b46e2b8343f1f1d37dfb1448a109bacc809a8a3b625db667b3445837b897a`.
Independent read-back at 2026-10-07 22:59 Europe/Paris confirmed finalized
version `[0, 1, 42]` and matched the public CAR's `index.html` and entry bundle
to the local build, including the candidate source SHA. All 25 content nodes
reached GRANDPA finality and P2P retrieval passed. The Bulletin pool allowance
was reported as exhausted, so uploads ran in best-effort queue mode; inclusion,
content integrity, root finality and read-back all completed. Installed-host
cache refresh and a physical host/guest room-tip check remain separate live
acceptance evidence.

Version `[0, 1, 39]` moves historical native gift/tip receipt reads to the
Dotify API. The installed Product host SDK bridge accepts `chainHead_v1_*`,
`chainSpec_v1_*` and `transaction_v1_*`, but rejects the legacy historical RPC
methods used by the 0.1.38 reader. A direct archive test therefore did not prove
that reader usable inside the mobile host. The API now supplies
`POST /api/contributions/native-receipt` using a server-configured native archive
URL; the frontend uses the existing `VITE_DOTIFY_API_URL`. Writes still use the
Product signer, while receipt checks never create a signer.

The API pins the Paseo Asset Hub genesis, loads metadata at the requested block,
and verifies the canonical finalized block, exact Blake2-256 extrinsic hash,
phase-specific System dispatch outcome and `Revive.ContractEmitted` records.
The frontend binds the response to the expected network, transaction and block,
then checks runtime, work, intent ID, payer and amount. Archive errors keep the
journal pending; only a verified native dispatch failure may release it.
Technical details now show the latest check error alongside the original error.

Version `[0, 1, 39]` was published on 2026-10-06 from clean commit
`c698b1c7b9b83e813c68fb902de62696b67e25a6` with the `product-cdm` profile,
after deploying the API from that same commit. The public API `/version`,
`/health`, configured Product HTTPS CORS preflight and a known historical native
receipt were checked successfully. The published receipt logs matched the
independently verified historical native events, including the paid-share event.
The executable CID is
`bafybeiglfaqtudp27j3hwqv3qvgelknfrbt7melueuic4tqh7wrogvqlia`; its atomic
manifest update finalized in transaction
`0x463499d3e54d7046129ced609b1d6ad64a04e0e0bca38734d358236f7b871f0a`.
Read-back at 2026-10-06 23:08 Europe/Paris confirmed `[0, 1, 39]`, its CID and
the public CAR's index/entry bytes against the built artifact, including the
source SHA. Host configuration checks passed before and after publication.
Validation passed: 785 frontend unit tests, 160 API tests and 22 gift/tip browser
tests, including real HTTP-client recovery and archive-error display without
resubmission. Type checks, the Product build and lint passed; lint excluded
ignored local diagnostic archives and reported two pre-existing App hook
warnings. Recovery inside the installed mobile host still requires live-device
confirmation; no new funded tip was submitted during this investigation.

Version `[0, 1, 38]` introduced block-reference capture and manual recovery for
older journal entries, after native `Revive.call` events were found absent from
the EVM log index. Those journal and proof invariants remain, but its historical
host RPC transport is superseded by the API transport above.

Journal entries with a native hash but no usable SDK block reference can enter
the block number from `View transaction` under Technical details → `Receipt block
number` → `Check receipt block`. This is a locator, never trusted payment proof:
wrong blocks, wrong extrinsics, changed block hashes, missing dispatch outcomes
and mismatched receipts keep the intent pending. Proven finalized native dispatch
failures can release it. Entries lacking a native hash remain unresolved; do not
resubmit based on an absent Ethereum event. A valid finalized transaction hash
is preserved even when optional SDK block metadata is absent or malformed;
the receipt then remains pending until a verified block locator is supplied.
This PR #242 review fix requires a later frontend publication and is not included
in the previously published 0.1.39 artifact. New payments capture usable block
references automatically. Full cross-device native earnings/history indexing is
still separate work. Version `[0, 1, 38]` was published on 2026-10-06 from clean
commit `99d51aa42f9ac9acef93780773e9953e8474a492` with the `product-cdm` profile. Its executable CID
is `bafybeihydvxrlzv2d4kpnjrellwntsvt5ifo2fkfh7frlvq3ngrobxltwi`; the atomic executable update finalized in transaction
`0xae364b1b290b8815fc0771014cbb912080f79e20b5571b3927bb588c2cee2ea7`. Independent read-back at 2026-10-06 21:51 Europe/Paris confirmed
the finalized version/CID and compared the public CAR's index/entry bundle with
the built artifact, including its source SHA. Host configuration checks passed
before and after publication. Mobile replay and a new funded mobile submission
still need live-device evidence; the historical native receipt itself was
verified directly on-chain.

During diagnosis on 2026-10-06, an owner-supplied pending tip was independently
verified directly from historical Asset Hub native storage, with matching
contribution and paid-share events. The corrected reader was then run on that
same historical block and recovered the matching receipt. Explorer data was
used only to locate the block; the native chain verified its hash, extrinsic and
dispatch. User-specific references, amounts and raw proofs remain in ignored
local diagnostic artifacts. This receipt check does not establish full native
ledger indexing or receipt-verified room-chat broadcasts; the signaling verifier
still needs a native-event receipt path for those broadcasts.

Version `[0, 1, 37]` packages the bounded pending-contribution reconciliation
merged in PR #239, which did not increment the executable version. During the
subsequent timeout investigation, an installed Product Desktop session reported
`[0, 1, 36]` / build `9c2a476`, predating that fix. This observation does not
establish which build is loaded on mobile or why its payment timed out.

After an authorized CDM-profile deployment, check the loaded executable version
**and build SHA** under You → Production readiness on each device. A merge to
`dev`, a successful build, or an updated manifest is not proof that the host
loaded the new bundle. Preserve local pending-contribution storage, reopen the
same gift/tip with the paying account, and use `Check status again` without
resubmitting. If it remains pending, record whether host approval appeared,
the Technical details error, loaded version/SHA, and any transaction reference
before diagnosing submission versus finalized-event read-back. Do not treat a
timeout or an absent event as proof of a failed payment.

Version `[0, 1, 37]` was owner-authorized and published on 2026-10-06 from clean
commit `1193a73951edaa6d132e07625fcb6a8e4010395c`, with the `product-cdm` writer
profile. The executable CID is
`bafybeiab765lpxm344uokugwsvghjypv4i4h3eobinrylougzpi3orci3a`. The atomic
executable contenthash/manifest update finalized in transaction
`0xfd81a340aa79ba1dfa5dd0f300e25c767477808153bc4524d2edf51f9f5f7a0a`.
Independent read-back at 2026-10-06 21:22 Europe/Paris verified the finalized
`app.dotify-test01.dot` version/CID and compared `index.html` and the entry JS
byte-for-byte with the built artifact inside the 14,576,359-byte CAR served by
the configured gateway. The entry identifies the same source SHA. The host
Remote Config preflight and post-publication check both passed. This proves
publication and artifact availability; installed mobile cache refresh and a
funded mobile tip still require live validation. Preserve the existing pending
intent and reopen it after checking the loaded SHA/version; do not submit a
second tip to diagnose the first.

A subsequent mobile report stayed on `Checking network finality` after approval,
with no accessible Technical details. That label exists in PR #239, so the
Desktop stale-build observation cannot explain the mobile report on its own.
The `[0, 1, 37]` candidate also preserves the first uncertainty error in the
existing local contribution journal and exposes it, together with the intent
reference, during pending checks. Empty event reads and later RPC failures no
longer erase that diagnostic. Without a wallet transaction reference the label
is `Checking payment status`; a finalized Product extrinsic awaiting its EVM
contract event is `Checking contribution receipt`. These labels do not establish
submission, failure, or settlement. This correction makes the unresolved host
failure diagnosable; it does not constitute funded mobile payment evidence.

Version `[0, 1, 36]` invalidates the Product host cache for finalized tip
read-back. It filters contribution logs by concrete indexed topics because the
DevNet EVM RPC rejects null topic placeholders; the matching intent must still
have a finalized on-chain event before Dotify reports success. Preserve any
pending contribution journal before clearing an older host cache.
Version `[0, 1, 34]` invalidates Product host caches for the verified room-tip
affordance introduced after `[0, 1, 33]`. Version `[0, 1, 33]` prepares the
artist earnings/workspace, native contributions, and Product CDM named-result
decoding correction. This is a package version, not evidence of deployment or
a real contribution. No existing Celerity or contribution activation default
changes with this correction.
Version `[0, 1, 32]` identifies the separately authorized W27 correction
candidate that retains observers after an uncertain publish and bounds later
private mirrors in a ten-second FIFO. Enable
`VITE_DOTIFY_ROOM_REALTIME=dual` and `VITE_DOTIFY_DEBUG_PANEL=true` only for
that measurement deployment; the tracked defaults remain off. This version is
not evidence of real Product delivery or approval of a transport migration.
Version `[0, 1, 31]` is the earlier mobile-panel candidate whose publish timeout
stopped the observer. Version `[0, 1, 30]` is the console-only W27 candidate; it
supports the observers and paired capture API but predates the mobile panel.
Version `[0, 1, 29]` fixes host pause/source ownership and restores the desktop
room palette on mobile. It retains `[0, 1, 28]` room-authorized TURN credential delivery and an
independent IPFS fallback for full encrypted-audio recovery. The version bump
gives Product hosts an explicit cache-refresh signal for these playback and
room reliability changes. It retains the `[0, 1, 27]` single-dialog Classic
support handoff and the `[0, 1, 26]` candidate-bound
first-sound evidence, independent exact-profile budgets, fresh warm-resume
attempts, and terminal autoplay failures, plus the `[0, 1, 25]` Product room
evidence capture and rejection of
hand-written room claims without current host transport telemetry, plus the
`[0, 1, 24]` bounded Web Worker for DAV2 AES-GCM chunk decryption and the
fail-closed main-thread Web Crypto path when a worker cannot start within 1.5
seconds. It also retains the `[0, 1, 23]` behavior that defers Product CDM chain
setup until an authoritative runtime read and uses the known DevNet PAS label
without an initial direct EVM
RPC lookup, so opening a shared room remains independent of Product Web's
current Host-protocol mismatch. It retains the `[0, 1, 22]` native extrinsic
proof links and the `[0, 1, 21]` Product CDM payment-unit fix by converting the
18-decimal Solidity amount into the connected chain's native `Revive.call`
Balance precision. It binds Product payment and room evidence to the same
deployed CID and carries the Product room guest audio recovery fix, the W05
royalty claim runtime writer path, the September 2026 Product DevNet
tooling/CDM registry refresh, the re-pinned Bulletin descriptor, and the viem
release-registration confirmation hardening for dropped or still-pending wallet
hashes, plus the W06 removal of passkey-only wallet routes from the public
Product and standalone account flows, W07 key-versioned protected audio refs,
and, historically, the W14 optional 3D renderer. That renderer and its dependency
are retired in the 2026-10-28 source update; Radar and List remain.

Product Host compatibility candidate, checked 2026-10-23 (not yet published):

| Package                               | Candidate value | Boundary                                                    |
| ------------------------------------- | --------------- | ----------------------------------------------------------- |
| `@parity/product-sdk`                 | `0.39.0`        | Latest compatible release for the observed TrUAPI 0.25 Host |
| `@parity/product-sdk-host`            | `0.28.0`        | Same 0.25 protocol family                                   |
| `@parity/product-sdk-statement-store` | `0.7.3`         | Matched SDK release                                         |
| `@parity/product-sdk-descriptors`     | `0.14.0`        | Product PAPI 3 descriptors                                  |
| `@parity/product-sdk-tx`              | `0.5.3`         | PAPI 3 transaction lifecycle                                |
| root `polkadot-api`                   | `^1.23.3`       | Existing `@polkadot-apps` Bulletin/legacy callers only      |
| `@parity/truapi` override             | `0.25.0`        | Codec 3, schema `3c45e49b26c1ab97`                          |
| `@parity/polkadot-app-deploy`         | `0.20.0`        | Publication tooling unchanged                               |
| `engine.io-client`                    | `6.6.6`         | Room transport unchanged                                    |

Keep the Product SDK packages pinned exactly during hardening. Installed
Desktop Dev 0.1.4-rc.3 embeds TrUAPI and truapi-host 0.25.0; Dotify's published
0.13.1/codec-1 dependency cannot communicate with it. SDK 0.40.0 instead requires
TrUAPI 0.26 with a different schema even though its codec number is also 3.
Pinning only a codec number or upgrading to npm `latest` is insufficient.
The October 10 codec-1 recovery above remains historical evidence for the old
Desktop 0.1.3 Host, not the target of this candidate.

Root PAPI stays on the existing line for `@polkadot-apps` chain-client/keys/signer.
The Product SDK resolves its own PAPI 3.2.x graph; do not force the legacy root
version into Product SDK packages. The SDK's PAPI-3 `createSubmitAndWatch` /
`inBestBlock` lifecycle is exercised by the factory finality regression. Keep
`withProductPeakStorageDeposit`: SDK contracts 0.11.3 still sizes from net charge
without that adaptation. No account derivation, genesis, contract/CDM address,
policy, receipt journal or nonce state changes are part of this update.

A new reviewed Web/Product bundle is necessary to activate the dependency change;
no server or contract redeployment is required. Do not reset artist runtimes or
clear account storage to repair a protocol decoder failure. Real Desktop/mobile
connection, same-account continuity, signing, room permissions and protected
playback remain acceptance gates. The owner reports mobile 0.10.0 (18) also
fails; its exact embedded TrUAPI build has not been independently verified.
See [diagnosis and validation](../backlog/implementation/evidence/product-host-0.1.4-2026-10-23.md).

W27 adds `VITE_DOTIFY_ROOM_REALTIME`, default off. It requires a Product host
mode and observes aggregate room presence plus encrypted social mirrors;
Socket.IO remains authoritative. `dual` publishes presence from hosts and
server-accepted reactions, short chat and requests from Product participants.
It must not be enabled as a default
until two-client Product evidence is reviewed. Build an offline validation
artifact with `VITE_DOTIFY_ROOM_REALTIME=dual npm run build:product-devnet:frozen`;
this command does not publish it. Rollback is a build with the flag off. Stop
or reload active observation sessions; published presence expires after 30
seconds (private social mirrors: 10 seconds) and observer data is held in memory
only. The private path needs the updated signaling server for membership-bound
ephemeral public-key registration and revocation. No new server flag, production
secret, database or contract is required. Old clients ignore the new messages;
new clients on old servers time out only the private observer. A publish timeout
does not cancel a Host request already in flight; do not treat it as proof of no
publication or retry it. Corrected candidates keep the receive observer active
and process later distinct events from a bounded ten-second FIFO. Startup and
subscription failures still stop that observer.

For real Product captures, resolve Statement Submit permissions in a disposable
room first. Permission latency can exceed the eight-second publish deadline;
persistent access requires the owner's explicit consent and must not include
unrelated permissions. Follow the capture procedure rather than retrying an
uncertain publication. A full host-page reload loses its memory-only resume
token and may end the room; it is not equivalent to socket reconnection.

Public/private observers share local unexpired-write reservations and reserve
one full beacon only when the build enables beacons. Private pairwise fanout
may exhaust the budget; never enable automatic retries to compensate. It cannot preflight all users of a sponsored account,
other tabs or other applications; network rejection is an observed outcome.
See [W27 transport decisions](../explanation/room-realtime-transports.md) for
privacy, observation limits and the Product capture protocol.

The opt-in [paired capture procedure](../how-to/capture-celerity-room-realtime.md)
requires the new admitted-only `room:realtime-clock` event on signaling. It
calibrates with a random process clock ID, stores bounded in-memory fingerprints
and needs no secret or storage mount. Export is manual; the offline reporter
rejects incomplete exports or mismatched run/CID/SHA. A build or passing report
does not replace real Product/device acceptance. Do not enable the default or
remove Socket.IO based on a simulated run.

With `VITE_DOTIFY_DEBUG_PANEL=true`, the same recorder is available under
You > Production readiness > Celerity capture, including on mobile without
DevTools. The panel starts no capture or publication on mount. It exports only
on an explicit copy action, with selectable JSON when clipboard access fails;
no automatic upload or persistence is added. Both peers must use the 0.1.32
correction candidate for new acceptance runs. The earlier 0.1.31 candidate has
the panel but stops observation after a publish timeout; 0.1.30 lacks the panel.
A new local build is not a deployment or live acceptance result.

The 2026-10-15 consent correction disconnects global room beacon publishing and
reading from the application. `VITE_DOTIFY_ROOM_BEACONS` and the legacy
`:beacons` script aliases no longer enable app discovery. Archived modules are
research scaffolding; globally readable announcements cannot enforce a host's
Nearby radius or immediate opt-out. Previously published records can only
expire according to their original TTL. Do not reuse this transport for
location or private-room discovery without a new consent design.

`VITE_PINATA_JWT` and `VITE_CONTENT_SECRET` are explicitly empty in that
profile so a developer's generic local `.env` cannot leak demo credentials
into the Product bundle.

The Product IPFS gateway is the publication storage endpoint for the app bundle,
not the most reliable first read path for the public track assets Dotify
currently pins through Pinata. Keep `https://gateway.pinata.cloud` first, with
`ipfs.io` and `dweb.link` before Product storage gateways for artwork and
metadata fallback reads; otherwise cover images can hang in the browser without
firing an image error.

New API cover uploads require the `sharp` native dependency included in the API
image. The upload endpoint creates one public IPFS directory with
`cover/placeholder.webp`, 64/160/320/640 px WebP variants, and the untouched
`cover/original.<ext>`. The on-chain image ref points to `cover/640.webp`; the
web client derives the other widths for `srcset`. The loading placeholder is
local, so an optional missing `placeholder.webp` does not add a network request
or compete with audio. A missing actual cover still needs its pin restored;
the local placeholder is not evidence that the remote image exists. On the current 512 MB single
API machine, cover normalization is intentionally serialized process-wide; one
large source is decoded and attention-cropped into a 640 px canonical image,
then smaller variants are derived sequentially. Do not parallelize this stage
without load-testing the deployed memory limit. After changing the API image,
smoke both the primary and a thumbnail path before publishing a release:

```bash
curl -s -L -o /dev/null --max-time 12 \
  -w '%{http_code} %{content_type} %{size_download} %{time_total}\n' \
  https://gateway.pinata.cloud/ipfs/<directory-cid>/cover/640.webp
curl -s -L -o /dev/null --max-time 12 \
  -w '%{http_code} %{content_type} %{size_download} %{time_total}\n' \
  https://gateway.pinata.cloud/ipfs/<directory-cid>/cover/160.webp
```

Old single-file refs remain valid. Rolling the API/web code back does not
invalidate responsive refs because the 640 px path is itself a normal image
URL; older clients simply ignore the sibling variants.

Encrypted audio byte reads are stricter than image and metadata reads: the
browser fetch path requires CORS and range behavior that public gateways do not
provide consistently for Dotify's Pinata-pinned DAV2 files. The web app
therefore restricts DAV2 range reads to Pinata gateways (`gateway.pinata.cloud`
or a configured `*.mypinata.cloud` gateway). Full-file recovery can use other
configured readers, but a gateway wins only after its entire bounded body is
read and the DAV2 container is structurally valid. CORS failures, failed bodies
and truncated containers can try another reader; AES-GCM authentication failure
remains terminal and never bypasses the artist's access policy.

Recovery permits at most two parallel full-file downloads, with 20 seconds to
headers, 15 seconds of body inactivity and 64 MiB per response (50 MiB upload
limit plus encrypted-container overhead). This is a transport fallback, not a
new key request or source shared with room guests. Cancelled selections abort
pending readers. Existing playback position and pause intent are retained.
Remove retired `bulletin-kubo.tservices.es` and `paseo-ipfs.polkadot.io` from
hosted read settings; current frontend code filters them and retains the CID
and path when resolving old asset URLs through current readers. DNS/HEAD checks
and synthetic Chromium/WebKit playback do not prove live Product recovery.

The flat-CID Bulletin build uploads only `dist-bulletin/index.html`. Its DAV2
decrypt Worker is therefore compiled as an inline Blob Worker. The
`build:bulletin` artifact smoke fails if that HTML references an external
Worker or script asset; do not replace the inline path with a relative Worker
URL unless Bulletin publication also starts uploading the full asset tree.

The October 8 audio/session correction is a frontend-only change: no gateway,
secret, API schema, signaling protocol, or contract migration is required.
See [W08 continuity evidence](../backlog/implementation/evidence/W08-audio-continuity-2026-10-08.md).
After publishing a candidate, verify a failed segment resumes at the same time,
Pause survives recovery, A → B → A plays, and a valid protected session does not
prompt between tracks with persistent storage blocked. Record the exact build,
Host/browser, role, network profile, and failures. Chromium/WebKit synthetic
tests do not replace iPhone/Product or two-device room acceptance.

The session cache now includes API, chain and signing identity. The old
address-only cache cannot establish those boundaries, so an upgrade may require
one sign-in for protected playback. When storage is unavailable, the new token
lasts only for the current page lifetime (and never beyond its server expiry).
Free playback and room guests require no sign-in. Generic 503 responses stop
protected preparation without wallet prompts; the next attempt probes again.
Do not clear storage or ask the user to pay again to troubleshoot this state.
Rollback is the prior frontend artifact; existing ciphertext, purchases and
backend tokens remain compatible, though the older client may ask to sign in.

The Product build also embeds a non-secret `dotify-test01.dot` bootstrap catalog
snapshot. It prevents first-run mobile hosts from staying on `Loading registry
catalog` when the Fly catalog request hangs; the Fly API remains the source of
truth once reachable. `npm run build:product-devnet` refreshes
`web/src/services/productDevnetCatalogBootstrap.ts` from
`VITE_DOTIFY_API_URL` before building. Set shell-only `CATALOG_API_URL` only
when deliberately generating the snapshot from a different catalog API. The
default generator keeps the existing snapshot if the API is unavailable; use
`npm run generate:product-catalog-bootstrap:strict` before releases or after
contract address changes so a stale API fails visibly.

Release preparation and publication are deliberately separate. Refresh with
the strict generator, review and commit the generated snapshot, then build the
exact candidate with `npm run build:product-devnet:frozen`. The frozen command
does not contact the catalog API. Signer-free CI and `deploy:product-devnet`
both use it, preventing live catalog drift between the validated commit and the
locally signed publication.

Build and publication:

Before publication, `npm run verify:product-deploy-environment` checks the
pinned CLI API and `web/product-devnet-host.environments.json`, then fetches
Product Desktop's public Firebase Remote Config with the `environment=paseo`
signal. This is the Product channel corresponding to the CLI's `devnet` profile.
It compares the registry, resolver/content resolver and IPFS gateway. Missing
configuration, malformed replies, HTTP failures and timeouts all fail closed;
the operator must not bypass the check or automatically adopt changed addresses.

Configure `PRODUCT_HOST_FIREBASE_API_KEY` in the operator shell, or put
`{"apiKey":"<Product Firebase client API key>"}` in the ignored local file
`web/.product-host-check.local.json` (mode 600). Use the Firebase **client** key
from the Product distribution matching the pinned project/app/channel in
`web/scripts/product-host-config-check.mjs`, never a wallet seed, service-account
key or Product session token. This setting has no `VITE_` prefix and is not
included in the Dotify frontend. The checker creates a fresh anonymous client ID
in memory; it reads only public Remote Config and persists no Firebase identity.

The deploy wrapper checks again immediately before publication and after the
CLI publishes the content and manifest. A failed post-check means publication
may already have completed: inspect the printed CID and transaction receipts,
do not retry writes blindly. CLI read-back and matching Remote Config do **not**
prove that an installed Product host has refreshed its local cache. Record the
candidate SHA/version/CID, reload the host, and compare its Production readiness
build identity before accepting a release. Never use cache deletion as a
substitute for checking the registry/resolver first.

`.github/workflows/product-host-drift.yml` performs the same signer-free check
on relevant `dev` pushes, manual dispatch and daily at 06:23 UTC. Set repository
Actions secret `PRODUCT_HOST_FIREBASE_API_KEY` to the same client key. There is
no mnemonic, deployment or automatic configuration update in this workflow.
The scheduled workflow must exist on GitHub's default branch (`main`) to run;
merging it into `dev` alone enables the push check, **not** the daily schedule.
Action failures are the alert; configure GitHub Actions notifications for the
maintainer. A green check proves a fresh observation at that time, not perpetual
host compatibility or that Web/Mobile/Desktop all have the same active config.

When drift is detected, compare Product's current distribution and channel,
review registry/resolver ownership and domain state, then update the pinned
profile/override together in a tested PR. Repeat the live check and a real host
SHA/version observation. A changed client project or channel also requires
review of the source profile; never silently fall back to a different channel.

```bash
cd web
read -rs MNEMONIC
export MNEMONIC
npm run generate:product-catalog-bootstrap:strict
npm run build:product-devnet:frozen
npm run deploy:product-devnet
unset MNEMONIC
```

`deploy:product-devnet` requires `MNEMONIC` and passes it to
`polkadot-app-deploy` through the local child-process environment, without
placing the phrase in command arguments. It also passes
`--no-transfer-to-signedin-user`. This intentionally avoids the mobile
`pad login` session for DotNS updates. `pad whoami` reports the mobile Product
session, not the mnemonic-derived owner signer.

The manual GitHub Actions workflow `.github/workflows/deploy-frontend.yml`
validates an exact candidate SHA but cannot publish it. It receives no mnemonic
or signer and performs no Product write. Validation builds enable the Product
CDM adapter and operator readiness panel; release 0.1.46 makes that adapter
explicit in the checked-in Product release profile too. Ordinary web retains viem.
Both profiles consume the committed catalog snapshot through the
same frozen build used by local publication. DotNS publication remains a local
operator action from the same clean SHA.

Use
[`docs/operations/product-devnet-deployment.md`](product-devnet-deployment.md)
for authentication, publication, validation, and rollback.

## Fly Backend API

Dashboard:

```txt
https://fly.io/dashboard
```

Open app `dotify-api`.

The table lists the tracked values in `services/api/fly.toml`. API 29 was
verified against this fresh factory/directory during the 2026-10-22 rollout.
Always compare the actual deployed identity before publishing matching clients;
a configuration file alone is not deployment evidence.

| Key                          | Tracked post-cutover value                                                                                                                                                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `API_PORT`                   | `8790`                                                                                                                                                                                                                       |
| `NODE_ENV`                   | `production`                                                                                                                                                                                                                 |
| `API_ORIGINS`                | `https://muzinga.netlify.app,https://dotify-test01.dev-dot.li,https://dotify-test01.app.dev-dot.li,https://dotify-test01.app.dot.li,https://dotify-test01.dot,polkadot://dotify-test01.dot,polkadot://app.dotify-test01.dot` |
| `PASEO_ASSET_HUB_NATIVE_RPC` | `https://asset-hub-paseo-rpc.n.dwellir.com` (HTTPS historical native receipts; no signing)                                                                                                                                   |
| `PASEO_ASSET_HUB_RPC`        | `https://eth-rpc-testnet.polkadot.io/`                                                                                                                                                                                       |
| `DOTIFY_FACTORY_ADDRESS`     | `0x708d35eee7c1416f6d332344068be9d714aec24c`                                                                                                                                                                                 |
| `DOTIFY_DIRECTORY_ADDRESS`   | `0x8e611ef60169f8ed93019de4a3034a504ae2ad29`                                                                                                                                                                                 |
| `DOTIFY_CHAIN_ID`            | `420420417`                                                                                                                                                                                                                  |

<a id="shared-native-contribution-ledger-product-0140"></a>

### Shared native contribution ledger (Product 0.1.40–0.1.41)

Product 0.1.41 published the PR #242/#243 review follow-ups on 2026-10-07 from
candidate `30bd5912c0cb4f7e85c03e30657037a1eb0127a4`. The API and Product bundle use
that same candidate. The finalized executable CID is
`bafybeidv2yvrqemk6bacqq63ovnso4to3oce265uq5ysv35gcfkfla32ci`; independent
read-back matched the public CAR to the local build. The existing persistent
volume retained the known verified contribution across the API update, and a
managed pre-deploy snapshot has 14-day retention. Physical-device cache refresh
and dashboard confirmation remain separate acceptance checks.

The published 0.1.40 evidence below predates the review follow-ups and used the
60-request history limit.

Published on 2026-10-07 (Paris): Product source `0aef57670c71a60d46f67f7d5f62d008561afcb8`,
API source `48e3bda9af3ba26ec65b2f794ee96dd169956857`, executable CID
`bafybeia4lm3ybgkqod3majkgu52xvbpnmlrtpnogjjutkxtxhfqbroyjzu`. The finalized manifest and gateway bundle
were verified. A real API restart preserved the recovered contribution; a managed
volume snapshot completed with 14-day retention. Full rollout evidence and
remaining physical-device/historical coverage gates are recorded in
[the dashboard evidence](../backlog/implementation/evidence/artist-dashboard-2026-10-07.md).

`NATIVE_CONTRIBUTION_SNAPSHOT_PATH` is `/data/contributions/receipts.json` in
Fly and defaults to `.data/native-contributions.json` locally. The `contribution_data`
volume mounts at `/data/contributions`. Keep exactly one API machine/writer;
independent volume replicas would diverge. Use `--ha=false` on deploy and do not
add a spare API machine until there is a shared transactional store. Other
catalog/key storage and CORS settings are unchanged.

The verified receipt route saves successful contribution events before replying.
It rejects incomplete recipient totals, wrong networks and conflicting blocks.
Repeated verification is idempotent. Atomic replacement publishes the new
snapshot only after saving succeeds; corrupt or unwritable storage returns an
explicit error rather than an empty history. Limits: 10,000 receipts / 64 MiB,
no silent eviction, 100 receipts/page, 100 runtimes/query, and 600 history
queries/minute/IP. This permits four full 100-page scheduled refreshes and two
full manual refreshes within one minute from an IP while preserving an abuse
bound. Catalog runtime lists are deduplicated and split into batches of at most
100; every page and batch binds to the same snapshot revision. The browser uses
one 25-second total budget for the whole refresh, and rejects partial results
if a later batch fails or the revision changes. Outstanding contribution
claims are reconciled against finalized contract state.

`POST /api/contributions/history` accepts `{ runtimes, offset?, revision? }`
and returns verified native receipts with `coverage: verified-receipts`. It is
public, like the underlying events, and never accepts submitted logs. It is not
an exhaustive native chain indexer. Earlier receipts can be recovered by calling
the existing native-receipt endpoint with their transaction hash/block, which
re-verifies before saving; do not edit the ledger to add a payment.

Before publishing this frontend, provision its volume in the API machine's
region, configure the mount, and deploy the API first. Preserve any existing
unrelated volumes. Follow [Fly's volume attachment procedure](https://docs.fly.io/launch/volume-storage).
Verify a known receipt through the public endpoint, read it through history from
a separate client, restart the API process, and confirm the same record remains.
Enable automatic volume snapshots and retain an independent export of the ledger
before migration or rollback. A rollback must retain the volume; never replace
a saved history with an empty file. This bounded read model has no replication
or zero-downtime failover claim.

Native receipts use a separate read-only archive boundary. The endpoint accepts
only a 32-byte transaction hash and a block reference, never a caller-selected
RPC URL. It verifies chain ID `420420417` and genesis
`0xd6eec26135305a8ad257a20d003357284c8aa03d0bdb2b357ab0a22371e11ef2`.
The endpoint is limited to 20 requests/minute/IP, four concurrent archive reads,
a 20-second total read budget and 8 MiB per RPC response. It retains at most
128 immutable verified receipts for 30 minutes and two historical metadata
codecs in process memory. The verifier itself has no durable cache; verified
contributions are persisted by the ledger described above. Missing configuration,
wrong genesis, an unavailable archive or an unverified proof returns an explicit
error with a request ID, never a failed-payment verdict. The browser read budget
is 25 seconds. CORS origins, secrets and content-key authorization are unchanged;
the contribution ledger adds the persistent mount and single-writer requirement
described above.

Deploy the API before the Product executable that depends on this endpoint:

```bash
cd services/api
flyctl deploy --ha=false --env GIT_COMMIT_SHA="$(git rev-parse HEAD)"
```

Verify `/health`, `/version`, a known finalized native receipt and preflight
CORS for the configured Product HTTPS origins. Then publish the `product-cdm`
frontend and verify its finalized manifest, public CAR and embedded source SHA.
Keep the device's pending journal and paying account when testing recovery.
Live mobile host execution remains a separate acceptance check.

Do not store `API_ORIGINS` as a Fly secret. Fly secrets override `[env]` values
from `fly.toml`, so a stale secret can keep CORS broken after a clean deploy.
Audit before origin changes:

```bash
cd services/api
flyctl secrets list
flyctl secrets unset API_ORIGINS
flyctl deploy
```

Set server-side values in the app's Secrets area:

| Secret                       | Required                      | Notes                                                                                                                                                      |
| ---------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PINATA_JWT`                 | Uploads                       | Backend-only Pinata token. Never expose in Netlify.                                                                                                        |
| `CONTENT_KEY_MASTER_SECRET`  | Audio upload and key delivery | 64+ hex chars, at least 32 random bytes. Compatibility source for v1/v2 when the explicit version map omits them. Never expose or rely on Fly as a backup. |
| `CONTENT_KEY_MASTER_SECRETS` | Key rotation                  | Optional JSON object from `dotify-content-key-vN` to 64+ hex chars. Keep every retained version needed by existing releases.                               |
| `CONTENT_KEY_ACTIVE_VERSION` | New encrypted uploads         | Optional active version for new backend uploads. Default is `dotify-content-key-v2`; change only after backing up and configuring the matching secret.     |
| `GIT_COMMIT_SHA`             | Optional                      | Set by CI/build automation when available; `/version` can fall back in dev checkouts.                                                                      |
| `TURN_REST_SECRET`           | Reliable rooms                | Backend-only HMAC secret shared with the TURN relay REST auth mechanism. Preferred production path.                                                        |
| `TURN_CAPABILITY_SECRET`     | Reliable rooms                | 32+ character secret shared only with signaling; verifies that TURN grant callers are current room participants. Keep distinct from `TURN_REST_SECRET`.    |
| `TURN_USERNAME`              | Optional fallback             | Static DevNet TURN username when REST auth is unavailable.                                                                                                 |
| `TURN_CREDENTIAL`            | Optional fallback             | Static DevNet TURN password when REST auth is unavailable.                                                                                                 |

Content-key rotation procedure:

1. Export the current key material from the operator's secret manager, not from
   Fly. Fly secrets are write-only from the app operator perspective.
2. Create a new 32-byte hex secret locally with
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
3. Build a retained JSON map containing every version that still has published
   ciphertext, for example v2 and a new v3. Store that JSON in the secret
   manager before deploying.
4. Set `CONTENT_KEY_MASTER_SECRETS` and `CONTENT_KEY_ACTIVE_VERSION` on Fly,
   then deploy the API. Existing current-format v2-key releases should still decrypt; new
   uploads should return an audio ref shaped like
   `dotify:enc:v3:key-v3:ipfs://<directory CID>`.
5. Run `npm --prefix services/api run key-custody:rehearse` locally. The script
   uses synthetic secrets and writes only a synthetic backup under `/tmp`; it is
   a rehearsal of the operator process, not a production export.
6. Smoke one existing protected release and one newly uploaded release through
   the deployed API before depending on the rotation for the pilot catalog.

Changing the active version cannot revoke keys already delivered to browsers or
room hosts. If a secret is compromised, plan a re-encryption and release-update
operation for affected tracks; config rotation alone is not a revocation tool.

Catalog read-model variables:

| Key                             | Default              | When to override                                                                                                             |
| ------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `CATALOG_SNAPSHOT_PATH`         | `.data/catalog.json` | Not required to boot. Set to a durable Fly volume path, such as `/data/catalog.json`, for production-grade catalog evidence. |
| `CATALOG_POLL_INTERVAL_MS`      | `10000`              | Change only when deliberately tuning chain polling.                                                                          |
| `CATALOG_RECONCILE_INTERVAL_MS` | `300000`             | Change only when deliberately tuning full reconciliation.                                                                    |
| `CATALOG_STALE_AFTER_MS`        | `60000`              | Change only with an updated freshness expectation.                                                                           |
| `CATALOG_CONFIRMATIONS`         | `2`                  | Change only with an explicit reorg/finality tradeoff.                                                                        |

`CATALOG_SNAPSHOT_PATH` is optional because the API creates the default
`.data/catalog.json` path automatically. On Fly, that default is not durable
across deploys or machine replacement. Use it for PR previews if no volume
exists, but document that limitation in PR evidence.

For production-grade catalog evidence:

- mount a Fly volume at a path such as `/data`;
- set `CATALOG_SNAPSHOT_PATH=/data/catalog.json`;
- keep the API single-writer until the JSON snapshot is replaced by a shared
  transactional store;
- keep only one active API machine writing the catalog snapshot;
- keep at least one machine warm while measuring catalog p75 performance, then
  record whether the trace was warm or cold.

Artist upload and session-boundary variables:

Session-only frontend releases require `/api/auth/session` GET and POST plus
token-based key requests. Verify session auth and `CONTENT_KEY_MASTER_SECRET`
before rollout; older APIs without sessions now fail closed for protected
listening. There is no per-track signing fallback. Established tokens survive
network/503 failures; typed expiry/revocation/process-restart renews once.
An interrupted exchange after approval requires explicit sign-in or account
disconnect/reconnect. HTTP requests time out after 15 seconds. This does not
change the 24-hour TTL or the API's process-epoch invalidation on restart, and
adds no new environment setting. Free tracks and room guests stay walletless.

The W29 frontend bounds session capability, nonce, session exchange, key and
logout HTTP requests to 15 seconds each. A capability timeout fails without a
wallet signature and can be retried; wallet approval itself is not interrupted
by that HTTP budget. Failed startup key requests retry twice (900 ms and
2,200 ms delays), then expose a recovery action in the player. Operators should
check API/RPC health when that state persists. No new environment setting is
required; validate the purposeful connect/sign-in flow in the deployed browser
and Product host after publishing the frontend.

| Key                                 | Default      | Meaning                                                                    |
| ----------------------------------- | ------------ | -------------------------------------------------------------------------- |
| `UPLOAD_AUTH_TTL_SECONDS`           | `300`        | Lifetime of a one-use capability for one audio, cover, or metadata upload. |
| `UPLOAD_QUOTA_WINDOW_SECONDS`       | `3600`       | Rolling window for completed upload bytes.                                 |
| `UPLOAD_PRINCIPAL_BYTES_PER_WINDOW` | `209715200`  | Reserved plus completed bytes allowed per artist address.                  |
| `UPLOAD_GLOBAL_BYTES_PER_WINDOW`    | `2147483648` | Reserved plus completed bytes allowed across the API.                      |
| `UPLOAD_PRINCIPAL_CONCURRENCY`      | `2`          | Outstanding upload grants allowed for one artist address.                  |
| `UPLOAD_GLOBAL_CONCURRENCY`         | `8`          | Outstanding upload grants allowed across the API process.                  |

Production uploads require this sequence: signed EIP-191 or Product sr25519
session, on-chain `ArtistDirectory.runtimeOf(requester)` verification, a
short-lived capability bound to asset purpose and byte budget, then byte-level
media validation before Pinata receives anything. Cover bytes additionally
pass a bounded server-side decode before any variant is pinned; decode failure
releases the upload lease and returns a plain invalid-media error. Free key
delivery and room guest entry remain unauthenticated.

Quota reservations, completed-byte counters, revoked session JTIs, and upload
capabilities are process-local. `services/api/fly.toml` therefore enforces
`max_machines_running = 1`; do not scale the API horizontally until those
records use one shared transactional store. A restart clears quota counters and
changes the process epoch, which invalidates every earlier session and upload
capability. This is the deliberate durable logout policy: an old token cannot
become valid again after restart, but all still-connected users must sign in
again. If chain RPC is unavailable, artist verification and capability issuance
fail closed. If Pinata fails or the client interrupts the request, the reserved
quota and concurrency lease are released.

When `DOTIFY_FACTORY_ADDRESS` or `DOTIFY_DIRECTORY_ADDRESS` changes, clear the
old catalog snapshot or force a reindex before using the public API as release
evidence. A clean redeploy to the September 2026 factory
`0x835a626a9a6965b197d079ae56b1ec94033c2699` and directory
`0x4e883827d61e573094c7b777bae323070ea9f954` starts with zero registered
artists and zero releases. If `GET /api/catalog` still returns runtime
`0x84D5062F2195758E42100845151c3f80BfAA5482` or blocks near `11269xxx`, the
hosted API is still serving the previous environment.

W05 changes the `MusicRoyaltiesPallet` ABI and appends claimable-recipient
storage under the existing namespaced Diamond storage slot. New factory
deployments install the claim selectors automatically. Existing artist runtimes
need a royalties facet cut that replaces `musicRoyPayAccess` and adds
`musicRoyClaimable(address)` plus `musicRoyClaim(address)` before native
Classic payments are enabled on that runtime. There is no new environment
variable for this behavior. Rollback before any W05 payment can reinstall the
previous royalties facet; rollback after W05 payments may have created
claimable balances must keep a claim-capable facet available until those
balances are settled or explicitly migrated.

TURN relay variables:

| Key                                 | Default | When to set                                                                                                                                                                   |
| ----------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TURN_URLS`                         | unset   | Set to comma-separated public relay URLs when deploying reliable room audio, for example `turn:turn.example.org:3478?transport=udp,turns:turn.example.org:443?transport=tcp`. |
| `TURN_REST_SECRET`                  | unset   | Preferred production credential path. Store as a Fly secret only.                                                                                                             |
| `TURN_CAPABILITY_SECRET`            | unset   | Required with TURN. Store as a Fly secret and set the same value as `SIGNAL_TURN_CAPABILITY_SECRET` on signaling. Keep it distinct from `TURN_REST_SECRET`.                   |
| `TURN_USERNAME` / `TURN_CREDENTIAL` | unset   | Rotated DevNet/static fallback only when the relay cannot mint REST credentials. Store as Fly secrets.                                                                        |
| `TURN_TTL_SECONDS`                  | `3600`  | Adjust only with relay policy. REST credentials embed this expiry in the username.                                                                                            |

The API exposes `GET /api/turn/grant` for the frontend room code. The signaling
service first issues a two-minute room-membership capability to the connected
host or listener; the frontend sends it as a bearer token. The API verifies it
with `TURN_CAPABILITY_SECRET` before returning any relay credential. Missing,
expired, or forged proof fails closed. Without relay config the room client
falls back to STUN plus any browser-visible `VITE_TURN_*` values.

For production, prefer TURN REST credentials because the shared relay secret
stays on Fly. `VITE_TURN_USERNAME` and `VITE_TURN_CREDENTIAL` are public bundle
values and should be limited to rotated DevNet/static tests.
The grant endpoint remains walletless so room guests can join from a link, but
it is no longer public: only a socket currently joined as host or listener can
obtain the short-lived proof. Keep API rate limits, relay quotas, and secret
rotation as additional boundaries.

On the 2026-09-28 DevNet W13 rollout, `TURN_CAPABILITY_SECRET` on `dotify-api`
and `SIGNAL_TURN_CAPABILITY_SECRET` on `dotify-signal` were installed as matching
Fly secrets without recording their values. The deployed API returns 401 for
an anonymous grant, 403 for a forged capability, and 200 for a current room
member's signal-issued capability. This checks authorization and grant wiring;
it does not prove that a physical WebRTC session used relay packets under
adverse NAT. See the [0.1.29 W13 live evidence](../backlog/implementation/evidence/W13-candidate-0-1-29-live-2026-09-28.md).

### Backend Signature Schemes

No Netlify or Fly dashboard variable enables Product signatures. The API
accepts two explicit schemes on session sign-in and protected key requests:

| Scheme               | Client                               | Required proof fields           | Backend binding                                                                                                              |
| -------------------- | ------------------------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `eip191`             | Standalone EVM wallet path           | `signature`                     | `viem.verifyMessage` against the requester H160                                                                              |
| `product-sr25519-v1` | Product-host app-scoped account path | `signature`, `productPublicKey` | sr25519 signature over the canonical Dotify message bytes, then Product public-key-to-H160 derivation matching the requester |

Unknown schemes fail at the API schema boundary. Product requests must still
pass the same nonce, chain, purpose, expiry, and `musicAccCanAccess` checks as
standalone requests. The Product frontend submits this proof shape only after
an explicit Product-host account connection.

`VITE_DOTIFY_RUNTIME_ADAPTER=product-cdm` also routes runtime write submissions,
including Classic unlock payments, through the Product CDM contract adapter. The
0.1.46 release enables that flag in the tracked Product profile to restore
the native tips previously validated in support releases. Ordinary web retains
`viem`; installed-host payment approval/finality still needs release acceptance. Product
CDM writes now fail closed unless the host signer public key maps to the same
pallet-revive H160 address that Dotify connected for key/session requests, and
Classic unlocks in a `product-cdm` build must poll `musicAccHasPaid` plus
`musicAccCanAccess` for that H160 before showing success. If the transaction is
included but verification fails, Dotify preserves the transaction hash in a
**Payment included, access not verified** error. Royalty claim writes use the
same adapter boundary through `musicRoyClaim(activeEvmAddress)`. Artist earnings
now use public EVM event history from `VITE_ETH_RPC_URL`, explicitly read-only
even in a Product CDM build. Its chain ID must match the configured network.
The endpoint must permit `eth_chainId`, `eth_getLogs`, `eth_getBlockByNumber`
and `eth_call`, and be allowed by Product Web-domain permissions. No secret or
new flag is needed. Visible-page polling runs every 15 seconds after completion;
failed/incomplete history retains the last complete reading or displays
Unavailable, never a fabricated zero. Recipient balances can be independently
unavailable. This scans known runtimes, not all historical collaborations or
direct gifts. Large histories may require a bounded indexer; there is no new
server, persistent index or finality guarantee in this patch. See
[royalty settlement](../explanation/royalty-settlement.md).

Before releasing, inspect Overview and Earnings in Product with an already-paid
artist account, compare per-work/gross/recipient amounts with existing receipts,
and verify unavailable/stale feedback without submitting a payment. Test the
gift recipient preview separately, stopping before signing. Rollback is the
previous reviewed bundle; no contract or data migration is involved. Enable
`VITE_DOTIFY_DEBUG_PANEL=true` only on that smoke build to export the safe
browser-side evidence bundle with `amountPlanck`, payment read-back, Product
sr25519 key/session outcomes, and the operator-marked host approval observation.
For W13, first bind the deployed candidate and open an already-paid Classic
track. A separate `access-readback` event captures current paid/playable access
without submitting another transaction. Backend-key evidence must follow a
read for the same account, network, runtime and content hash. Existing access
does not satisfy host approval, native transfer or transaction read-back gates.
No new configuration is needed. Capture remains bounded session storage;
reset it after use and keep account-linked diagnostic exports separate from
aggregate pilot evidence. See the Product deployment runbook for the sequence.
Validate Product protected playback through host smoke tests after each Product
publication before treating Product identity as production-ready for gated
listening.

### W33 prepared public media CDN, 2026-10-22

[ADR 0034](../adr/0034-media-cdn-and-native-storage.md) reuses the owner's dedicated
Pinata gateway/CDN, without adding an operator. New optional deployment origins
are `VITE_DOTIFY_MEDIA_EDGE_URL` (Web/Product edge-first ciphertext),
`MEDIA_EDGE_URL` (API post-index warming), and `MEDIA_IPFS_GATEWAY` (API dedicated
Pinata origin on misses). They accept no identity token or query string. The API
relay remains catalog-gated/no-store; CDN bytes do not confer access or keys.

Not activated: the provided gateway returns 401 in three regions for the
current published CID. Keep defaults until provider content/access is corrected,
then validate exact bytes, immutable headers, CORS and physical Host networking.
See [activation, bounds, cost, purge and rollback](media-cdn.md) and
[W33 evidence](../backlog/implementation/evidence/W33.md). Product Cloud Storage
is documented as Host CID storage/retrieval, not asserted to be an audio CDN or
an ordinary-Web replacement. No account, plan or live configuration was changed.

### First-sound candidate evidence

Every ordinary Vite build now embeds its exact git SHA in
`VITE_DOTIFY_BUILD_SHA`, matching the Product build identity behavior. A smoke
build with `VITE_DOTIFY_DEBUG_PANEL=true` exposes **First-sound evidence** under
`You -> Production readiness`. Evidence builds fail when `git status` is dirty;
commit the exact candidate first so the embedded SHA identifies the bytes being
measured. Production builds derive this identity from the checked-out commit and
reject a mismatched `VITE_DOTIFY_BUILD_SHA`; that override is reserved for the
explicit Playwright readiness-panel dev server.

The bundle also embeds `VITE_DOTIFY_BUILD_CONFIG_DIGEST`, a SHA-256 digest of
the public `VITE_*` inputs used to build it. The digest excludes the build
identity variables themselves and never exposes input values. Standalone and
Product exports may have different digests because they are different build
families, but exports within each family must agree before the report can call
the candidate ready.

1. Bind the exact build. Add the deployment CID for Product Desktop or Product
   Web gateway samples.
2. Record and bind one test profile using only the provided coarse device, OS,
   browser, and connection categories. Product surfaces also require the
   numeric host version. Do not enter device names, account names, hostnames, or
   serial numbers; the UI and schema do not accept free-form profile fields.
3. Choose the listening flow, explicit cold or warm cache condition, and the
   scenario being exercised, then select **Start sample**. Use **Ordinary
   playback** for release-latency measurements; use the named controlled
   scenarios only while deliberately exercising their corresponding failure or
   recovery path.
4. Start the track. Dotify records the real selection/playback intent as the
   timing origin, including access, key, gateway, decrypt, and media startup.
   Press **I hear the music** at the first sound you actually hear. If playback
   fails, use the same action after Dotify shows the error; an automatic
   terminal failure is recorded without an audible confirmation.
5. Repeat cold and warm attempts, then download the candidate-bound JSON.

Schema v6 keeps first-sound duration, its `human-confirmed` or `automatic-error`
method, sanitized profile/scenario, bounded host terminal reason and coarse
streaming facts (key authorization, first media-object bytes, gateway recovery,
AAC compatibility reader and authentication failure). It omits wallet identity,
location, audio refs/CIDs, gateway/source URLs, keys and signatures. Changing a
candidate/config/deployment/profile/network starts a separate evidence set.
Schema 5 exports are refused rather than relabeled as current playback.

Ordinary playback supplies surface-success and p75 gates. Denied access, broken
gateway, slow key, interrupted navigation and corrupted streaming media have
separate expected-outcome gates with actual telemetry proof: access denial,
successful gateway failover, at least 1,000 ms key authorization, selection
interruption, or authentication failure respectively. Controlled errors do not
count as ordinary success. Exports may combine only for the same source identity;
Product additionally requires one version/CID. Nothing here certifies a physical
Host from synthetic browser results.

Combine exports from physical surfaces and produce the release report with:

```bash
cd web
npm run smoke:first-sound -- \
  --evidence-json /path/to/chrome.json \
  --evidence-json /path/to/safari.json \
  --evidence-json /path/to/product-desktop.json \
  --expected-commit <40-character-candidate-sha> \
  --md-out /tmp/dotify-first-sound.md \
  --json-out /tmp/dotify-first-sound.json \
  --strict
```

The strict gate requires evidence for desktop Chrome, Firefox, Safari, iOS
Safari, Android Chrome, Product Desktop, and Product Web gateway, plus evidence
for every controlled scenario listed above. Every exact
device, OS, browser, connection, and Product-host profile supplied for a required
surface needs at least four successful samples in each cold/warm p75 flow cell;
exports with different profiles never pool their sample floor or latency budget.
Aggregate p75 remains visible but cannot compensate for a slow or undersampled
profile. The report prints every profile beside its surface. A blocked autoplay
attempt is recorded as a terminal error, and a later explicit Play starts a
fresh measurement. Reaching `canplay` only releases the loading affordance; the
attempt remains cancellable until `playing` or a terminal error. Asynchronous
play results are correlated to the concrete playback-attempt object that
initiated them. Each resolved source also receives a distinct host media-element
generation, so a delayed native error from a retired element cannot reach its
replacement, including when a URL is reused. Capture-stream reuse requires the
same media element as well as the same URL and a live track; a replacement
element is always recaptured and republished to room listeners. Repeat is a
declarative property of every generated host element, so a source replacement
cannot silently reset an enabled loop. Once every listener sender has moved to
the replacement stream, Dotify removes the retired element's volume listener,
disconnects its Web Audio nodes, stops its destination track, and closes its
AudioContext. A muted or zero-volume `playing` event is recorded as an error. An
unmuted `playing` event only proves that the media clock advanced; the operator
confirmation supplies the evidence that sound reached the actual output route.
AAC Blob-reader use is reported descriptively; it is a supported current-format
reader, not an error percentage. The same physical first-sound and failure gates
apply to MSE and Blob paths.
Synthetic Chromium evidence validates the capture mechanism but does not count
as physical Safari, mobile, or Product-host evidence.

Closing a room tears down peers but retains ownership of the current real audio
capture while that track continues in solo playback. If the listener then
chooses another track, the replacement element retires the retained listener,
graph, destination track, and AudioContext even though no room is active. If the
host instead opens another room on the same element and source, Dotify restores
the ready state from the retained live capture without waiting for another
`loadedmetadata`, `play`, or `playing` event.

## Fly Signaling

Open app `dotify-signal`.

The table lists the **tracked post-cutover values** in `web/fly.signal.toml`,
not a readback of the live service. The last recorded signaling release 36 still
used the previous directory. Deploy this configuration only with the matching
API directory and Web/Product clients, following the
[coordinated cutover record](fresh-testnet-2026-10-21.md). A source table does not
prove that Fly has already applied these values.

| Key                             | Tracked post-cutover value                                                                                                                                                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SIGNAL_PORT`                   | `8788`                                                                                                                                                                                                                       |
| `SIGNAL_HOST`                   | `0.0.0.0`                                                                                                                                                                                                                    |
| `SIGNAL_ROOM_TTL_MS`            | `21600000`                                                                                                                                                                                                                   |
| `SIGNAL_HOST_TIMEOUT_MS`        | `120000`                                                                                                                                                                                                                     |
| `SIGNAL_MAX_LISTENERS`          | `24`                                                                                                                                                                                                                         |
| `SIGNAL_TURN_CAPABILITY_TTL_MS` | `120000`                                                                                                                                                                                                                     |
| `SIGNAL_CONTRIBUTION_RPC_URL`   | `https://eth-rpc-testnet.polkadot.io/`                                                                                                                                                                                       |
| `SIGNAL_CONTRIBUTION_CHAIN_ID`  | `420420417`                                                                                                                                                                                                                  |
| `SIGNAL_CONTRIBUTION_DIRECTORY` | `0x8e611ef60169f8ed93019de4a3034a504ae2ad29`                                                                                                                                                                                 |
| `SIGNAL_CONTRIBUTION_API_URL`   | `https://dotify-api.fly.dev/api`                                                                                                                                                                                             |
| `SIGNAL_ALLOW_MISSING_ORIGIN`   | `true`                                                                                                                                                                                                                       |
| `SIGNAL_ORIGINS`                | `https://muzinga.netlify.app,https://dotify-test01.dev-dot.li,https://dotify-test01.app.dev-dot.li,https://dotify-test01.app.dot.li,https://dotify-test01.dot,polkadot://dotify-test01.dot,polkadot://app.dotify-test01.dot` |

The production origins are public configuration tracked in
`web/fly.signal.toml`; they are not secrets. Temporary preview origins may be
set through Fly configuration, but the tracked production allowlist must be
restored after validation.

Set `SIGNAL_TURN_CAPABILITY_SECRET` as a Fly secret on `dotify-signal`, using
the exact same 32+ character random value stored as `TURN_CAPABILITY_SECRET` on
`dotify-api`. Rotate both services together. A mismatch disables TURN relay
access while leaving room signaling and direct/STUN WebRTC available.

`SIGNAL_ALLOW_MISSING_ORIGIN=true` exists for Polkadot Desktop/native hosts
whose Socket.IO handshakes omit the `Origin` header. It does not allow the
literal `Origin: null` value from sandboxed iframes or `file://` pages. Keep it
scoped to signaling only; the backend API still requires explicit CORS origins
because it serves authenticated upload and key-delivery routes.

`/status.rooms`, `rooms:list` and `rooms:updated` return empty arrays. Opening a
room is no longer global discovery consent, and publishing Nearby must not
bypass the host radius through another endpoint. Check capacity through
admitted join/resume replies and the server-enforced `ROOM_FULL` boundary.
`/health` still exposes aggregate operational counts without room identifiers.

When a room track has a valid content hash but no runtime address, signaling
uses `SIGNAL_CONTRIBUTION_API_URL` to request the catalog release by hash. It
repairs the ephemeral room metadata only when the API snapshot is fresh and the
hash has one active release, then independently verifies the release, artist
runtime and directory registration through `SIGNAL_CONTRIBUTION_RPC_URL` before
rebroadcasting it. Concurrent joins share one recovery attempt, and a track
change during verification cannot be overwritten. API/RPC outages, stale
catalogs, ambiguous hashes, inactive releases and runtime conflicts fail closed:
the Tip action remains unavailable. Deploy signaling for this behavior. Its
existing contribution API/RPC settings must be configured; creating an attestor
and approving its address in an artist policy are separate owner-authorized
activation steps. No frontend, API or storage migration is required.

### Room contribution activation (2026-10-08)

Following explicit owner approval, signaling candidate
`fa3b6d88e1ff4c897cb36e4ce225684d12198fc6` was deployed as
`registry.fly.io/dotify-signal:deployment-01M4CRA7K6GEAWZRCGAN3S3E1E`, image
digest `sha256:03c072d68118e1dd5e73232cdec88b5519f04e53d8aeaf0448aab6afc398e562`.
Machine `d8d5205f929e28` remains the only writer/process in AMS (version 27).
The four public contribution settings above and dedicated
`SIGNAL_CONTRIBUTION_ATTESTOR_KEY` are active; the existing TURN secret remains
deployed. No private key was printed or saved to a local file.

The active attestor's public address is
`0xFa4A67C1b4f1E6fC6d39b0A0df4f4a4a7343aE19`. The runtime owner approved this
address for the profile policy of
`0xB60e91CcAcD08B6cb0Ddb2E678F90791901e9338` in transaction
`0x95fc6d47c147b52b5b33ee78c0537603b9c18d29d39c3d15b1a3d3e8dc684601`,
canonically finalized at block `14164663`. Read-back at
`2026-10-08T03:18:24.112Z` verified the policy's automatic version change from
1 to 2 and that only `roomAttestor` changed. All existing destinations, shares,
dates, campaign and description were retained; the work policy for Mon cerveau
was unchanged and inherits the profile authority.

Live checks passed: service health, origin allow/deny behavior, temporary
walletless join, and recovery of Mon cerveau's missing runtime from a Product
Fetch-polling host. Host and guest received the verified runtime and public
`/status` contained it at `2026-10-08T03:22:08.026Z`. Source-bearing fields
remained absent. A separate isolated server-local signature check recovered the
configured attestor and matched the contract's finalized quote; it did not
exercise a real signed-in host session or send a payment. The deployed server
file hashes match the tested candidate. All temporary rooms were closed.

The restart cleared the in-memory rooms; recreate them. If a connected host has
no current Dotify session, People > Receive room tips starts the usual sign-in.
Physical-device contribution-sheet/quote confirmation, funded settlement and
native room-chat notification remain acceptance gates under #229. The API and
Product 0.1.42 executable were not redeployed. A rollback restores the previous
signaling image; revoking the artist's authority requires a separately approved
policy update preserving all other current fields. Retain the dedicated secret
for recovery/rollback until policy and deployment no longer refer to it.

For a candidate build with `VITE_DOTIFY_DEBUG_PANEL=true`, the Product room
smoke panel exports the host-side evidence accepted by the Product journey
harness. It derives room creation, stream readiness, peer connection, listener
count, and canonical room URL from current room state and bounded telemetry.
The operator must still confirm the ordinary browser guest was walletless,
heard audio, and displayed `In sync`; those facts cannot be inferred honestly
from the host. The export rejects cross-candidate CIDs and contains no wallet
address, SDP, ICE candidate, IP address, key, signature, token, or audio.

Do not store `SIGNAL_ORIGINS` as a Fly secret. If `/health` reports an old
`allowedOrigins` list after deploy, the secret is probably overriding
`web/fly.signal.toml`. Remove it and redeploy or let Fly restart the machine:

```bash
cd web
flyctl secrets list -c fly.signal.toml
flyctl secrets unset SIGNAL_ORIGINS -c fly.signal.toml
flyctl deploy -c fly.signal.toml
```

The `app.dev-dot.li`, `app.dot.li`, `.dot`, and `polkadot://...` Product host
origins are required for both services when observed in the host logs or mobile
diagnostics. If an active host origin is missing, the Host shell can still
render the static app, but catalog requests lose their CORS response header and
Socket.IO polling is rejected with `403`, producing an empty music view or
preventing room creation.

Polkadot mobile host room creation also has a runtime host-permission preflight,
not only Fly CORS. Product executable `[0, 1, 6]` and later requests `WebRtc` before the
domain-scoped `Remote` permission. This order matters because the current
Product Mobile bridge can fail while encoding `Remote`, while signaling fetches
still work and `WebRtc` may still be grantable. Explicit host denials stop room
creation with a user-facing message. The known internal permission-preflight
exception (`... is not a function ... undefined`) is treated as unsupported for
that individual permission, and Dotify still checks the other permission before
opening signaling. The Product build uses
Engine.IO's fetch-based polling transport because the failing Product Mobile
runtime reached `/health` through `fetch` while its Socket.IO XHR polling did
not connect. Product host containers remain on Fetch polling for the whole
room; they do not attempt a WebSocket upgrade. Standalone browsers may still
upgrade to WebSocket. If mobile still shows `Room service unavailable` and Fly
logs show no new `/health` or `/socket.io` request, debug the Product host
remote-network layer before changing Fly origins again. If `/health` appears
but `/socket.io` does not, confirm the deployed Product executable is version
`[0, 1, 6]` or later before investigating Fly.
Product executable `[0, 1, 9]` requests `Remote` for both
`dotify-signal.fly.dev` and `dotify-api.fly.dev`, because room WebRTC startup
uses signaling plus the API TURN grant route before creating peer offers.

Product executable `[0, 1, 6]` and later also retries host audio capture when a listener
arrives before Product Mobile has produced a local WebRTC audio track. This
prevents the listener from staying on `Connecting...` merely because the host's
first capture attempt happened before the mobile media element was ready. It
also preserves trickled ICE candidates delivered before the SDP offer, retries
one failed listener negotiation, and replaces an unbounded `Joining live audio`
state with a permission, missing-offer, or TURN-specific diagnostic.
Product executable `[0, 1, 8]` also sends a near-silent placeholder offer while
the real host capture finishes, then replaces that sender track once the media
element exposes live audio. This makes a listener retry observable at the
WebRTC layer instead of timing out as "host sent no offer".
Product executable `[0, 1, 9]` closes the remaining room-open race by carrying
the resolved playable `audioSource` directly from catalog selection into
session creation. A host that has just resolved a playable track can therefore
prepare a placeholder offer even before React has propagated the new audio
source through provider props.
Product executable `[0, 1, 10]` normalizes API TURN grants to the smallest
widely compatible `RTCIceServer` shape before handing them to WebKit, wraps the
entire listener answer path in an explicit phase error, and emits metadata-only
`webrtc:diagnostic` events. The diagnostic contains no SDP, ICE candidate, IP
address, media identifier, content key, or user-agent string.

Product executable `[0, 1, 11]` and later handle the current iOS Product
sandbox boundary explicitly. The upstream Product container freezes and removes
[`window.RTCPeerConnection` during container lockdown](https://github.com/Polkadot-Community-Foundation/polkadot-ios-community/blob/main/Packages/Products/product-container/src/index.ts#L79-L81);
granting the `WebRtc` remote permission does not
restore that JavaScript API. Dotify therefore blocks mobile in-container room
hosting before creating a room and replaces futile listener retries with a
**Continue in browser** action. The action uses the Product SDK `navigateTo`
host bridge and only accepts the configured HTTPS `VITE_PUBLIC_APP_URL`. A
listener keeps the current `#/rooms/<id>` route; a would-be host opens the
canonical Dotify browser app and creates the room there.

This boundary occurs before ICE gathering. When diagnostics show
`listener:create-peer-failed`, `peerConnectionAvailable=false`, and
`protocol=polkadot:`, no TURN allocation is expected in coturn logs. Do not
change relay ports, credentials, or firewall rules for that failure. Coturn is
relevant only after peer construction, when diagnostics show a later ICE or
connection-timeout phase with `peerConnectionAvailable=true`.

The tracked Product profile currently has no `VITE_TURN_URL`,
`VITE_TURN_USERNAME`, or `VITE_TURN_CREDENTIAL`. Product builds should normally
receive TURN through the API grant endpoint instead of embedding static
credentials. Without `TURN_URLS` plus relay credentials on `dotify-api`, rooms
use direct ICE with public STUN only. This works on permissive networks but
does not guarantee a web or mobile host can reach a listener behind a different
carrier, VPN, corporate firewall, or symmetric NAT. For that topology, provide
a TURN relay, configure the API `TURN_*` variables, redeploy `dotify-api`, and
then redeploy Netlify / republish Product only if browser-visible `VITE_TURN_*`
fallback values changed.
Product executable `[0, 1, 7]` is the first Product version that fetches the
API TURN grant before opening WebRTC peers.

An open room now survives a transient host signaling disconnect for up to
`SIGNAL_HOST_TIMEOUT_MS` (currently 120 seconds). The server removes the room
from public discovery while the host is offline, retains connected listeners,
and accepts `room:resume` only with the random resume token returned privately
at room creation. The browser keeps that token in memory only; Fly stores only
its SHA-256 hash in the in-memory room record. A successful reconnect republishes
the room and rebuilds host-to-listener offers. An explicit **Leave room** still
closes immediately, and an unrecovered room closes at the existing host timeout.
This behavior requires both the updated `dotify-signal` deployment and Product
executable `[0, 1, 10]` or later.

`dotify-signal` logs room lifecycle events plus coarse peer-signaling events:
`listener:ready`, `peer:route` for `webrtc:offer` / `webrtc:answer`, and
`peer:route-dropped` when a role, target, or room check rejects an SDP route.
Executable `[0, 1, 10]` and later also report `webrtc:diagnostic` on answer creation,
ICE gathering, or connection timeout failures. ICE candidates are intentionally
not logged per message. If an offer is present with no answer, read the next
`webrtc:diagnostic.phase`: `create-peer` points to the Product host WebRTC
runtime/permission boundary; `set-remote-description` points to SDP/runtime
compatibility; and a later connection timeout or ICE candidate error points to
the TURN/network path.

Keep `dotify-signal` on one active machine until a shared Socket.IO adapter is
added. Rooms, chat, reactions, request queues, and solo-presence aggregates are
currently in memory.

## Validation Checklist

After changing Netlify or Fly dashboard values:

1. Trigger a new Netlify deploy for frontend `VITE_*` changes.
2. Check Fly secret overrides before debugging stale CORS. `API_ORIGINS` and
   `SIGNAL_ORIGINS` should not appear in `flyctl secrets list`; they are
   tracked non-secret config.
3. Restart or redeploy the affected Fly app after secret/runtime changes if the
   platform did not already restart machines.
4. Confirm the backend:

```bash
curl -s https://dotify-api.fly.dev/health
curl -s https://dotify-api.fly.dev/health/ready
curl -s https://dotify-api.fly.dev/api/catalog
curl -s https://dotify-api.fly.dev/api/turn/grant
```

5. Confirm signaling:

```bash
curl -s https://dotify-signal.fly.dev/health
curl -s https://dotify-signal.fly.dev/status
```

6. Run local smoke checks when the repo is available:

```bash
cd web
npm run smoke:production-env
npm run smoke:signal -- --url https://dotify-signal.fly.dev --origin https://dotify-test01.app.dev-dot.li
npm run smoke:signal -- --url https://dotify-signal.fly.dev --origin https://dotify-test01.app.dot.li
npm run smoke:signal -- --url https://dotify-signal.fly.dev --origin https://dotify-test01.dot
npm run smoke:signal -- --url https://dotify-signal.fly.dev --origin polkadot://dotify-test01.dot
npm run smoke:pilot-release -- --md-out /tmp/dotify-pilot-release-readiness.md --json-out /tmp/dotify-pilot-release-readiness.json
npm run build:product-devnet
```

`smoke:pilot-release` is read-only. It reconciles W01-W12 evidence, Product
static gates, the reversible W13 release plan, optional Product/room smoke
exports, and optional aggregate pilot evidence. Missing live Product or
participant evidence remains `blocked` or `not-run`; it is never counted as a
passing pilot. If `--pilot-json` is supplied, it must use schema v2 and bind the
decision to the candidate git SHA, Product appVersion, deployed CID, capture
time, outcome metrics, privacy flags, rollback, and join-count invariants.

7. For a Product release, complete the cross-origin room, mobile host
   permission, and host-account
   checks in
   [`docs/operations/product-devnet-deployment.md`](product-devnet-deployment.md).

8. For explicit origin rejection evidence, include a denied origin:

```bash
cd web
npm run smoke:signal -- \
  --url https://dotify-signal.fly.dev \
  --origin https://<frontend-origin> \
  --denied-origin https://not-dotify.example
```

9. Attach evidence to the PR when the active ticket requires public validation.
   For ticket #86, include `GET /api/catalog` state, block lag, and warm/cold
   catalog timing evidence.

## Update Checklist For Future PRs

When implementation changes env or hosted settings, update all applicable
places in the same PR:

| If the change affects                                                             | Check/update                                                                          |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Any env var contract                                                              | `docs/reference/environment-variables.md`, relevant `.env.example`, this runbook      |
| Netlify build or browser env                                                      | `netlify.toml`, `web/README.md`, this runbook                                         |
| Backend API env, secrets, CORS, uploads, keys, catalog                            | `services/api/.env.example`, `services/api/fly.toml`, this runbook                    |
| Signaling env, room limits, origin policy, scaling                                | `web/.env.example`, `web/fly.signal.toml`, `web/README.md`, this runbook              |
| Public URLs, contract addresses, production priorities, or architecture narrative | `README.md`; update `docs/index.html` only when the public project page should change |
| Security boundary                                                                 | relevant threat model or explanation doc plus this runbook                            |
| PR validation process                                                             | `.github/pull_request_template.md` if the checklist itself changes                    |

## References

- `docs/reference/environment-variables.md` is the complete variable reference.
- `web/README.md` contains local frontend and production deploy commands.
- `services/api/.env.example` is the local backend API template.
- `web/.env.example` is the local frontend/signaling template.
- Netlify project environment variables:
  <https://docs.netlify.com/build/environment-variables/get-started/>
- Fly app secrets:
  <https://fly.io/docs/apps/secrets/>
- Fly app configuration:
  <https://www.fly.io/docs/reference/configuration/>

## Shared-presence room rollout

As of the 2026-10-28 source update, **Room view → Radar / List** is the supported
presentation. The optional Three.js renderer and `VITE_DOTIFY_ROOM_GALAXY` are
removed. Delete that obsolete setting from hosted dashboards when convenient;
it has no effect in new builds. Existing releases retain their old behavior.
This frontend-only cleanup needs no server restart, schema change or permission.
Both views retain the same scoped Nearby/Worldwide data and joining rules.

The room lineup remains part of the normal room protocol: the host publishes a
bounded metadata-only order through signaling and participants receive the same
ephemeral snapshot. It needs no frontend flag, key, CORS origin or storage mount.

For the reliable composer, release the signaling `room:chat` / `room:request`
acknowledgement support before or together with the frontend. Old clients remain
compatible. New clients retain drafts and warn if an old server cannot confirm
acceptance within five seconds. Check the room before resending an unconfirmed
message; there is no automatic retry or exactly-once guarantee. Request capacity
and social rate limits remain server-enforced. Reactions are not buffered during
transport loss.

The 2026-10-11 quiet room-controls follow-up is frontend-only. It uses the
existing suggestions, replies, pin and host-tip binding protocol, with no new
environment variables, server release, permission or migration. After publishing
it, check host versus guest Queue, catalog search with the mobile keyboard open,
the message **…** actions by touch and keyboard, right-swipe reply versus vertical
scroll, and local **Room activity** filtering on web and the installed Product
host. **Enable host tips** is the renamed explicit account binding, not a new
payment or a change to artist-selected shares. See
[room conversation controls](../explanation/room-live-conversation.md#quiet-controls-and-role-specific-queue--2026-10-11).

The room lineup requires a coordinated frontend/signaling rollback because old signaling
servers ignore its events while the current frontend keeps playback functional.
Nearby is included by default in new Web and Product builds; use the Nearby
configuration and validation gates documented below before release. Community memory remains
documentation only. The original shared-presence pass added no location
permission. See
[shared-presence pass](../design/dotify-shared-presence-pass.md).

## Product unsigned access-approval recovery, 2026-10-26 (prepared)

New Classic access payments fence the exact Product signer for the lifetime
of one SDK submission attempt. Only a typed SDK timeout, or the Host's
`createTransaction` timeout, before any real signed transaction returns and
before any SDK signed/submission evidence can become **Try payment again**.
The signer is closed before releasing that attempt's reservation; a late Host
reply cannot enter broadcast. Mock/dry-run signing is not approval evidence.
Generic RPC errors, returned signatures, hashes and old unresolved journals
retain read-only recovery. Fresh entitlement checks still precede a new request.
No existing journal, epoch, key or receipt is cleared by installation.

Deploy matching Web/Product clients after review; API, signaling, encoder,
contracts, SDK dependencies, permissions and deployment variables are unchanged.
On physical Desktop/mobile, leave an approval unopened until it expires, retry
explicitly, and also test a timeout after signing. Only the former may offer a
new request. Preserve old uncertain attempts and compare account activity;
local fixtures do not prove that a historical attempt was never submitted.
See [payment recovery](../how-to/recover-a-payment.md). This is prepared code,
not evidence of a deployed correction or a new funded transaction.

## Product artist-support validation profile

`npm --prefix web run build:product-devnet:support` selects the existing explicit
`VITE_DOTIFY_RUNTIME_ADAPTER=product-cdm` profile for native Polkadot App support.
It builds only; it does not deploy or alter the default tracked Product profile.
The API/key authority, CORS and contract addresses remain unchanged. Product
payments request finalization before returning. Classic support recovery now
uses a durable browser journal scoped by network/adapter endpoint, payer,
runtime and content hash, migrating the matching old tab-local reference.
See [current payment recovery boundaries](../how-to/recover-a-payment.md)
and [the original support recovery design](../design/product-host-support-recovery-2026-09-15.md).
Before promotion, verify balance/fee availability and SDK lifecycle on a real
Product host, close/reopen pending feedback, and reopen an uncertain payment
after closing the tab. None of those recovery checks should request a second
payment. Test on the intended deployment origin: host storage isolation or a
changed origin/RPC endpoint can prevent earlier references being found.

Promote only after the existing W11 host approval/value-forwarding/access smoke
has real device evidence. Check native transaction-reference explorer support.
No real signing or funded transaction was performed as part of implementation
checks. Roll back the frontend to the previous profile; no contract or backend
migration is required. Preserve/check unresolved payment references before
clearing host/browser storage.

Gifts and tips are native UI; `VITE_DOTIFY_ARTIST_DONATIONS` is retired.
Gifts use the artist's profile allocation; work tips preserve collaborator
splits after an optional host percentage is deducted from the whole room tip. Both require an
upgraded contribution runtime and keep listening access unchanged. Product
signing still requires the CDM writer profile. Live host validation and
owner-approved upgrades are separate release gates. See
[native contributions](../design/native-contributions.md).

### Native contributions activation (2026-10-01)

This section describes a release procedure, not an executed deployment. Keep
the same chain/runtime addresses: encrypted keys and previous purchases are
bound to them. Do not replace artist runtimes to obtain the new functions.

1. Review and test `MusicContributionsPallet`/`MusicRoyaltiesPallet`, regenerate
   frontend ABIs and the merged CDM ABI with `npm run generate:abis` in
   `contracts/evm` and `npm run generate:cdm` in `web`.
2. Use the existing `runtime:deploy-royalties-facet` dry run and explicit
   code-hash confirmation for a separately authorized facet deployment. For
   each runtime, use `runtime:royalties-upgrade` dry run, review its Add/Replace
   selectors and snapshot, then obtain the owner's confirmation before execute.
   Existing factory contracts are immutable: their old bootstrap will not
   install new selectors. Upgrade newly created runtimes too, or separately
   review deployment of an updated factory against the existing directory.
3. Deploy the API exposing `/api/auth/identity`, then signaling and the frontend.
   Product writes need `VITE_DOTIFY_RUNTIME_ADAPTER=product-cdm`; no donation
   feature flag is needed. The viem build continues to use browser-wallet writes.
4. Configure the signaling-only settings below. Verify the chain and directory
   against the deployment manifest; never put the attestor key in a Vite value.
5. In Artist > Rights, approve the attestor's public address under Campaign and
   room verification, and choose the profile/work allocations, schedule and
   optional host share. A work can inherit the profile's room authority.
6. A connected host with a valid Dotify sign-in session is bound automatically.
   Otherwise use Receive room tips to perform the normal sign-in. A listener
   never needs that session merely to hear the room. Current clients publish the
   work runtime directly. For older/cached clients, signaling may recover a
   missing runtime only from one fresh catalog match that also passes on-chain
   runtime and directory verification; otherwise tips stay unavailable.
7. With separately authorized test funds, inspect and confirm one gift, one
   direct tip and one room tip on the intended Product device. Verify exact
   recipient amounts, canonical dated receipts, host allocation, a single chat
   notification, earnings refresh and pending/reload recovery without repayment.
   Repeat outside the scheduled interval and after a policy change.

| Server-only setting                | Purpose                                                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `SIGNAL_CONTRIBUTION_ATTESTOR_KEY` | Dedicated unfunded EVM signing key for room context proofs; use the host secret store. No fallback key exists. |
| `SIGNAL_CONTRIBUTION_RPC_URL`      | Public EVM RPC for the deployed artist runtimes.                                                               |
| `SIGNAL_CONTRIBUTION_CHAIN_ID`     | Exact EVM chain ID, checked against the RPC.                                                                   |
| `SIGNAL_CONTRIBUTION_DIRECTORY`    | ArtistDirectory address from the manifest.                                                                     |
| `SIGNAL_CONTRIBUTION_API_URL`      | Trusted API base including `/api`, e.g. `https://dotify-api.fly.dev/api`; validates host bearer sessions.      |

No new storage mount is required. Contribution ledgers are on-chain; browser
storage holds recovery references and rooms hold only ephemeral context/chat.
Keep bearer authorization headers out of proxy logs. Server-to-server identity
verification does not require widening browser CORS. The artist-approved
attestor is a centralized trust boundary for room attribution; rotation also
requires updating artist policies. Already issued proofs live at most ten
minutes and are bound to one payer/intent/amount.

On rollback, retain contribution claim selectors and storage so rejected
recipients can still recover their funds. Stop new room proofs if needed and
revert the frontend while preserving local recovery records. Do not blindly
replace the upgraded facet with an old one that omits contribution claims.
The former claimable-royalty balance and contribution claim balances are
separate; legacy receipts and old direct wallet gifts cannot be reclassified.

## Nearby pilot configuration (W19)

Nearby is included by default in new Web/Product builds and single-worker
signaling. Existing published artifacts/settings are not changed by this PR.
The listener shell automatically initiates permission-gated location search at app entry; room visibility still requires an explicit host choice.

The 2026-10-15 correction makes every new room link/code-only by default.
Deploy signaling before the frontend so old clients cannot enumerate private
rooms through `rooms:list`, `rooms:updated` or `/status`. Nearby opt-in remains
bounded by both radii; it never populates a global room list. Frontend creation
offers **Link only** (default), **Nearby**, or **Everyone**, with a 5–42 km slider (1 km steps) for geographical discovery. Permission starts only after explicit submission for the newly created
room; denial or disconnect keeps direct-link hosting available. Share links
must join using their code without waiting for discovery metadata.

Global Statement Store beacon hooks are disconnected from the application,
including when the old beacon environment setting is `on`. Archived beacon
modules remain available for research but cannot advertise current rooms.
Artist/home dashboards have no global room index; lack of listed rooms is not
evidence of no listening. Existing invitation-based artist visits still work.
Keep `VITE_DOTIFY_ROOM_REALTIME=off` for this rollout: its separately authorized
measurement modes can publish public presence independently of Nearby.
Rolling back signaling to an older image restores automatic global listing:
do not use that rollback while promising link-only/radius-limited discovery.

Product `[0, 1, 50]` was published from tested source `e4ce5a1`, based on merged #280/#281.
It preserves `product-cdm` on `devnet`, refreshes the public catalog snapshot
and matching deterministic fixture, and removes the retired Paseo IPFS reader
from Netlify's tracked fallbacks. Deploy signaling first, then verify client
SHA/version/CID. Signaling release 31 and finalized Product read-back passed;
physical-device acceptance remains separate. See the
[0.1.50 rollout](product-devnet-deployment.md#product-0150-published-radar-and-audio-release).

The 0.1.49 test release packages `shared` alongside `server` in
`web/Dockerfile.signal`; omitting the geometry module prevents signaling from
booting. Run the packaged-runtime smoke in `npm --prefix web run test:signal`,
then verify one active worker and `nearbyEnabled: true` after rollout. This
release increments the Product executable identity, retaining the native
runtime profile and existing origins. Installed-device evidence remains pending.

| Setting              | Default         | Effect                                                                                                                                   |
| -------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_DOTIFY_NEARBY` | unset → enabled | Unset or exact `on` includes Nearby in both Web and Product. `off` or an invalid value disables UI and effects. No URL/storage override. |
| `SIGNAL_NEARBY`      | unset → enabled | Unset or exact `on` registers handlers; `off` or an invalid value returns `DISABLED`. Requires single-worker signaling.                  |

Use the existing HTTPS signaling origin/CORS policy and room transport. No new
service, port, third-party geocoder, storage mount, secret or Product permission
is required. Standalone device mode requires secure context, Geolocation and
Permissions APIs. Product device location is included under the same Nearby
setting and requires the same secure-context/browser APIs and an explicit SDK `Location`
grant. The grant alone never proves WebView geolocation support. The tracked
Product profile needs no additional feature flag; no manifest permission is added.
Remove obsolete `VITE_DOTIFY_PRODUCT_NEARBY_LOCATION` settings during the next
release. Audit existing explicit `off` settings: they still disable Nearby, even
though unset now includes it. This PR does not change hosted dashboard settings.

The automatic radar uses separate foreground Nearby (15-second refresh) and
Worldwide (30-second) read channels. Every Product fix rechecks the SDK Location
gate before starting native geolocation; no silent observer or perpetual grant is
assumed. Denial blocks automatic retries for the page lifetime. Pause, hidden,
pagehide and disconnect abort pending work; eligible listener reads resume after
foreground/reconnect cooldown. Host publication does not resume automatically.
Browser containers without a permission observer retain bounded snapshots.
No city exploration remains; Worldwide and links work without a location fix.

Search v3 returns five-kilometre distance bands, never cells/bearings or precise
coordinates. Worldwide distance is absent. Search leases last up to 45 seconds,
limited by remaining host presence; cards expire independently while refreshed
results remain inspectable/joinable. The radar is illustrative, not a map.

Build a test artifact without publication or catalog refresh:

```sh
npm --prefix web run build:product-devnet:frozen
```

Keep signaling single-process. Before publication, record the exact Host/device versions and validate
the checklist in [W19 Product location evidence](../backlog/implementation/evidence/W19-product-location.md).
Compilation and the fake-Host browser fixture are not physical capability proof.

The first version is **single-process signaling only**. Presence is held in
memory outside public room state, expires strictly at 90 seconds, and is
removed on disconnect/room close. Requests prune expired entries; the existing
30-second sweep reclaims idle entries. Budget hashes expire after 60 seconds.
There are at most 10,000 presence records and 20,000 rate-budget records.
No nearby state belongs in Redis persistence, backups, catalog snapshots,
browser storage, Statement Store, analytics or crash reports. Do not log
Socket.IO request/response bodies. Operators still see network/coarse-area
context in memory; this is not anonymity.

`/health` reports `nearbyEnabled` and cumulative searches/publications/reports/
throttled counters only. No area or identifier appears there. Reports are
aggregate signals, not a staffed abuse inbox. Review this limit before broad
public enablement. Search/publish/report limits are 6/12/3 per minute per
socket and 60/120/30 per shared network. Worldwide reads have an independent
search bucket. Pending clicks coalesce and the UI shows a 10-second scan cooldown
(60 seconds after throttling); it does not silently retry throttles.

**Do not enable with multiple workers yet.** A Socket.IO adapter alone does not
coordinate presence and rate limits. A future topology must use an ephemeral
TTL store and shared network budgets, authenticated host ownership, atomic
revoke/refresh ordering and restart/partition tests. Redis could serve that
role with persistence disabled; it is not needed for this single-worker pilot.

Before enablement: review W19 evidence, conduct an authorized physical-device
permission/denial/revocation/background check for each exact browser and Product
version, and validate independent-network discover → Join → audio under W13/#89.
Use synthetic coordinates in captured artifacts; never capture a participant's
real position. Confirm coarse-only wire bodies, expiry, host/listener radius
asymmetry, permission-gated startup search with no automatic host publication, explicit
rollback-off and links from outside the area.

Rollback: set `SIGNAL_NEARBY=off` and restart signaling (clears all presence),
then rebuild with `VITE_DOTIFY_NEARBY=off`. This restart ends active rooms, so
schedule it deliberately. Frontend-only rollback stops collection/refresh;
old remote presence expires within 90 seconds. Offline opt-out clears local
state immediately and displays that expiry limit. Connected `nearby:off`
uses a non-volatile packet, including during polling backpressure; disconnected
requests are rejected without buffering a send after reconnect. No contracts/keys/catalog
migration or payment is involved. Local tests cover feature-off and empty
fresh-store behavior; no live rollback has been performed.
Product shares the main Nearby disable with ordinary Web. Existing remote presence expires within 90 seconds; there is no separate Product experiment setting.

## Discovery and Host recovery rollout — 2026-10-15

Executed on 2026-10-16 as Product 0.1.51 from `cdb9ac2`, with signaling release
32 and API release 26. Exact published identities, independent read-back, live
checks, the active-room restart incident and rollback are in the
[rollout record](../backlog/implementation/evidence/product-0.1.51-rollout-2026-10-16.md).
At that rollout, Netlify was validated at merged application commit `974568c`. Subsequent merge-triggered Web builds require independent SHA/config-digest validation; that earlier record does not validate future bundles. Native Host
location/audio/approval checks remain physical acceptance gates.
Before restarting, recheck active rooms/listeners and bind validation to the
mutation with fail-fast execution (`set -euo pipefail` or an explicit successful
condition). A failed assertion on one shell line must never fall through to a
deploy on the next line. If rooms appear during preparation, evaluate the
interruption before proceeding; an earlier zero-room snapshot is insufficient.

Deploy signaling before clients for the 5–42 km/worldwide protocol extension.
An old server safely rejects extended radii and worldwide payloads; it cannot
provide the new UI's default public invitations. Keep legacy global enumeration
empty on rollback. There are no new environment variables, secrets, Redis stores,
CORS origins or scaling changes. The operator disable still covers all discovery.

Then deploy the API cover-upload correction and Web/Product clients. Pinata uses
the outer submitted directory as the returned CID root. A transport-only `dotify/`
envelope now preserves the documented `cover/640.webp` path inside that root.
Existing flattened pins use a narrowly scoped same-CID native fallback to
`640.webp`; cache entries retain the actual path, never an alias to different bytes.
A real new upload/read-back through Pinata remains a deployment acceptance check.

DAV2 range reads now separate a 12-second header timeout from a 15-second body
inactivity timeout, bounded by the requested range length. A progressing segment
may take longer than 12 seconds. Access verification, authenticated decryption and
complete-file recovery remain unchanged. This does not guarantee upstream availability.

On Product Desktop 0.1.3 / App 0.10.0, verify the asynchronous Location permission
and native fix physically. Desktop source rejects synchronous permission checks
while deferring to its asynchronous gate; do not abort between those steps.
Mobile waits up to 32 seconds for an accurate fresh fix. The automatic-radar amendment below replaces the old snapshot-only flow with foreground grant/fix refreshes. Recheck denial, revocation,
background/return, scan completion, worldwide opt-out and host tips on both devices.
A rejected HTTP-401 host session can renew once; network failures must not loop signatures.

## Automatic room galaxy rollout — 2026-10-16

Deploy signaling with **v3 search** support before Web/Product clients. The new
server still accepts v2 searches and returns their exact previous shape; publication
remains v2. A new client against an old server fails discovery closed. It must not
fall back to unrestricted global room listings. Keep the new server when rolling
back clients. No API, contracts, credentials, CORS origins, storage, scaling or
manifest changes are required. Never deploy/restart over active rooms without the
existing drain procedure. This change itself does not publish a release.

Before Product promotion, test the exact Desktop/mobile versions with two consented
devices: first permission prompt, fresh fix, automatic rediscovery after host opt-in,
foreground return, denial without prompt loops, SDK revocation on the next refresh,
no repeated permission dialog after a grant, and continuous audible playback while
browsing Rooms. Verify both radii, expired preview rejection, Worldwide availability
while location is pending, and Link only after default creation. Same Wi-Fi does not
substitute for a valid device fix. Use synthetic data in captures. The SDK fixture
and Chromium WebRTC test cannot prove native Host capability or location accuracy.

See [automatic radar evidence](../backlog/implementation/evidence/W19-automatic-room-radar-2026-10-16.md).

## Trusted pilot hardening (W30), 2026-10-16

Applies to the trusted pilot of at most 42 participants (W13 owner update).
No new service, store, region or secret value is committed.

| Service   | Setting                        | Value in Fly config                            | Effect                                                                                                                                                                                                                          |
| --------- | ------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API       | `API_TRUST_PROXY`              | `fly`                                          | Rate limits use the `Fly-Client-IP` header set by the Fly edge. Unset or `off` uses the socket address; never set `fly` where clients can reach the API without Fly.                                                            |
| API       | `CATALOG_SNAPSHOT_PATH`        | `/data/contributions/catalog.json`             | The snapshot survives redeploys, so key delivery does not wait for a cold reindex. Same volume as the contribution ledger.                                                                                                      |
| API       | `SESSION_REVOCATIONS_PATH`     | `/data/contributions/session-revocations.json` | Signed-out sessions stay signed out across restarts when `SESSION_EPOCH` is set.                                                                                                                                                |
| API       | `SESSION_EPOCH`                | Fly secret, not in `fly.toml`                  | 16-128 characters. Set it to keep sessions across redeploys; rotate it to sign everyone out. Unset keeps the per-process random epoch. If the revocation file is unreadable at boot, the API uses a random epoch (fail closed). |
| API       | `PASEO_ASSET_HUB_RPC_FALLBACK` | unset                                          | Optional second RPC for access checks. Each access read now times out after 4 s with one retry.                                                                                                                                 |
| Signaling | `SIGNAL_TRUST_PROXY`           | `true`                                         | Network limits use `Fly-Client-IP`, otherwise the last `X-Forwarded-For` hop. The client-supplied leftmost hop is never used.                                                                                                   |
| Signaling | `max_machines_running`         | `1`                                            | Rooms and limiters are process memory; a second machine would split rooms.                                                                                                                                                      |

Behavior changes: content-key responses carry `Cache-Control: no-store`; the
signaling service no longer broadcasts `rooms:updated` and coalesces solo
presence; room creation is limited per network and capped; both images start
Node directly and close cleanly on SIGTERM. The signaling image runs as the
`node` user. At that deployment the API image stayed root because the Fly
volume was root-owned. The 2026-10-21 preparation above supplies the remaining
non-root cutover; live validation is still required.

With a stable session epoch, logout returns HTTP 503 with
`SESSION_REVOCATION_UNAVAILABLE` if its revocation cannot be written. The token
is denied in memory, but logout is **not acknowledged** as durable. Repeated
logout attempts keep returning 503 until the pending revocation can be saved.
Repair the volume and retry before restarting: a restart against the older,
still-readable snapshot can restore an unpersisted token until its 24-hour
expiry. Rotate `SESSION_EPOCH` if that recovery cannot be completed safely.
An unreadable snapshot at boot still forces a fresh random epoch.

The PR #309 client retains failed logout credentials in a separate inactive,
API-scoped browser/Host storage queue before clearing the active session. A
503 or network failure shows an incomplete sign-out notice and retry action;
startup, online/foreground return and a foreground-only 60-second timer also
retry without signing or restoring the old session. Requests are coalesced,
limited to four in flight, and bounded to 15 seconds each. Only an acknowledged
logout or expiry plus a five-minute local clock margin removes retry material.
If storage is blocked, retries are memory-only: keep the app open until server
sign-out is confirmed. No environment change is required. Validate a simulated
503 followed by recovery in Web and Product; a successful wallet disconnect
alone is not proof of durable server revocation.

Deploy order: API, then signaling, then clients (no client change is
required). Before opening the pilot, record these read-only checks:

1. `fly scale show -a dotify-signal` shows one machine.
2. Watch `fly logs -a dotify-api` and `fly logs -a dotify-signal`, filtering for
   `network:client-identity`. From an ordinary external client, request API
   `/health` and connect to a room through the deployed signaling service.
   Each service records only its first **five trusted-header requests or
   connections per process**; direct probes without a trusted header do not
   consume samples. Existing samples from external traffic also qualify.
   The API sample must show `source: "fly-client-ip"` and
   `clientMatchesPeer: false`; the Fly signaling sample must show the same.
   This checks the **actual limiter resolver**, rather than Fastify's proxy
   socket address. Missing samples are inconclusive: check the trust settings
   and the current process's startup logs. Do not restart a live room service
   merely to collect another sample. A matching peer or unexpected source
   requires investigation before pilot acceptance. These bounded records
   contain no raw client/peer IP, wallet, token, room ID or coordinates; they
   demonstrate which source was selected, not cryptographic proof that a
   deployment's edge overwrites caller headers. Fly-only ingress remains a
   required trust boundary.
3. A room member receives TURN URLs from `/api/turn/grant`.

Rollback: redeploy the previous image; unset `SESSION_EPOCH` only if sessions
must be invalidated. No new environment variable enables the diagnostic.

Browser CI uses `web/e2e/fixtures/signaling-server.mjs`, which starts the real
server with a creation budget of 1,000/minute because isolated browser users
all share loopback. This fixture is excluded from the production image; the
production CLI retains 10/minute. Signaling integration tests independently
verify the production default and refusal behavior.

## Physical-test discovery follow-up — 2026-10-17

Deploy signaling with v4 discovery and authenticated `artist:rooms` before the
new clients. V2/v3 response shapes remain compatible. V4 carries safe canonical
cover references and exact listener counts; public artwork enrichment must not
make room discovery depend on a slow registry response. No new credentials,
contract, volume, CORS origin or infrastructure service is introduced. Artist
activity reuses `SIGNAL_CONTRIBUTION_API_URL`, chain and directory configuration
and the existing Dotify session. Keep one signaling worker. Use the existing
active-room drain/precheck procedure before rollout.

The host's chosen mode is now separate from its network lease. Backgrounding,
disconnect or lease expiry may remove live visibility without resetting the chosen
mode. Transient refresh errors retain only the still-valid lease; foreground
recovery rechecks permission and renews the same scope. Explicit
Link only cancels renewal and preserves the unacknowledged-removal warning until
confirmed. The client never stores location history or publishes while hidden.

Verify two-client count/orbit updates, return to own room without rejoining,
selected scope across lease/reconnect failures and explicit opt-out. For an
artist, verify aggregate private-room counts without private identifiers and
public room access across radius; another account must be refused. Revalidate
Product location on installed Desktop/mobile before claiming it works: an SDK
permission grant is not evidence that the native WebView supplies coordinates.
A failed Host fix must offer an honest recovery path while Worldwide/link access
remains usable. This implementation does not deploy itself.

Native-location source audit and exact automated evidence live in
[W19 physical-feedback evidence](../backlog/implementation/evidence/W19-room-feedback-2026-10-17.md).
The installed Desktop 0.1.3 permission callback was inspected, but successful
coordinates were not established. Current upstream iOS still marks its native
location bridge as TODO; it is not proven to match the user's mobile 0.10.0
package. Dotify must not add an IP-based or credential-bearing fallback. The
explicit browser recovery uses existing `VITE_PUBLIC_APP_URL` and Host navigation,
always opening the discovery route `#/rooms`. Room codes and existing URL
queries/fragments are not transferred; hosting authority stays in Product.
Validate this recovery while hosting a room: the browser must show the radar,
without a join prompt or an automatic join using a remembered browser identity.

## Product artist bootstrap deposit correction, 2026-10-22

Product 0.1.58 can reach pending bootstrap stage 7 and then revert because its
contracts SDK sizes `storage_deposit_limit` from net charge rather than the
peak needed before intermediate refunds. The source correction sizes from
Revive's verified `max_storage_deposit` and waits for factory-step finality.
No environment, contract, secret, volume or API/signaling deployment changes.
A new Web/Product client publication is required after merge; this paragraph
does not claim the failing live executable has been replaced.

Do not redeploy an artist runtime stuck at stage 7 or wipe its pending state.
After publishing the correction, retry setup with the same connected artist;
the existing flow re-reads and resumes the pending runtime. Verify the directory
entry, artist ownership and cleared pending state after the user's approval.
See the [native replay and validation evidence](../backlog/implementation/evidence/product-artist-bootstrap-2026-10-22.md).

## Room-tip authority configuration correction, 2026-10-22

A current runtime can still lack room policy configuration. Connected hosts with
an active nonzero share require the artist's effective `roomAttestor` to match
the signaling signer; missing/mismatched configuration fails before submission,
without reducing the host's share. No active host allocation uses a direct tip
and the existing bounded room intent for confirmed chat announcements.

Deploy signaling and matching clients together. `GET /contributions/config`
returns only the public attestor address and chain ID from existing settings,
with no-store and existing CORS. There is no new secret or frontend signer.
Enabling host sharing in Rights & support automatically prepares the public
authority only if the work has no effective authority. Already enabled policies
with missing authority are also prepared on load. This is a local draft: the
artist reviews the explanation and approves Save contribution settings. Existing
custom authorities and profile inheritance remain under artist control; address
editing stays in advanced details. Failed lookups offer a retry and prevent an
unconfigured sharing policy from being saved. No automatic on-chain write occurs. Do not fill this on chain
with an operator signer. See [diagnosis and acceptance](../backlog/implementation/evidence/room-tip-verification-2026-10-22.md).

## Contribution contract validation and optimization, 2026-10-23

Source follow-up in #324 adds existence checks to nonzero `musicGiftPolicy`
scopes, contribution custom errors, and measured storage/loop optimizations in
the royalties facet/library. Profile scope zero, existing storage namespaces,
policy layout, function selectors, event payloads, paid access and pending
claims are preserved; the client royalties ABI is regenerated for typed errors.
An actual local baseline-to-candidate selector cut preserves catalogue, policies,
paid access, used intents and recoverable pending contributions. See the
[measurements and reproducible rehearsal](../backlog/implementation/evidence/contribution-gas-2026-10-23.md).

No live contract, factory, deployment manifest, CDM binding or artist policy was
modified. Web/Product publication alone will not activate these contract changes.
For existing artists, deploy and code-hash verify the reviewed royalties facet,
rehearse the current upgrade plan against native Product, and use the normal
artist-owner approval for selector replacement. Keep namespace storage intact;
do not reset purchases or pending balances. New runtimes need a separately
coordinated factory/facet configuration. The earlier signaling/client repair
works with the existing facet and can be rolled out independently. Local EVM
gas reductions do not establish native Revive fee or storage-deposit savings.

## Publication recovery candidate, 2026-10-29

The [recovery investigation](../backlog/implementation/evidence/publication-preparation-recovery-2026-10-29.md)
and [streaming runbook](streaming-publication.md#diagnosing-a-failed-preparation)
record a provider admission gate: Pinata HTTP 403 can block publication after
encoding has succeeded. Check plan usage/permissions before retrying a saved
preparation. The UI correction must ship with the API's allowlisted stage/status
diagnostics; it cannot remove an external account limit. No secret, environment
variable, service topology or durable custody-schema change is required. Verify
one actual new release on Web and Product after rollout; retain the existing
native/payment acceptance gates. Never delete jobs or permanent nonce
reservations to make a deployment health check pass.
