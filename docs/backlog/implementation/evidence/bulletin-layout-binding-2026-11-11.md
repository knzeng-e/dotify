# Compact graph and durable job binding — 2026-11-11

Refs #407. Implements the constructor/journal slice of
[ADR 0051](../../../adr/0051-bulletin-compact-layout-study.md), with boundaries in
[ADR 0052](../../../adr/0052-bulletin-layout-inventory-binding.md).
Started from merged dev `3e3757c2` (#429); its tree matches the green reviewed
research source. The current service remains #426 (`8d070654`), with Web/Product/
public APIs on 0.1.82. No production inspection, upload, store, renewal, signature,
key change, admission or maintenance is performed here.

## Implemented boundary

The new typed constructor fixes 256-KiB UnixFS packing with a distinct marker:
`dotify.bulletin.rendition-pack.v1`, startup `init-and-first`. Original ciphertext,
manifest authentication, archive and every rendition remain; only later media
objects of each quality share a physical file. Offsets derive from the parsed
manifest, not an external table. Input validation is shared with the legacy
builder without changing that builder's graph bytes or return shape.

Only the low-level writer's existing internal builder seam can exercise the
compact constructor. Its `media-job.v3` journal requires the exact layout before
any pending intent or broadcast. Legacy and newly created standard inventories
keep their existing strict v2 shape. Retrying with a different layout refuses,
even when root/blocks/scope/generation/budget/pipeline are otherwise identical.
No profile, queue, route or admission extension selects compact. Current
publication startup, release validation and prepared recovery refuse compact
inventories before generating an unqualified reference.

## Validation

- **436 API tests / 42 suites pass, no skips**, including seven new cases.
- The complete synthetic logical set reconstructs byte-for-byte from the fixed
  files/ranges, with ordinary HMAC/scope verification and object GCM decryption.
  Archive and init/first objects remain present, all physical CIDs verify, input
  ordering is deterministic and physical buffers do not alias logical input.
- The medium synthetic geometry retains 108 → 60 blocks and nine → six modeled
  dependency waves. These are not elapsed times, a live speedup or AAC evidence.
- Strict marker/inventory versions reject unknown, absent or retrofitted layout
  fields. Missing/extra/duplicate/truncated logical objects and pre-abort refuse.
- The simulated writer persists layout/root/generation and the reserved nonce
  before its first store. After a committed store with a lost acknowledgement,
  a fresh writer reconciles the same graph and finishes without duplicate stores
  or nonce reuse. Both pending and ready jobs reject a layout change without
  rewriting their journal or performing further stores.
- Conservative accounting is retained: a trailing attempt reserved but cancelled
  before broadcast stays charged. The recovery test checks saved charges plus
  genuinely missing stores, not an incorrect assumption that attempts equal
  successful blocks.
- Current publisher startup rejects a compact inventory before loading any
  signer or opening a transport, and releases its lease. Existing admission
  tests retain their original assertions; their partial fixture inventories
  now explicitly identify the legacy schema.
- API typecheck/build, changed-file formatting, offline backlog sync, relative
  documentation targets, JSON and whitespace checks pass. No dependencies change.

Reproduce from `services/api` with the checked-in dependencies:

```sh
npm run typecheck
npm run build
npm test
node --import tsx --test scripts/research/bulletinCompactGraph.test.mjs
```

## Remaining acceptance

This code is compiled for a future API image but does not activate compact
publishing. External versioned references, reviewed immutable per-identity
admission before queue work, bounded API/native Host range resolution and their
cache/cancellation/SDK lifetime composition remain the next slice. No current
path-based reader is claimed to support compact media.

Then verify real encoded-media startup, seeking, adaptive quality, memory/copy
pressure at the size bound, Room/background continuity, legacy playback and
source-bound restart/recovery. Both the public-asset tail and cold range read
amplification remain open. No artist input, private operational state or physical
device is used by this evidence. #407 stays Now/In Progress; no new funded trial
or maintenance is implied.


## Review and browser CI follow-up

Independent read-only review of the complete #430 merge diff found no confirmed
introduced defect. Native delivery and maximum-size memory gates remain open.
The initial core-flow CI passed 330 tests and failed the normalized-Room receiver
energy assertion. Its trace shows a progressing 60-second source, ruling out
fixture exhaustion; the test attached its analyser at UI `In sync`, which occurs
at `ontrack` before received frames are necessarily available.

The test now uses the live/unmuted receiver-track precondition already exercised
by `room-sync`, then verifies the meter context is running. The autoplay late-join
scenario, real WebRTC energy thresholds, suspension silence and explicit Play
recovery assertions are retained. No retry, timeout increase or application
fallback is added. Both normalized-Room and Room-sync specs pass five times each
(**15 browser cases**) locally. This targeted evidence does not replace the full
new-head CI run.
