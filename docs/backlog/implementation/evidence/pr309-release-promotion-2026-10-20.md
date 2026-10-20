# PR #309 release promotion review, 2026-10-20

## Candidate and history

- Starting `dev`: `e0d8c2cfe813c7722d48009f195811561a99ce4e`.
- Starting `main`: `17c5691e36c7304da06f2be584d7b7be34cdb90e`.
- `main` is the squash of release PR #212. Its tree is byte-identical to
  `69e8ef8de49e5fdf764e8281fdd156b4be3d3c2d`, which is already an ancestor of
  current `dev`: `git diff --quiet origin/main 69e8ef8` and
  `git merge-base --is-ancestor 69e8ef8 e0d8c2c` both succeeded.
- The apparent 196 file conflicts therefore came from divergent commit
  ancestry after that squash, not unique `main` changes. Merge commit
  `4c0c65d` records both histories while preserving the complete `dev` tree.
  `git diff --quiet 4c0c65d^1 4c0c65d` verifies this boundary.

No branch was rebased, reset or force-pushed. This is preparation for the
owner's promotion decision, not a merge of PR #309 or a deployment.

## Review finding and correction

The [P1 logout finding](https://github.com/knzeng-e/dotify/pull/309#discussion_r4320989104)
was valid: a failed HTTP logout discarded the only retry credential while a
stable API session epoch could keep the token valid across restarts.

The client now queues an inactive, API-scoped token and expiry before removing
its active cache entry. HTTP failures preserve the queue across reload when
storage is available; blocked storage retains a page-memory retry and explicitly
asks the user to keep Dotify open. The queue is not an authentication cache.
It also blocks stale active slots whose removal failed, including after reload.
Late sign-in results after disconnect enter the same queue.

App startup, online/foreground return, a foreground minute timer and an explicit
retry action flush the same coalesced queue. At most four requests run together,
each with the existing 15-second HTTP budget. Success requires a successful
server response; expiry cleanup uses the server-provided expiry plus a five-minute
local clock margin. Neither route nor signing/access policy changed. No token
is included in diagnostics or user-visible errors.

## Verification

- All Web unit tests: 126 files, 1,007 tests passed. The 33 focused session/cache
  tests cover 503/network failures, reload, failed active-cache removal,
  memory-only storage, account switching, concurrent retries, late sign-ins,
  API isolation and expiry cleanup.
- Web and frozen Product DevNet builds passed, as did formatting. ESLint passed
  with the two pre-existing `App.tsx` hook dependency warnings.
- Chromium and WebKit run the real React/SDK fixture: a persisted pending logout survives
  reload, shows the notice, and its retry button clears the queue only after a
  successful simulated API acknowledgement. This test is added to CI.
- Offline backlog manifest and whitespace checks passed.

The final pushed SHA and its quality-gate run are recorded in PR #309. No live
API storage failure, stolen-token scenario, Product physical-device sign-out,
new publication or deployment was performed. Existing dependency advisories
and bundle-size warnings remain separate maintenance work. Product 0.1.56
remains the previously signed test artifact and does not contain this new fix.
