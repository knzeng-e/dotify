# Web/Product 0.1.83 candidate — 2026-11-13

The owner merged #456, #457 and #458. A frozen **Web/Product-only candidate** now
prepares the Room listening and artwork changes for physical acceptance. It is
not deployed. Server delivery, compact-source activation and the deferred real
second-computer rehearsal remain separate. Refs #395, #388 and #407.

## Source and checks

`release/product-0.1.83` at `929abe9306d0cc83fee4a74eb2f94b5416bdb8a5` starts from
merged dev `0bb52754b14bc366690ac85d1d7ad1dc089d8d28`; only Product's appVersion
changes to `[0,1,83]`. The dev tree is
`2d3723ab860e6c6b7432a50206034ed694c8530f`, identical to the previously tested
local assembly of dev/#456 with the pinned #457/#458 candidates.

- That combined tree passed 1,174 frontend unit tests, Web/Product builds, lint
  (two existing hook warnings) and 124 browser checks. One deliberate
  Chromium-only skip covers a case executed in WebKit. Browser signal and metadata
  assignment are not evidence of physical sound or lock-screen rendering.
- [Merged-dev CI](https://github.com/knzeng-e/dotify/actions/runs/43426485188) is green.
- The exact versioned candidate builds locally with verified Node 22.23.5;
  [candidate CI](https://github.com/knzeng-e/dotify/actions/runs/43430333634) is green.
- Offline artifact verification authenticates 100 CAR blocks, compares 72 files
  byte for byte and verifies all 20 outer application objects.

Application root: `bafybeietcvulu5opii4pg2ssxe7z2l422sns2nr3aheh7tijnm7k77jqiy`. CAR SHA-256:
`64b121923712f8b9359e2925212118888dabee15a8ad513ff11178d98c5b4e26`. The prepared ceiling is **20 application operations /
9,508,017 bytes**, plus at most two DotNS requests. The owner subsequently approved this exact ceiling and temporary custody maintenance. No signer or on-chain write has been used.

## Compatible delivery boundary

The client keeps the standard reference, session/key request and signaling wire
contracts. Same-track Room preparation owns a detached authenticated source and
hands off at the live position, preserving a Pause. Metadata rejection is
isolated from player/account cleanup; bounded public-image/prepared-PNG reuse
and explicit local observations prepare diagnosis of late system covers.
See [Room ownership](../../../adr/0059-preserve-solo-during-room-preparation.md),
[artwork observations](../../../reference/system-artwork-observations.md) and
[cache boundaries](../../../reference/public-artwork-cache.md).

The frontend also contains the reviewed compact reader, but a reader's presence
activates no compact publication. This delivery does not replace an API,
custody, encoder or signaling image or change an admission/key. The #456 proof
optimization remains a server candidate; no live publication speedup is claimed.
Preserve the [compact activation gates](../../../reference/bulletin-compact-delivery.md#deployment-and-remaining-gates).

## Public preflight and remaining operations

At finalized Bulletin block 1629640, eight exact dependencies are retained;
twelve would need storage. The public account has **no active authorization**.
The previous recorded expiry is already past. Reactivation and sufficient
remaining capacity must be verified before signing. Quota is not a spending
budget. Product's public Host configuration and the existing DotNS 0.1.82/lab
0.3.1 records match their expected identities at this read.

The concrete private package preserves prior conservative obligations and proposes
one operation per exact dependency. To exclude competing writes by the shared
account, the planned operation retains the existing stopped-custody signing
guard. The owner approved that temporary maintenance and the new application/DotNS budget. First inspect only filtered pending-work state; active or uncertain work refuses intervention. No real recovery capture or key transfer is resumed.

After coordinated delivery/readback and normal custody health verification,
collect repeated actual solo/Room phone locks, audible Web/Desktop guests,
Pause/handoff and Room-to-solo behavior. Use the
[Room measurement guide](../../../how-to/measure-room-startup.md) and
[artwork guide](../../../how-to/check-system-artwork.md). Keep #395/#388 open;
#407's hosted capacity, publication latency and operational gates also remain.

## Authorized delivery and isolated custody diagnostic

The owner approved the exact application ceiling and reactivated storage. A
fresh finalized read at block 1629771 finds 5,000 transactions and 900,000,000
bytes available, expiring at 1831359. These higher quotas do not expand the
20-operation application allowance.

The subsequent Fly control found custody **already stopped**, with two recent
exit-code-1 events, neither requested nor OOM-killed. The image remains the last
recorded #426 image. The first SSH inspection could not run while the machine was stopped. Recent diagnostic queries yielded no usable
entries, so the startup cause remains unknown. No application write was signed.

The owner then separately approved an isolated diagnostic. The same image booted
with only a waiting process; its normal publisher did not run. Compiled metadata
checks accepted 14 inventories and five ready preparations, with no active job
or pending submission. The original configuration was restored to its exact
observed hash and the machine left stopped. No audio or key was read/exported;
only filtered counts, states and fingerprints were retained. This confirms
settled publication state, not the cause of the earlier startup exits. Normal
restart and health checks remain after publication. Web/Product remain at their
last recorded 0.1.82 delivery.
