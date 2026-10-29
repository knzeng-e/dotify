# Publication preparation recovery, 2026-10-29

PR #351. Refs #287 (W32) and #317. This is a publication reliability correction, not
completion of native streaming or pilot acceptance.

## Observed failure

The owner could not complete a new release on Web or Product Desktop in the
0.1.66 deployment. An error briefly appeared, then a non-dismissible
“Preparing streaming audio” modal replaced it. Reload exposed a failed saved
preparation; discarding and uploading again reproduced the failure.

Read-only custody inspection found two failed preparations of the same
6,149,652-byte master. Both had complete encrypted output. The 283.1-second
release contained 217 authenticated objects and 27,249,300 encrypted bytes.
Manifest authentication, every object authentication/length and the artist's
current runtime authority passed. No key or plaintext left custody during
those checks.

The owner explicitly authorized a diagnostic resend of the prepared encrypted
bundle to the configured Pinata account. Pinata returned HTTP 403. A second
response inspection emitted only status, JSON field names and fixed diagnostic
categories, including plan/usage/limit; no response body, credentials, clear
music or key was emitted. The precise account limit was not confirmed. The owner then removed obsolete
files in Pinata and requested another test. The same prepared bundle was
accepted successfully, confirming storage admission was restored. No release
was registered on-chain by these diagnostics. Only the explicitly authorized
storage test wrote data; no job, nonce reservation or account setting was changed.

## Correction and boundaries

- An attempt owns preparation progress until its assets finish or any sibling
  fails. Late audio progress cannot replace a terminal cover error, a newer
  attempt or another task's approval dialog. The active attempt is locked before React renders another frame.
- Publication feedback has its own identity and wording. It can be reduced and
  reopened while the app stays open. An error becomes visible even if progress
  was reduced; successful background completion stays reduced so it does not
  interrupt another task. Catalog reconciliation remains read-only.
- Failed preparations offer **Retry preparation** while attempts remain;
  exhausted jobs offer explicit discard. Neither discard nor repeated encoder
  attempts runs automatically. A pin retry still verifies and reuses the same
  ciphertext, without spending a new encryption generation.
- Audio, artwork and metadata uploads have five-minute transport deadlines;
  status requests and the overall polling wait retain their existing bounds.
  A local deadline does not delete or cancel an owned durable server job.
- Custody reports only an allowlisted failure stage and optional provider HTTP
  status. Provider bodies, tokens, keys, music and raw exception text are not
  logged. Failure detail is process-local and logged, not new custody state;
  the durable v1 job schema and permanent nonce ledger are unchanged. After
  restart a historical failed job can show the generic retry message until a
  new attempt supplies diagnostics.

The UI fix cannot lift a provider account quota or permission restriction.
Pinata admission was restored for the diagnostic resend; the studio still
needs a real publication check after deployment. Do not repeatedly
re-upload the source or switch to unprotected audio as a workaround. No new
infrastructure, subscription, runtime or contract deployment is introduced.

## Validation

- API suite: 235 tests pass outside the restricted socket sandbox. Recovery
  tests verify storage-403 diagnostics omit private response content, restart
  safely and publish exactly the persisted ciphertext without re-encoding.
- Frontend: 1,041 unit tests pass. The actual studio hook exercises a failed
  cover overlapping pending audio, late progress, an immediate double click
  and explicit retry reuse. Polling tests distinguish storage refusal and exhausted
  attempts. A stalled HTTP upload returns a recoverable deadline message.
- Browser: 23 tests pass. Publication feedback can reduce/reopen and reveal an error; the
  artist publication suite covers catalog delay, account disconnect, failed
  uploads/approval and return to the release list.
- API build/typecheck, Web and frozen Product builds, and lint pass. Two existing App effect-dependency
  warnings and third-party/bundle-size warnings remain.

Deployment and an actual successful Web/Product Desktop publication remain
unverified. The successful storage resend alone is not publication acceptance. Keep #287/#317 open.
