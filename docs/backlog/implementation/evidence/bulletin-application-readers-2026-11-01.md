# Bulletin: completed private canary and application readers

The private generated-audio package is fully stored and independently verified.
The application player now has a native Host reader and a Web/API reader for the
same encrypted Bulletin objects. This is implementation evidence, not a claim
that the deployed artist catalogue or production publisher has switched.

Refs #288 / W33 and #287 / W32. Design: [ADR 0042](../../../adr/0042-bulletin-application-readers.md).

## Provenance and completed authorized run

- Integration base: tested `dev` `fdf27aec3dead9e76ad909f4fa7008d0bf8af2e2`;
  [CI 41264125115](https://github.com/knzeng-e/dotify/actions/runs/41264125115) passed.
- The owner reviewed/merged #370 and reactivated the signer for the remaining
  original allowance. Execution used clean reviewed repair
  `3e301b19a94f8e2d2ae0843d9785b36233058210`, whose tree equals the dev merge.
- The original artifact, digest, root, private custody and permanent nonce
  ledger were unchanged. Its model runtime is **not** an on-chain artist runtime.
- Cumulative result: **16 stores / 713,229 bytes**, of which this continuation
  submitted **14 stores / 632,241 bytes**. Ready, 16 receipts, zero pending;
  the account's active-job barrier is released and next nonce is 1046.
- The [publication observation](bulletin-protected-publication-2026-11-01.json)
  records artifact/execution revisions, exact allowance counters and the run.
  Its 360,717 ms is the whole operator observation (about six minutes), not
  measured audio startup or representative music-publication throughput.
  Peak RSS reported there is 171,664 KiB. Different phases have their own caps;
  do not describe this total as a sub-five-minute operation.

The subsequent [independent read-only audit](bulletin-protected-readback-2026-11-01.json)
verified all 16 canonical sender/nonces, **1030–1045**, storage indices and expiry
records. The two earlier stores are at block 1,451,299; the continuation spans
1,452,336–1,452,387. It fetched 457,107 bytes of selected graph dependencies,
authenticated the manifest and nine media objects, and decoded all AAC frames
at 96/160/320 kbps (8.021333 seconds each). It fetched no archive master, used
no signer and submitted no transaction. Read/decode/receipt audit took 15,074 ms.

The new production HTTPS adapter also passed a [live read-only check](bulletin-application-http-readback-2026-11-01.json):
manifest, 160-kbps init and first segment match the approved ciphertext exactly.
That adapter check uses no key and does not exercise the public catalog route;
route/access admission is covered separately by the offline application tests.

The signer variable was independently confirmed absent after publication.
No renewal, DotNS change, artist audio, key distribution or runtime registration
occurred. Keep the 16 new renewal slots in addition to the prior 91-slot reserve;
these local floors do not guarantee on-chain retention. The private same-disk
snapshot remains inspection-only, not disaster recovery. The
[partial-run evidence](bulletin-protected-partial-run-2026-11-01.md) remains the
historical record of the first failure and repair.

## Application data flow and checks

1. `streamingPlayback.ts` recognizes a registered BLAKE2b directory root. In
   Product it lazily loads `bulletinHostMedia.ts`; ordinary Web and Host recovery
   use the existing media API. No Pinata/edge attempt is made for Bulletin roots.
2. `mediaDelivery.ts` composes that API with bounded HTTPS raw-block reads.
   `createMediaRoutes` keeps active-catalog/path admission ahead of all reads.
   The endpoint setting is optional and server-only; no new service or signer.
3. Existing key authority, manifest authentication, AEAD segment decryption,
   managed append bookkeeping, normalization and room capture remain in place.

The offline protected rehearsal now uses **both production readers** with real
encoder/custody, Web and Product signatures, canonical access resolution and
private key delivery. A simulated runtime and Bulletin node replace only the
external chain/storage. Both readers return byte-identical ciphertext; all three
renditions decode. Denied/forged/replayed/stale/revoked requests derive no key.
Lost-acknowledgement retry still reuses ciphertext and permanent nonce entries.

Transport tests cover native raw-block verification/cache, cancelled SDK calls
remaining bounded, wrong genesis, malformed/oversized responses, API
cancellation, prohibited paths, active-catalog checks and explicit unavailable
configuration. Browser checks exercise actual authenticated AAC through the
application player for the Web/API route and native-reader adapter. The targeted
Chromium/WebKit run passes eight checks. Local Firefox fails before page
execution: its process cannot initialize the macOS headless compositor/sandbox
extension. The unchanged three-engine Linux CI gate must validate Firefox.
Node/Host responses in these checks are synthetic, not physical-device evidence.

Local validation passes: 1,051 Web unit tests, 280 API tests and API TypeScript,
eight protected-rehearsal checks, Web and frozen Product builds, and all 20
streaming-browser checks in Chromium/WebKit. Lint has zero errors and the two
existing `App.tsx` hook warnings; builds retain existing large-chunk,
Browserslist-age and pure-annotation warnings. Changed source formatting,
documentation links, backlog synchronization and diff whitespace checks pass.

Validation results and final implementation revision are recorded on the PR.

## Remaining activation gates

Prepare a fresh registered runtime scope and its private key custody before a
real protected fixture; the completed model-scope canary cannot simply be
registered under another runtime. Review the production publisher composition,
exact writes/retention budget, persistent storage and recovery. Then deploy the
same candidate for ordinary Web, Desktop Host and mobile Host, checking allowed
playback, denied access, interruption, room-host/guest behavior and physical
audible continuity. Longer artist releases, cold startup, uncached recovery,
recurring retention and real operating costs remain unaccepted.

The current deployed Pinata app remains untouched during preparation. The owner
chose a fresh internal Bulletin catalogue rollout, not permanent support for
retired runtimes or old provider references.
