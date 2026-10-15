# Product 0.1.51 recovery candidate — 2026-10-15

Application base: `974568c8e42211d757f50178c7de96ca1df087e3`, merged #283.
Branch: `release/product-0.1.51`; Product `[0, 1, 51]`, `product-cdm` / `devnet`.
Refs #274, #88 and #89. This record is preparation, not proof of publication.

The owner authorized deployment and tests after merging #283. Its exact reviewed
source passed all quality gates in run 38807971747. The merge changes no application
files relative to that tested PR. Netlify already serves the merged SHA in
`assets/index-DVB88dbf.js`; no manual Web redeploy is necessary for those fixes.

Six DevNet endpoint checks and live Product Remote Config alignment with pinned
CLI 0.20.0 passed before signing. The public catalog was fetched and validated,
then frozen together with its reproducible fixture (13 releases). Track assets
are not republished. The new API preserves `cover/` beneath the returned Pinata
root; existing flat pins use the same-CID client fallback.

Rollout order: one signaling worker, then the existing API writer/volume, then
frozen Product publication. Initial preparation saw zero rooms/listeners; the final switch incident and
actual active counts are recorded in the rollout evidence. Record the final committed source, images, transaction references,
DotNS read-back and deployed tests in the rollout record. No contract, key,
origin, permission or persistent-storage migration is part of this release.

Rollback references: Product 0.1.50 CID
`bafybeie3r7hmzucvqhmkv5prgt3tguyq2m3fictwgdm7uelm3ssmo6b72m`;
signal image `registry.fly.io/dotify-signal@sha256:c4fa0a5f982a7f2146a9e55fb8ab6f29d3c1c76d9b4de5b82f75c1e861cf3c4f`;
API image `registry.fly.io/dotify-api@sha256:3219ba08c80c85674c13dac3fbdf6fdd47ab30ac33ed8cd59b1944c0c6c3c014`.
Retain privacy-preserving signaling when rolling back a client. Restarts clear
only ephemeral rooms/chat/discovery; never repeat a paid tip to repair an announcement.

Physical Product Desktop 0.1.3 / App 0.10.0 and mobile location, account approval,
long audio playback and one artist-authorized cover upload/read-back remain
acceptance checks. Synthetic coordinates are used only in labelled deployment
smokes; no user's precise location is collected by those checks.

Local candidate checks passed: 943 unit tests, 20 Product deploy/Host guard tests,
production environment fail-closed smoke, six live DevNet endpoint checks and
live Product environment alignment. The exact committed artifact is built frozen
before signing; its independent read-back belongs to the rollout evidence.

Publication completed from `cdb9ac2`. See the [rollout record](product-0.1.51-rollout-2026-10-16.md) for actual service identities, finality, independent read-back, tests and the restart incident.
