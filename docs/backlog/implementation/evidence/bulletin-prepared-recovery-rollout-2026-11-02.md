# W33 — completed prepared-pilot recovery, 2026-11-02

## Outcome and identity

The original synthetic audio job is **ready**. Its 16 Bulletin stores total
**712,737 bytes**, within the existing allowance, with independently verified
canonical sender/nonces **1069–1084**, matching raw blocks and authenticated
manifest/audio objects. The preparation count remains **three**. No re-encoding,
new job, budget reset, renewal or artist registration occurred.

- Reviewed implementation: #379, merged source `b7f539f8d94a02cdfae48090fe76891fff9b076d`.
- Exact-source [dev CI](https://github.com/knzeng-e/dotify/actions/runs/41527211697): green before maintenance.
- Private custody image: `registry.fly.io/dotify-api@sha256:b65048ffaf3b67bf2eda578f7a638e9faf1e8c12926370446f8cd0ca8d380219`.
- Machine: `e82d13d0c61238`; existing encrypted volume `vol_40o3jqwp33p5z6m4`.
- Original job: `c346a96f-d7f9-421b-b4f3-32923753e3b4`.
- Root: `bafykbzacedt5ltqhhtsffynpcfusxpxd6dlifcfsoyl6cld53lacraduyo2lw`.
- Plan SHA-256: `862a1438e0f8b33a08723156eca4b95175dc218786b7d9d3bae2dcb7ee550b22`.
- Branch `ops/bulletin-prepared-recovery-20261102` records this operation; its later documentation commit is not the deployed image source.
- [Machine-readable evidence](bulletin-prepared-recovery-rollout-2026-11-02.json).

The owner explicitly approved the separate maintenance and at most 16 stores /
712,737 bytes. The previous public-asset activation approval was not reused as
authority for this interruption. The prepared local package is
`/private/tmp/dotify-recovery-package-b7f539f8/REVIEW.md`.

## Operation and verification

| Step | UTC / observed result |
| --- | --- |
| Volume snapshot | `vs_Xvy48DyvJL46f6lVJL9w8`, created 21:37:43 |
| Start maintenance | 21:42:34; only custody updated, normal API gracefully stopped |
| Coherent copy | 21:42:57; 186 queue files and four publisher files; separate profile/policy copies, no signer or content-key secret copied |
| Inspection | Same original scope/root, three attempts, zero attempted stores/bytes/receipts/pending; all saved objects and reservations authenticated |
| Execute once | 21:43:02–21:48:52; original graph and allowance, no automatic retry |
| Independent readback | 21:49:04; all 16 finalized sender/nonce receipts and raw blocks verified, ten encrypted objects plus manifest authenticated, zero pending, cleared active account barrier |
| Restore normal server | 21:49:04–21:49:21; private readiness HTTP 200 / ready / ok |
| Public readiness | HTTP 200 / ready / ok after restoration |

Execution time includes preflight, signing, finality and repeated verification;
this single generated fixture is not a representative throughput or audible-start
benchmark. API edges keep the prior `84baeb49` image/source; custody uses `b7f539f8`.
Product/Web remain 0.1.69. The encoder, service count, origins, profiles, key
installation, mounts and session settings were unchanged. A full config comparison
permits only custody image/source identity changes; public edge configs match.
The build reports five high-severity npm audit findings in the unchanged dependency
set; this maintenance performs no dependency upgrade.

The server now exposes the ordinary ready audio reference. The artist must
refresh/resume the existing draft and approve registration through the usual
wallet flow. A ready preparation is not a registered or playable catalog release.
No protected Web/physical Host acceptance is claimed by this operation.

## State, quota and retention

- Storage attempts/bytes: **16 / 712,737**, with the unchanged 16-store / 1 MiB cap.
- After operation: **286 transactions**, **79,086,012 store bytes**, and
  **106,084,254 renewal bytes** available; finalized account nonce **1085**.
- Before writing, a conservative read-only preflight checked at least 217
  transactions, 1,638,400 store bytes and 45,654,059 renewal bytes, carrying known
  research/Product and unused public-asset obligations. This manual floor is
  not an automatic conservation inventory or renewal scheduler.
- Earliest recovered-audio expiry: block **1,679,653**, observed at head
  **1,478,104**. Do not convert block deadlines into time without a measured period.
- No renewal, DotNS signature, public-asset store or runtime registration was
  submitted by this recovery. Existing cover/metadata caps remain for the same pilot.

After normal startup, ready-job source/output cleanup completed. The coherent
on-volume copy preserves the encrypted output, and the additive `ready` audit
retains the original failed job. The unrelated job, permanent nonce reservations
and both profile files match the stopped-state backup. The copy is not disk-loss
recovery; Fly's volume snapshot and separate secret recovery have their own
operational boundaries. No stale snapshot was restored over broadcasts.

## Handoff and remaining gates

Do not rerun recovery for this ready job. Use normal authenticated job status
and the artist wallet to finish the existing draft. Keep the ready audit,
profile bindings, permanent reservations, current account cursor and all receipts
through later operations or rollback. The private server key retains its full
original account authority; no local desktop signer was requested or activated.

W33/#288 stays open for registered-release allowed/denied Web and physical Host
listening, interruption recovery, representative costs/startup measurements,
retained-dependency monitoring, bounded renewals and off-volume encrypted-data/key
restoration. Audit every retained dependency, including Product distribution;
this new audio receipt does not renew earlier publications. Capacity remains
deferred research.
