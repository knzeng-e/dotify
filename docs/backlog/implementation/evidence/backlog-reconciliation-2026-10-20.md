# Delivery reconciliation, 2026-10-20

Reviewed against tested `dev` `e0d8c2cfe813c7722d48009f195811561a99ce4e`.
This is a scope/evidence reconciliation, not a replacement workflow board.
Project 5 owns live status. Earlier dated evidence remains historical.

| Scope | Delivered evidence | Remaining boundary |
| --- | --- | --- |
| #306 mobile forms | #307 merged at `b089666`; #308 records published Product 0.1.56, independent Web/desktop smoke, browser keyboard geometry and owner mobile confirmation on 2026-10-20 | Implementation is complete. Keep the full native device/rotation/first-tap/listening matrix in W13 and the form evidence; do not claim those checks passed from one owner observation. |
| #285 / W30 | #296 merged; coordinated 0.1.52 rollout records API/signaling deployment, stable epoch, writable persistent catalog/revocations, bounded proxy-identity diagnostics, one signaling machine and admitted-member TURN grant | API still runs as root because the existing volume is root-owned. Complete a reviewed non-root ownership/migration/rollback plan and rehearsal before declaring the entire W30 scope complete. Do not redeploy or rotate the epoch to repeat already recorded checks. |
| #286 / W31 | #297 merged; 0.1.52 and later rollouts carry reconnect recovery, stable refresh, shared report/hide, exclusive visibility and lazy `ArtistShell` | Original evidence explicitly lacks a dedicated Worldwide report E2E. Verify that path before closing the implementation ticket. Native discovery reliability remains #274/#85/#89, not a reason to repeat W31. |
| #274 / W19 | Nearby and automatic galaxy delivered through #278/#279/#283/#298/#300 and later continuity work | Installed Host location, permissions and native lifecycle acceptance remain; same Wi-Fi is not proof of valid coordinates. |
| #88 / #89 | DAV2/relay cancellation, recovery, scoped discovery and live-presence changes are delivered through #302/#304 | Physical first sound, prolonged listening, independent-network/forced TURN and capacity evidence remain. A bounded process-local ciphertext cache is not W33 edge delivery. |
| #158 / W13 | Reversible release tooling and multiple candidate-bound rollout records exist; current test artifact is Product 0.1.56 | Full supported-device, receipt/chat, rollback and consented aggregate pilot decision remain. Publication is not acceptance. |
| #287 / W32 | Existing DAV2 is the compatibility baseline, not completed transcoding | Owner selected W32 implementation on 2026-10-20. Preserve its W30 dependency and release gate; local independent format/security work may proceed, but this record neither waives the non-root remainder nor authorizes activation. W33/W34 remain separate. |

## Sources and reproduction

- [Mobile implementation evidence](mobile-form-continuity-2026-10-19.md) and
  [0.1.56 rollout](product-0.1.56-rollout-2026-10-19.md).
- [0.1.52 coordinated rollout](product-0.1.52-rollout-2026-10-16.md),
  especially Deployment and security boundaries and its live TURN check.
- [W30 original evidence](W30.md) and `services/api/Dockerfile`: signal runs
  as `node`; API has no `USER node` and explicitly documents volume ownership.
- [W31 original evidence](W31.md): the studio was already split into a separate
  chunk. `web/src/App.tsx` still imports `ArtistShell` through `React.lazy`.
  The missing Worldwide report journey is recorded under Remaining gates.
- [Current dev CI](https://github.com/knzeng-e/dotify/actions/runs/39339557558):
  eight successful checks on the reviewed base. No suites were rerun merely
  to rewrite documentation, and these results do not certify a future merge.

No service restart, permission change, contract migration, funded transaction,
secret read/rotation or participant contact is part of this reconciliation.
Historical app versions in older evidence are not current deployment targets;
use the current-release table in the deployment runbook.
