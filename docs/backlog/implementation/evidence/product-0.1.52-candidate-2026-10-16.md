# Product 0.1.52 candidate — 2026-10-16

- Application base: `3b0bb68db9e669a3bd0baaabbf8bc1763f78c98f`, merged #296/#297/#298.
- Candidate identity: this release branch's packaging commit, with executable `[0, 1, 52]`.
- Profile: existing `product-cdm` / `devnet`, `dotify-test01.dot`; no contract or permission migration.
- Frozen catalog: 13 items refreshed by the strict generator from the current API.
- Public Host Remote Config matches the pinned CLI 0.20.0 environment at preparation.
- Planned order: API, signaling with v3 reads, ordinary Web, then signed Product publication.
- Configure the previously absent stable `SESSION_EPOCH` as a generated Fly secret before API rollout. Do not rotate content-key custody secrets.
- Preserve one API volume writer and one signaling worker. Recheck `/health` room/listener/solo counts immediately before restart, with fail-fast gating; do not close user rooms during smokes.
- No publication is claimed by this candidate record. The rollout record must capture image identities, CID, transaction read-back, served Web SHA and observed tests.
- Rollback artifacts: Product 0.1.51 CID `bafybeihpprpso6vopekio67surwcygt2ygs6dnppdfsszmiul2qchib2me`; existing API/signal `release-0.1.51-cdb9ac2` images. Keep a v3-capable privacy-safe server for client rollback.
- Physical Desktop/mobile location, native revocation and real listening/payment remain acceptance gates. No funded tip is part of automated validation.
