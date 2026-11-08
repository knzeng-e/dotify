# Artist-publication progress and deadline repair, 2026-11-08

Refs #407. Candidate based on tested `dev` `6fc81748`; not deployed.

## Incident and measured boundary

After the authorized Web/Product/API 0.1.81 rollout, the owner reports the
full-length artist release fails on Web and Desktop at **Save your music**.
The two supplied messages are upload-connection timeout and preparation still
in progress. Operator inspection was read-only: no retry, broadcast, restart,
policy edit, key access or inventory reset was performed.

The two approved artist scopes each admitted the same 4,683,301-byte source.
Each encrypted audio graph contains 175 blocks / 18,718,962 bytes; the two cover
graphs contain eight blocks / 20,653 bytes each and reuse existing receipts.
The first audio reached ready after approximately 55 minutes. The second was
still publishing and advancing from 104 to 140 attempted stores during the
inspection, with the normal two pending nonces. It was not a failed job. By
21:09 UTC, both audio jobs and both covers were ready, the writer was idle and
no account intent remained pending. The owner was invited to resume an existing
draft; there is no completed registry/catalogue/listening acceptance here.

A separate null-signer probe measured status 838 ms (including initial session
setup), lookup 213 ms, nonce 150 ms and a raw block read 63 ms. These isolated
reads are not a throughput benchmark or proof of the dominant latency source.
Per-block finality and repeated proof reads remain expensive; this patch does
not claim to make a full release fast. The whole-release profile retains two
slots, 712 attempted stores / 151,126,016 bytes and all earlier account duties.

## Failure mechanisms

- The client ran audio and cover requests together, while Bulletin serializes
  account publication. The cover's five-minute HTTP wait can be consumed behind
  audio encoding/storage. A lost response says nothing about durable completion.
- The foreground poller stopped after fifteen minutes even if the job was
  healthy. Both cases reached the generic **Publication needs attention** UI.
- Both server publication layers retained a five-minute synthetic-pilot cap.
  Under Node 22.13.1, a local forced-GC reproduction additionally showed that
  `AbortSignal.any([owner, AbortSignal.timeout(120)])` could remain un-aborted
  after 350 ms. The otherwise-unreachable timeout signal can disappear. This
  explains why merely reading a configured deadline is not evidence it fired;
  the exact GC history of the live process was not captured.

Linux CI then reproduced an admission-ledger race: `load()` can open a snapshot
just before an atomic claim replacement unlinks that inode; its strict `nlink=1`
check correctly refuses it. All public admission snapshots now share the existing
short claim tail, so no reader overlaps replacement. The file checks are retained,
and this short local ledger queue does not wait for network publication. A
concurrent claims/preflights/inventory regression supplements the existing
whole-release integration that exposed this failure.

## Candidate behavior and ownership

`createDeadline` owns its controller through an ordinary, unreferenced Node timer
until completion and clears it in `finally`. Media/RPC read races and both
publication layers retain this ownership. Parent cancellation retains its reason.
The opt-in whole-release publisher supplies a two-hour overall cap; legacy pilot
and Pinata keep five minutes. Individual read/store/finality limits, pipeline
concurrency, nonce barriers, byte/attempt budgets and reconciliation are unchanged.
This is an upper bound for recovery, not an acceptable startup target or SLA.

The writer reports only persisted receipt counts for the current graph. The
queue exposes these counts through its existing owner/chain-authenticated view.
They are transient diagnostics, never authority or new persisted custody state.
All receipts confirmed means **Checking your saved music**; only the existing
final retention/raw-byte/nonce verification can produce ready and a usable ref.

Backend publication awaits reusable audio before starting its cover connection;
local independent demo uploads retain parallel behavior. Foreground polling
continues while phases/receipt counts change. Fifteen minutes without change,
or two hours overall, returns a typed pending state with **Check preparation**.
A connection timeout likewise says confirmation is unknown. Neither path
retries/discards a job automatically or calls it published. The existing local
job ID and prepared-upload references remain available for explicit same-draft
resume; the artist still approves registration in their wallet. Pending payment
approvals cannot opt into this publication-only check action.

## Review and validation

Read `deadline.ts` and its forced-GC regression first; then `bulletinMedia.ts` →
`streamingPublicationStore.ts` → `streamingJobs.ts` for progress/deadline ownership;
then `streamingPreparation.ts`, `preparePublicationAssets.ts`, `useArtistConsole`
and `TransactionModal` for the artist journey. API schemas on disk are unchanged.

Tests cover a graph requiring more than five simulated minutes, unchanged
short-store expiry/pending-nonce preservation, owner-scoped counts without early
readiness, progress beyond fifteen minutes, idle/overall hand-back, invalid
counts, backend asset ordering and independent demo uploads, explicit pending
feedback, actual GC and timer disposal. The pre-race-repair API suite passed (362), as do all 1,118 frontend unit tests, API typecheck/build,
ordinary Web and frozen Product builds, formatting and offline backlog hygiene.
Lint retains the two existing App effect-dependency warnings; server-rendered
hook tests retain their existing useLayoutEffect warnings, and Vite reports the
existing large chunks. The admission fix adds one API regression; the final suite and CI are recorded in the PR. These are not physical-device publication acceptance.

## Delivery and remaining work

A matched API/custody and Web/Product rollout is required. Do not restart a live
writer to install this candidate. Wait for the account barrier and pending sends
to clear, inspect ready jobs and preserve all receipts/ciphertext/admission history.
Resume the two existing drafts with their respective artist accounts; do not
create a third release or grant fresh spend. This patch activates no network
writes, key installation, policy edit, automatic renewal or service maintenance.

#407 remains open for actual artist wallet registration, catalogue readback,
audible playback and acceptable measured publication latency. Reducing RPC/proof
round trips or tuning the pipeline requires its own measured review; do not drop
finality, authority, retention or nonce verification to obtain a faster result.
