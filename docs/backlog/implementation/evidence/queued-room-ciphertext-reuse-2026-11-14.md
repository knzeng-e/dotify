# Reuse ciphertext completed during relay waiting — 14 November 2026

**Implemented and locally tested; not delivered.** Refs #395. Code commit
`daea6ae2f858ed327ea9b42068592bb15815adfb`, based on merged dev `0e17f56fba3715a106159b6781d28116ed6e0c00`.
The [0.1.85 delivery result](product-0.1.85-rollout-2026-11-14.md) still leaves
initial Room startup open. Its later 2.14-second report belongs to another
session; this candidate does not establish the cause of the reported 99% timeout.

## Reproduced waste and correction

Two solo reads occupy the two client relay slots. A Room read for the first
object misses the cache and waits. Solo finishes that object and caches its
ciphertext before releasing the slot. Previously the queued Room request then
started a third HTTP body: the cache was checked only before waiting.

The regression fails on the parent with **three HTTP requests for two distinct
objects**. The candidate rechecks the existing cache immediately after relay
admission and cancellation checking. The same scenario uses **two requests**;
the Room receives the completed ciphertext and both relay slots remain usable
by following reads. A second regression proves a queued request requiring a
different authenticated size still fetches, rather than accepting incompatible
cached bytes. This is a deterministic request-count comparison, not a phone
latency benchmark.

Reusable semantics live in [Continuous listening](../../../explanation/continuous-listening.md#adaptive-delivery).
The cache identity, five-minute lifetime, 4-MiB / 128-object bound, two-body relay
capacity, priorities, fallback order and media deadlines stay unchanged.
Per-purpose authorization and object authentication still apply. Cache reuse is
reported as a cache hit, so it cannot inflate measured network throughput. No
key or clear audio enters this cache. Existing simultaneous in-flight duplicate
requests are not coalesced by this change.

## Validation

On the code tree identified above:

- 1,214 unit tests pass, including the failing-before/fixed-after queued-read
  case, subsequent two-slot capacity and incompatible-length regression.
- Four focused transport/cache/Bulletin files pass 24 tests.
- Fourteen Chromium/WebKit real synthetic AAC/crypto journeys pass: bounded
  complete preparation, solo continuity, explicit/native Pause, transport-failure
  recovery and authoritative denial even when prepared media is cached.
- TypeScript and Web/Product builds pass; changed TypeScript lint and formatting
  pass. Local dependencies are reused from the identical locked installation.

No API, custody, signing, musical upload, live setting or Host/SDK changes occur.
Current delivery remains Web/Product 0.1.85 with the previously delivered servers.
Review/merge, a separately scoped delivery and matching physical first-attempt
acceptance remain. Keep #395 open and preserve the owner's recovery deferral;
this candidate grants no operational write authority.
