# 0051 — Study packed media while preserving the start of listening

Date: 2026-11-11. Status: offline research; candidate for a later implementation,
**not an accepted production format or activation**. Refs #407.
Extends the alternatives in [ADR 0050](0050-bulletin-proof-reuse-and-wave-ordering.md),
without changing [ADR 0049](0049-bounded-direct-write-windows.md)'s finalized
child/root barriers or 16-store / 4-MiB window.
[Reproducible results](../backlog/implementation/evidence/bulletin-compact-layout-2026-11-11.md).

## Problem and research choice

The owner confirms the latest release publishes and plays, but reports 7 min
46 s before the wallet request. Captured submit/finalize calls average about
32 s. Completed proof reuse helps the work around those waits; a larger gain
needs fewer storage blocks/dependency stages. Raising write concurrency or
submitting parents before verified children would change different trust and
recovery rules and is not part of this study.

A checkout-only prototype compares standard UnixFS at 256/512 KiB and two
per-rendition segment packs at both sizes. All variants retain the same original
encrypted archive, all renditions, init objects and authenticated manifest bytes.
Packing concatenates existing ciphertext; it does not decrypt/re-encode media,
allocate real encryption nonces or change object AES-GCM additional data.

**Prefer the 256-KiB pack retaining init and the first segment as the next
implementation candidate**, subject to the gates below. A synthetic 108-block
case becomes 60 blocks / six equal-duration waves, from nine waves. Keeping
only init separate has the same six-wave result but forces a larger first-media
fetch. The first-segment-preserving choice keeps the startup payload separately
addressable. Random seeks/later segments can still overfetch, so it is not ready
for production or an assertion of faster first sound.

Standard 512-KiB chunks preserve current paths and pass the existing API reader
locally, but the 108-block case still takes nine modeled waves. It remains a
lower-intrusion control option, not the main proposed latency correction.
512-KiB packs reduce more block calls but not modeled waves at the unchanged
4-MiB bound in these cases, while amplifying cold reads more. Public cover and
metadata paths remain unchanged at three/two stages.

## Prototype data and integrity flow

The prototype uses `layout.json` with the explicitly experimental schema
`dotify.research.rendition-pack.v1`, a permitted chunk size and a strict startup
policy boolean. It keeps `manifest.json`, `archive/master.bin`, every init and,
for the preferred variant, every `segment-000.bin`. Remaining ciphertext objects
for each rate are concatenated in their authenticated manifest order into that
rate's `pack.bin`. No arbitrary external range table is accepted: offsets and
lengths are derived from the ordinary manifest's descriptors and selected policy.

The caller must first verify the manifest HMAC and expected release scope with
the ordinarily authorized key. The research reader checks the root marker and
stored manifest equality, verifies every fetched DAG/raw CID, validates UnixFS
sizes and reads only overlapping child ranges. The caller must then apply the
unchanged object AES-GCM authentication/decryption. A CID-valid altered pack is
not accepted as plaintext: GCM still refuses it. This ciphertext transport never
supplies listening authority or a content key.

Reads stay serial in the prototype and are capped at 16 distinct blocks, depth
eight and 512 KiB per response before copying. Both range ends can occupy partial
chunks, so its experimental fetched-byte ceiling is `maxObject + 2*chunkSize +
320 KiB` for complete chunks, bounded manifest and DAG metadata. It holds owned
bytes only within one read. This is **not** a change to the deployed API/Host
`maxObject + 64 KiB` contract, a whole-process heap bound or a cross-object cache.
The injected source must supply bounded/cooperative reads. Pre/post-read abort
checks do not implement the native SDK's uncancellable-call drain accounting or
a whole-query deadline; those require the existing bounded transport composition
and integration tests. A cold reader may fetch much more than one small segment;
warmed sequential playback, cache pressure and interruption still need measurement.

## Compatibility and persistence gates

| Area                        | Offline result                                                                    | Required before activation                                                                                               |
| --------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Existing standard API paths | Both standard chunk sizes reconstruct exact bytes in tests                        | Host/SDK/HTTP checks for any new larger-block writer, plus bound layout selection                                        |
| Packed old API paths        | Init and optionally first segment work; later paths are missing                   | An explicit versioned storage-layout/reference contract; refuse unsupported mode before partial playback                 |
| Ordinary Web / HTTPS media  | Current routes assume one file per virtual path                                   | Bounded range-aware API route and typed client dispatch; no generic gateway-range trust or provider fallback             |
| Native Host                 | Current resolver has the same per-path traversal and byte limit (code inspection) | Range-aware native block decoder, lifecycle/cancellation/cache tests and physical Host acceptance                        |
| Manifest/key/access         | Synthetic HMAC, exact ciphertext and AES-GCM round trips pass                     | Preserve canonical release/key checks; format selection must not bypass rights or integrity                              |
| Archive/renditions          | Retained in every model                                                           | Complete-graph retention/proof/root readiness must still include all archived and packed data                            |
| Resume/admission            | Current strict graph/journal rules are unchanged                                  | Persist an exact layout choice for a new unclaimed identity before the first intent; restart must rebuild the same graph |

Do not put a packed root under an existing unqualified reference and rely on an
old-reader fallback. Partial startup can appear to work and then fail on the
second segment. The research marker is not a deployed reference design. A later
implementation must decide the explicit reference/layout contract across the
writer, Web/API and Host before changing a default.

Chunking or packing changes graph CIDs even when encrypted objects are unchanged.
A global builder switch would conflict with existing inventories and ready-job
reuse. New layout selection needs an explicit durable per-identity admission/
journal binding, compatibility checks and old-layout dispatch. Never retrofit an
old claim, rotate a key to evade it, discard counters, re-encrypt a saved attempt
or silently reconstruct an old root with new rules. Rollback keeps compatible
readers and every current journal/receipt/nonce, or disables new publication.

## What this decision does not authorize

The prototype is under `services/api/scripts/research`, outside `src` and absent
from the production Docker image. Only its offline tests and a checkout research
command are added to the package scripts. No application reader/writer, protocol,
SDK, route, flag, profile, key, admission or deployed service changes. No artist
input or production state is read, and no network operation/signature occurs.

Next: review this candidate, specify the durable layout/reference contract,
implement and test API/Host range delivery and source-bound writer recovery,
then verify real encoded media, seeking, adaptive quality, Room and background
behavior without first-sound regression. Physical-device and any funded trial
need their own concrete plan and operational budget. No ETA or percentage gain
is inferred from synthetic waves. #407 remains open.
