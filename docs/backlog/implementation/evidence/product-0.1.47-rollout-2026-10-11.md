# Product 0.1.47 rollout evidence — 2026-10-11

## Candidate identity

- Release PR: [#267](https://github.com/knzeng-e/dotify/pull/267)
- Source SHA: `1075800ea1e60acaa05923c966d4ed498448cb92`
- Product appVersion: `[0, 1, 47]`
- Runtime profile: `product-cdm` on `devnet`
- Executable CID: `bafybeiht6sq4c3ehc3oku7fbvuonq3hbywnnwot6c5wf4jyi5pjgdgmv74`
- Rollback artifact: Product 0.1.46 at
  `bafybeif3sjmbjz3hmpcnozz2btkewimxr3a4xy5pjia47pxgqfe636voty`

This release coordinates the strict `dotify.track.v2` API validator with the
ordinary Web and Product publisher/reader. It also includes the role-specific
room queue and quieter chat controls from #263. No contract or signaling
deployment was part of this rollout.

## Pre-publication evidence

| Gate | Result |
| --- | --- |
| Pull request quality gates | Passed: API, contracts/ABI drift, Product build, repository hygiene, signaling, Web checks, workflow syntax and Playwright core flows. |
| Signer-free Product candidate workflow | Passed against exact PR SHA `cea492fe8b9578becfd1c0a0bffbe0faa5d1703f`; no mnemonic or network write. |
| Local Web unit suite | 112 files and 869 tests passed. |
| Local API suite | Typecheck/build passed; 167 tests passed. |
| Product deploy boundary | 20 tests passed; live Remote Config matched CLI 0.20.0, DevNet registry/content resolver and the tracked Host override. |
| DevNet endpoints | Six read-only checks passed for chain 420420417, contracts, Bulletin and IPFS. |
| Builds | Ordinary Web and frozen Product release builds passed. |
| Static Product journey | 31 gates passed; physical Product payment/key and room evidence remained blocked/not-run as designed. |

## Coordinated rollout

1. The Fly API was deployed first from the exact merge SHA. `/health` returned
   `ok`, `/version` returned the exact SHA, and the Netlify origin CORS
   preflight returned `204` with the expected allow-origin header.
2. Netlify served `assets/index-DXOg0ift.js`; the deployed bundle contains the
   same merge SHA.
3. Product was published from the same immutable checkout. Bulletin finalized
   the stable upload at block `1169320` in transaction
   `0x52a4948882fe0def1869d466894d3d140290a2f361474a2d0e1781d43ea43f0b`
   and the full-CAR root at block `1169323` in transaction
   `0x23bc505a62c99b770322a2c45b00406218b52226c881e34b3a6535c8357183ed`.
4. All 25 Product content nodes reached finality. DotNS content linking
   finalized at Asset Hub block `14311095` in transaction
   `0x676701b6560840052e842effce63e81506fc471ca538ea675d5a747ac5db0be7`.
   The executable manifest update finalized in transaction
   `0x5b091dcd24e179aba50b7b8ddea172c309f3845f404c47ff7bbbfa4682b2444b`.
5. P2P retrieval passed in 44 ms. An independent read of the public Product CAR
   returned 14,623,653 bytes and contained `assets/index-_G1q9pb6.js` plus the
   exact merge SHA.
6. The local DotNS mnemonic was removed from `launchd` immediately after the
   signed publication.
7. A post-publication Chromium smoke loaded the public Netlify application at
   desktop and mobile viewports with the expected title and listening home;
   neither viewport emitted a console error or uncaught page error. The API
   health endpoint remained healthy and `/version` still returned the exact
   release SHA.

## Remaining acceptance

This record proves publication and content identity, not installed-host user
behavior. Reopen Product Desktop and mobile so the Host loads appVersion
`[0, 1, 47]`, then capture candidate-bound evidence for:

- one new v2 artist publication and listener read-back of its story, facts and
  credits while runtime price and recipients remain authoritative;
- native Product tip approval, finalized receipt recovery and artist dashboard
  visibility without an EVM wallet request;
- announced artist room entry, chat delivery, host-only queue controls and
  compact reply/pin actions;
- a Product-hosted room heard in sync by a walletless independent browser;
- rollback to the exact 0.1.46 artifact and restoration of this 0.1.47 CID.

Keep W13 on hold until those physical checks and the consented aggregate pilot
bind their evidence to this SHA, appVersion and CID.
