# Product 0.1.53 candidate — 2026-10-17

- Application base: `726310b2fe0aee901da64fefb7df9ad56e3efaf8`, merged #300.
- Candidate identity: this release branch's packaging commit, with executable `[0, 1, 53]`.
- Profile: existing `product-cdm` / `devnet`, `dotify-test01.dot`; no contract, permission, API, secret or storage migration.
- Frozen catalog: 13 items refreshed by the strict generator from the current public API; fixture and bootstrap metadata match.
- Signaling v4 was deployed first as Fly release 34, image label `release-0.1.53-726310b`, from the merged application base. One worker remains active.
- Deployed smokes verify private-by-default room creation, anonymous joining, allowed/denied origins, v3 compatibility, v4 exact listener counts, immediate visibility opt-out and no coordinate/source leakage.
- Ordinary Web serves the merged application SHA `726310b2fe0aee901da64fefb7df9ad56e3efaf8`; Product publication remains separate.
- Product 0.1.52 CID `bafybeicn6kz5i5yyuoalubbe3hsl7sr7qbunccysju5rki3wrtgi2dbz7m` remains the client rollback artifact. Keep privacy-safe v4 signaling when rolling clients back.
- Native Desktop/mobile location remains a Host capability gate. Physical checks must cover Nearby/Worldwide/link-only stability, cover planets, exact presence, own-room identity, artist aggregates and prolonged audio.
- No real coordinate, funded tip, contract write or user room was used during automated validation. No publication is claimed by this candidate record.
