# W13 Product room smoke capture — 2026-09-18

## Identity

- Sequence and scope: W13 partial follow-up; make the Product-hosted room gate
  candidate-bound, derived from real host telemetry, and reproducible from the
  existing QA panel.
- Date: 2026-09-18.
- Starting `dev` SHA: `ec3594a66b83369630ea0e3874443726d7118faf`.
- Implementation SHA actually tested:
  `2d6c1c849c78d3d6c5b2990c8d28a3739c2c72e6`.
- Branch / PR / issue: `fix/product-pilot-readiness`,
  [PR #193](https://github.com/knzeng-e/dotify/pull/193), partial
  [W13 #158](https://github.com/knzeng-e/dotify/issues/158).
- Related dependency evidence:
  [W13 consolidation](W13-consolidation-2026-09-17.md),
  [W09](W09.md), and [W11](W11.md).
- Product executable version: `[0, 1, 25]`.
- Code readiness: locally verified; CI pending at capture time.
- Release readiness: not deployed and blocked on the live evidence below.

## Result and decisions

The debug Production readiness panel now provides a Product room smoke workflow
beside the existing payment/key workflow. The operator binds the exact build
SHA, Product app version, and deployed executable CID before starting the room.
After the Product host creates the room, the panel reads room creation, stream
readiness, peer connection, listener count, and the canonical room URL from the
active session and bounded room telemetry. The operator records only facts that
cannot be known from the host: the ordinary browser guest used no account,
heard audio, and displayed `In sync`.

The capture boundary starts when the candidate is bound and survives in-app
navigation. Binding the current room later does not discard its preceding
`room-created` event. Candidate changes clear room and guest observations. The
Product journey harness now independently requires the timestamp, candidate,
surface, canonical URL, observed host transport, walletless audible/in-sync
guest, and secret hygiene before the room surface can pass.

The panel is compiled only when `VITE_DOTIFY_DEBUG_PANEL=true`; ordinary user
flows remain unchanged. Session storage retains the operator's same-tab draft
without creating a durable listening history. The export contains no wallet
address, SDP, ICE candidate, IP address, content key, signature, token, or
audio.

## Verification

| Command or real scenario | Environment and build | Observed result | Artifact |
| --- | --- | --- | --- |
| `npm run test:unit` | Local Node 22, implementation SHA | 70 files and 552 tests passed | Terminal output |
| `node --test scripts/product-devnet-journey-harness.test.mjs` | Local Node 22, implementation SHA | 15 tests passed | Terminal output |
| `npm run test:pilot-release-readiness` | Local Node 22, implementation SHA | 9 tests passed | Terminal output |
| `npm run lint` | Local Node 22, implementation SHA | 0 errors; 3 inherited React hook warnings in `App.tsx` and `ArtistShell.tsx` | Terminal output |
| `npm run fmt:check`; `git diff --check` | Local, implementation SHA | Passed | Terminal output |
| `npm run build` | Local production web build | Passed; existing Rollup annotation, mixed import, and large-chunk warnings remain | `web/dist/`, not committed |
| `VITE_DOTIFY_DEBUG_PANEL=true npm run build:product-devnet:support` | Local Product CDM/support/debug build `[0, 1, 25]` | Passed; network-restricted catalog refresh kept the checked-in snapshot | `web/dist-product/`, not committed |
| Product QA panel at 1440×1100 and 390×844 | Local headless Chromium against the Product build | Panel present at both widths; no horizontal document overflow | `/tmp/dotify-room-smoke-{desktop,mobile}.png`, transient |
| `npm run smoke:pilot-release` | Local implementation tree, no live JSON | Correctly blocked: 77 pass, 0 fail, 2 blocked, 8 not run | `/tmp/dotify-w13-room-capture.{md,json}`, transient |
| `npm run smoke:product-journey` | Local implementation tree, no live JSON | Correctly blocked: 26 pass, 0 fail, 1 blocked, 1 not run | `/tmp/dotify-product-room-capture.{md,json}`, transient |
| `node scripts/backlog-sync.mjs --check --offline` | Local repository | Passed with inherited 24 unmapped-active-item and duplicate-08 warnings | Terminal output |

No Product host, real wallet, live payment, audible two-device room, physical
iPhone, external network, or deployed executable was used in these checks.

## Compatibility and operations

- Supported surfaces in code: Product Desktop and Product Web gateway are
  recorded separately; evidence from one cannot satisfy the other.
- New config/permissions: none. The existing
  `VITE_DOTIFY_DEBUG_PANEL=true` QA build flag exposes the panel.
- Product metadata: `web/polkadot-app-deploy.config.ts` advances from
  `[0, 1, 24]` to `[0, 1, 25]` because the Product runtime bundle changes.
- Storage/key/contract migration: none. Runtime adapter, contracts, protected
  audio, and key delivery are unchanged.
- Deployment identifiers: none; no Product publish occurred.
- Rollback: republish the prior executable metadata/CID. This procedure was not
  rehearsed in this follow-up.
- Data collected: a same-tab QA draft and an operator-exported JSON file. The
  operator can reset the draft; Dotify does not upload it.

## Acceptance mapping

| W13 criterion | Result | Supporting evidence or exact blocker |
| --- | --- | --- |
| Traceable Product room candidate | Passed locally | Build SHA, app version, and valid deployed CID are mandatory and candidate changes reset observations. |
| Product host creates and streams a room | Not run live | The panel derives both facts from host telemetry, but no Product host/CID was available. |
| Walletless browser guest hears synchronized audio | Not run live | The export and harness require no account, audible audio, and `In sync`; no two-device session was performed. |
| Evidence excludes sensitive transport and identity data | Passed locally | Model tests and harness secret-key rejection cover wallet, SDP, ICE, IP, key, signature, token, and audio fields. |
| Physical iPhone and supported-device checks | Not run | Requires the published candidate and real devices. |
| Rollback and aggregate pilot | Blocked | No safe-environment rehearsal or owner-authorized participant evidence exists. |

## Remaining gates

1. Review and merge PR #193 into `dev`.
2. Publish one debug-enabled Product validation candidate and record its exact
   SHA, `[0, 1, 25]` app version, and executable CID.
3. On Product Desktop, capture the payment/key smoke and the room smoke against
   that same candidate. The guest must be an ordinary HTTPS browser with no
   account connection and must hear audio while showing `In sync`.
4. Run the Product journey harness with both JSON files. Then complete physical
   iPhone, independent-network/TURN, backgrounding, and keyboard checks.
5. Rehearse rollback and complete the owner-authorized aggregate pilot before
   changing W13/#158 from blocked to shipped.

## Next agent

- Next eligible work: live W13 candidate validation after PR #193 merges; do not
  begin speculative feature expansion first.
- Inspect first:
  `web/src/features/productHost/productRoomSmokeEvidence.ts`,
  `web/src/components/ProductRoomSmokeEvidencePanel.tsx`, and
  `web/scripts/product-devnet-journey-harness.mjs`.
- Preserve: walletless room entry, host-only protected key access, separate
  payment submission/finality/access facts, fail-closed candidate matching, and
  the no-sensitive-room-artifact boundary.
- Reproduce the remaining gate with:

```sh
npm run smoke:product-journey -- \
  --smoke-json /path/to/product-cdm-host-smoke.json \
  --room-json /path/to/product-room-evidence.json \
  --md-out /tmp/dotify-product-journey.md \
  --json-out /tmp/dotify-product-journey.json
```

- Project metadata: PR #193 must be added to Project 5 and mirror issue #158;
  workflow/CI status must be updated after the documentation commit is pushed.
