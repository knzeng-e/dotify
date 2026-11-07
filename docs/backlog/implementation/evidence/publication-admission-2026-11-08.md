# Publication admission and execution plan — 2026-11-08

## Candidate and observed boundary

Base: tested dev `e7614b4d6993ab16b57eeb4c65f73c6c29919690`.
Scope: #407 first slice; ordered planning for #395/#388/#406/#408.
Implementation: `51115455b2187d375a227fc1f57123cf8ef59954` (local checks);
subsequent reconciliation changes documentation only.
Branch: `feat/listening-readiness-plan`. This is implementation evidence, not a
new deployment or general-publication activation.

The owner reports new release failure on Product Desktop and Web; the screenshot
stops at audio storage, before registry approval. Read-only custody logs show a
recent job failing at storage. A reduced read-only profile/inventory inspection
reports Bulletin audio/public assets, a scoped pilot and that job absent from the
admitted inventory. No key/seed was read, no job retried and no service changed.
Logs do not expose the detailed exception, so other failures remain possible.

## Design and review map

1. `streamingPublicationStore.ts` centralizes the existing one-job/exact-scope
   rule and exposes a read-only preflight. A new job is checked before nonce
   reservation/encoding; retry is checked before changing the saved job. The
   publisher still checks the authenticated manifest and current inventory before
   opening a write session. Passing preflight does not reserve a slot; concurrent
   candidates may still be refused later. Pinata and unscoped profiles retain
   their behavior. General multi-release admission is deliberately not enabled.
2. `streamingJobs.ts` maps typed admission refusal to a stable API code. If a race
   is refused only at storage, `PUBLICATION_NOT_ADMITTED` survives restart in the
   existing snapshot; unknown errors remain controlled failures rather than
   being guessed from exception text. No old snapshot is rewritten on deployment.
3. Upload/retry routes explain operator action; `streamingPreparation.ts` avoids
   automatic retry and the destructive restart/discard offer on this refusal.
   Existing ready results, transient storage failure and legitimate admitted
   same-job retries preserve their previous behavior and ciphertext.

The meaningful alternative was removing the pilot check or resetting the queue.
That would exceed its one-release authority and discard budget/receipt history.
A durable multi-release policy with aggregate limits is the next #407 slice.

## Validation

- 41 API tests pass across publication store, durable jobs and upload routes:
  wrong identity/new jobs never open a write session; refused new work reserves
  no nonce and encodes nothing; a late refusal survives restart and retry leaves
  saved state intact; legitimate same-job retry reuses ciphertext. HTTP new-upload
  and retry errors agree and contain no key material.
- 10 application composition tests and API typecheck pass.
- Seven focused frontend preparation tests pass, including old-job retry refusal,
  persisted refusal, no auto retry/discard, and existing normal recovery paths.
- Web build and lint pass (two existing App.tsx dependency warnings). Vite
  retains its existing large-chunk warning.
- Backlog offline validation passes. Live validation exposed closed #290/W35 and
  #292/W37 still marked active locally; reconcile them as delivered records,
  preserving current device and contract-bound gates in their open follow-ups.
  #406/#407/#408 are assigned and in Project 5
  with matching fields. #395/#388 preserve their histories and new owner feedback.

The initial isolated frontend dependency extraction exhausted temporary free space;
its generated partial tree was removed. Local frontend checks use the existing
clean 0.1.80 dependency tree (same lockfile) through a temporary untracked symlink,
which is excluded from the commit. CI installs its own dependencies.

## Remaining gates

No physical new-release test or deployed correction is claimed. General admission,
cover/metadata multi-release policy, retention/recovery, measured activation
budget and actual Web/Desktop artist approval/catalogue/playback remain #407.
Audio timings and system artwork work have been planned, not implemented here.
CASH remains non-executable; no SDK change, money transfer, storage upload,
maintenance or signer activation follows from this candidate.

The new persisted reason requires a compatible server reader for rollback;
preserve snapshots rather than editing/deleting them to boot an old strict schema.
See the publication runbook and deployment-configuration candidate section.
