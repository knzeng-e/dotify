# Custody lease loss must be a failed process exit

Refs #407. Candidate only, 2026-11-09. Web/Product remain 0.1.82.

## Observed failure

A read-only Fly inspection after #415 merged found the private custody machine
stopped while both public API machines remained started on the delivered image.
At **2026-11-09 02:58:14 UTC**, custody logged `CUSTODY_LEASE_LOST`; one second
later the runtime reported exit code **0**, `requested_stop=false`,
`oom_killed=false`, and did not restart. Its existing restart policy is
`on-failure`, with at most ten retries. No operator restart/update was performed.

Losing the PostgreSQL advisory-lock connection must stop admission and encoding:
the process no longer knows it owns the single writer. That refusal is correct.
Reporting the resulting teardown as success leaves new publication unavailable
until an operator intervenes. This inspection identifies the supervisor mismatch;
it does not establish why the database connection was lost.

## Minimal correction

`buildApp` emits a synchronous lease-loss lifecycle notification before its
existing stop/close path. Only the executable entrypoint marks `process.exitCode=1`.
Embedded apps/tests keep ownership of their own process. A concurrent operator
signal preserves an already marked failure; a normal SIGTERM still exits zero.
There is no in-process lock reacquisition or continued service after lease loss.

The existing Fly failure policy may then start a replacement. That process must
pass the same storage/identity checks and obtain the exclusive lock before
serving. Retained jobs, ciphertext, nonce receipts and ambiguous-outcome checks
are unchanged. This is not an unlimited availability guarantee: sustained database
failure can exhaust the existing restart allowance and needs operator attention.
Changing restart policy to `always` was avoided because process success/failure
should correctly describe this fatal event.

## Regression and validation

The existing real-entrypoint PostgreSQL test now covers two exits. It starts
an isolated custody process, waits for health, then either sends SIGTERM or
terminates only that fixture namespace's advisory-lock backend. It requires exit
zero versus one, no process signal, and an unavailable HTTP listener afterward.
The database guard accepts only loopback `dotify_w36_test*`; no production
connection, signer, key or artist upload is used. The original three-second
shutdown guard stays unchanged.

Before the correction, SIGTERM passed and lease loss reproduced **0 instead of 1**.
After correction, all **15/15** real PostgreSQL recovery/process tests pass,
including the unchanged SIGTERM path and the new forced lease-loss path. API
unit/route tests pass **369/369**; typecheck/build, formatting, whitespace and
offline backlog checks pass. Local PostgreSQL 16 dump/restore tools were run in
an isolated container because the host has version 14. Remote CI is a separate
PR gate. Code review and a separately authorized idle-state deployment remain
necessary for live recovery.

## Operator gate

Do not restart an unknown active publisher, delete a lock file or reset a nonce
to make this deploy. Preserve the stopped machine's volume/configuration first,
inspect retained ownership/pending receipts before enabling it, and reconcile any
uncertain account outcome. No new storage admission or musical write budget is
created here. The #415 image was built locally but was neither pushed nor deployed;
include this fix in the next reviewed server candidate instead.

Rollback preserves all journals/keys and the existing exclusive-writer checks.
The prior image also restores the code-zero availability defect; it is not a
repair for it. No Web/Product rebuild, DotNS signature, secret transfer, schema
conversion, database failover or live payment is part of this change.

## CI fixture follow-up

[Run 42641550836](https://github.com/knzeng-e/dotify/actions/runs/42641550836)
passed the server, storage, recovery, Web/Product build and three-engine audio
gates. Chromium core flows passed 330 scenarios and timed out in the catalogue
suggestion scenario. The trace shows a successful Queue click immediately after
join submission, followed by a hidden queue sheet and an unfinished fill of
**Request a track**. Context disposal during timeout then obscured that wait.

The scenario now waits for the shared-listening region to contain the exact
joined Room code, scopes Queue to that region, and verifies the Room queue
dialog before filling its search. This avoids acting on the preceding player
while join acknowledgement replaces the view. The suggestion, lineup, current
track and no-access-warning assertions are preserved; no timeouts, retries or
production code are changed by this CI follow-up.

Validation of the CI follow-up: affected scenario repeated five times with two
workers **5/5 pass**; complete Room workspace file with matching candidate
dependencies **28/28 pass**. Formatting, whitespace and offline backlog checks
pass. The new remote CI rerun remains the final merge gate.
