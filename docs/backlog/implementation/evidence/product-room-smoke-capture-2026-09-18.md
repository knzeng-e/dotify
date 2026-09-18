# W13 Product room smoke capture — 2026-09-18

## Identity

- Sequence and scope: W13 partial follow-up; make the Product-hosted room gate
  candidate-bound, derived from real host telemetry, and reproducible from the
  existing QA panel.
- Date: 2026-09-18.
- Starting `dev` SHA: `ec3594a66b83369630ea0e3874443726d7118faf`.
- Implementation SHA actually tested:
  `c351e81baf395eb09c02dd5929ecd9b9c06f4a23`.
- Merged `dev` candidate published:
  `2dc05aaa4972483347ee1bfbe2656a4de2f6f3d0`.
- Branch / PR / issue: `fix/product-pilot-readiness`,
  [PR #193](https://github.com/knzeng-e/dotify/pull/193), partial
  [W13 #158](https://github.com/knzeng-e/dotify/issues/158).
- Deployment record branch / PR: `chore/w13-live-candidate-evidence`,
  [PR #194](https://github.com/knzeng-e/dotify/pull/194).
- Live room follow-up source base / branch:
  `5c03fb9129399686cec2d432998fead3929e31f2` / `fix/room-track-handoff`.
- Related dependency evidence:
  [W13 consolidation](W13-consolidation-2026-09-17.md),
  [W09](W09.md), and [W11](W11.md).
- Product executable version: `[0, 1, 25]`.
- Code readiness: locally and CI verified.
- Release readiness: published to Product DevNet; the Product-hosted room path
  passed against an ordinary browser guest. Payment/key, canonical Product Web
  room entry, and the remaining device/operations gates stay open below.

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

The final review follow-up also covers the common share-link order where
playback starts before the guest arrives. In that path, host stream readiness is
established by an active captured stream plus a connected host peer even though
the earlier `stream-ready` event was emitted before any listener existed. A
connected peer without an active local stream still fails closed.

The panel is compiled only when `VITE_DOTIFY_DEBUG_PANEL=true`; ordinary user
flows remain unchanged. Session storage retains the operator's same-tab draft
without creating a durable listening history. The export contains no wallet
address, SDP, ICE candidate, IP address, content key, signature, token, or
audio.

The merged candidate was published on 2026-09-18 as
`bafybeih5rg7nvqfmcbnoeru4ldmo7mfghmq77fuhcm5ngiysi4udfqgk4i` and bound to
both `dotify-test01.dot` and `app.dotify-test01.dot`. The Product Desktop host
resolved the app, rendered the ten-track catalog, navigation, and player, and
then presented the expected permission boundary for `dotify-signal.fly.dev`
and `dotify-api.fly.dev`. The operator granted persistent access to those two
declared backends. The host then created room `FLFNQZ`, and an ordinary Chrome
guest joined through the deployed Netlify web surface without connecting a
wallet. Chrome showed two people, `In sync`, matching progress, and active tab
audio while the host played the room stream. Host pause/resume muted and
resumed the guest at the same position without reproducing the prior repeated
pause artifact. Navigating the host back to Music preserved the room and its
two-person presence.

The host also advanced across multiple catalog tracks. Guest metadata and
audio followed without replacing the room session, but Product source
resolution took more than twelve seconds for one transition. During that gap,
the new title appeared over the outgoing track's completed progress and an
apparently usable Play control. The follow-up branch adds an explicit
`Preparing audio` handoff: outgoing audio stops immediately, progress resets,
transport is disabled while access/fetch/decryption resolves, and autoplay
continues once the new source is ready. A deterministic delayed-source
Playwright scenario now covers this real Product condition.

The public Product gateway also resolved and rendered the same ten-track app in
a normal Google Chrome session. A separate headless Chromium probe reached the
gateway shell but its embedded Smoldot client crashed before executable load;
because the real browser path passed, that result is retained only as a test
environment limitation rather than a public-gateway incident.

The canonical Product Web room URL preserved `#/rooms/FLFNQZ` through the
gateway into the embedded executable. That separate browser origin displayed
the room as unavailable because it did not yet have the network permission
already granted to Product Desktop. It therefore proves route propagation, not
canonical Product Web room entry. The working guest evidence above uses the
ordinary HTTPS Netlify surface.

The deployment refreshed the generated Product catalog snapshot from the live
API immediately before compilation. The published artifact therefore contains
ten releases rather than the eight-release snapshot present in the merged
commit. This follow-up versions that public generated input so the deployed
artifact can be reconstructed and reviewed from Git. The deterministic catalog
fixture carries the same ten-release payload, so the Product CI gate regenerates
the deployed snapshot without drift.

## Verification

| Command or real scenario | Environment and build | Observed result | Artifact |
| --- | --- | --- | --- |
| `npm run test:unit` | Local Node 22, implementation SHA | 70 files and 553 tests passed | Terminal output |
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
| GitHub `Dev Quality Gates`, backlog sync, and Claude review | PR #193 head after evidence commit | All required checks passed, including Web, Product DevNet build, contracts/ABI, API, signaling, repository hygiene, workflow syntax, and Playwright core flows | [PR #193 checks](https://github.com/knzeng-e/dotify/pull/193/checks) |
| `VITE_DOTIFY_DEBUG_PANEL=true VITE_DOTIFY_RUNTIME_ADAPTER=product-cdm VITE_DOTIFY_ARTIST_DONATIONS=on npm run deploy:product-devnet` | Merged `dev` SHA `2dc05aa`; Product app `[0, 1, 25]` | Passed; all 23 Bulletin chunks finalized, both DotNS records verified on-chain, and P2P retrieval completed in 73 ms | Root CID and transactions below |
| `npm run generate:product-catalog-bootstrap:strict -- --input fixtures/product-devnet-catalog.json` | Ten-release public fixture captured from the deployed build input | Passed and regenerated the checked-in Product bootstrap without drift | `web/fixtures/product-devnet-catalog.json` |
| Open `dotify-test01.dot` in Polkadot Desktop Dev | Native Product Desktop, published CID | Passed for resolution and first render: Dotify displayed 10 tracks, navigation, and the player before the expected backend-domain permission prompt | Manual Product Desktop observation |
| Open `https://dotify-test01.dev-dot.li` in Google Chrome | Public Product web gateway with RPC gateway fallback | Passed: Product resolved and rendered the same 10-track catalog and room entry surface | Manual Chrome observation |
| Open `https://dotify-test01.dev-dot.li` in headless Chromium | Diagnostic-only browser environment | Gateway returned HTTP 200, but its Smoldot light client crashed before executable load; normal Chrome passed | `/tmp/dotify-product-live.png`, transient |
| Product Desktop host → ordinary Chrome guest room `FLFNQZ` | Published Product candidate as host; Netlify HTTPS guest with no wallet connection | Passed: 2 present, `In sync`, audible browser tab, synchronized progress and pause/resume, chat delivery, and host navigation continuity | Manual Product Desktop and Chrome observation |
| Host Next across live Product tracks | Same two-surface room | Passed session continuity and eventual autoplay; exposed a >12 s source-resolution interval with stale outgoing progress | Manual Product Desktop and Chrome observation |
| Delayed room track handoff | Local Playwright against `fix/room-track-handoff` | Passed in both native-capture variants: `Preparing audio`, zeroed progress, disabled Play during resolution, then new title/tone without stream replacement | `room-continuity.spec.ts` |
| `npm run test:unit` | Local Node 22, follow-up branch | 70 files and 553 tests passed | Terminal output |
| `npm run test:e2e -- --project=chromium e2e/room-continuity.spec.ts e2e/room-sync.spec.ts e2e/room-join.spec.ts` | Local Playwright, follow-up branch | 14 tests passed, including repeated pause silence, seek, public/protected joining, and Product Mobile fallback | Terminal output |
| `npm run test:signal` | Local Node 22, follow-up branch | 59 tests passed | Terminal output |
| `npm run build`; Product CDM/support/debug build | Local Node 22, follow-up branch | Passed; existing build warnings remain | Terminal output |

A live payment was not submitted in this capture. The room check used two real
surfaces on one computer rather than two physical devices or an independent
external network. Physical iPhone, independent TURN/network, and exported QA
JSON evidence therefore remain open.

## Compatibility and operations

- Supported surfaces in code: Product Desktop and Product Web gateway are
  recorded separately; evidence from one cannot satisfy the other.
- New config/permissions: none. The existing
  `VITE_DOTIFY_DEBUG_PANEL=true` QA build flag exposes the panel.
- Product metadata: `web/polkadot-app-deploy.config.ts` advances from
  `[0, 1, 24]` to `[0, 1, 25]` because the Product runtime bundle changes.
- Storage/key/contract migration: none. Runtime adapter, contracts, protected
  audio, and key delivery are unchanged.
- Deployment identifiers:
  - executable/root CID:
    `bafybeih5rg7nvqfmcbnoeru4ldmo7mfghmq77fuhcm5ngiysi4udfqgk4i`;
  - storage upload: block `901340`, transaction
    `0x7772d2923bedf147c525e9e3593221e6733c56a2f462649ec801dc8c5984a591`;
  - root upload: block `901347`, transaction
    `0x6d35f884e6a2026a00fae08cce7e2b482fd37371c0aec88adf8ddbc5f585eedd`;
  - `dotify-test01.dot`: block `13406566`, transaction
    `0xe08f161f7719e59d0c0c7173dca178e099a208e4ca68e6c5c9725730a9e270de`;
  - `app.dotify-test01.dot`: block `13406581`, transaction
    `0xdead583fa02a82eae02813dc6a9fa048cc404abb4e3570fdfb5f8de097e587e4`.
- Rollback: republish the prior executable metadata/CID. This procedure was not
  rehearsed in this follow-up.
- Data collected: a same-tab QA draft and an operator-exported JSON file. The
  operator can reset the draft; Dotify does not upload it.

## Acceptance mapping

| W13 criterion | Result | Supporting evidence or exact blocker |
| --- | --- | --- |
| Traceable Product room candidate | Passed live | Merged SHA `2dc05aa`, app version `[0, 1, 25]`, finalized root CID, and both DotNS transactions are recorded above. |
| Product executable resolves and renders | Passed live on Product Desktop | The native host loaded the finalized CID and rendered the ten-track Dotify catalog. |
| Product host creates and streams a room | Passed live | Product Desktop created `FLFNQZ`; Chrome received real audio, matching track/progress, pause/resume, chat, and subsequent track handoffs. |
| Walletless browser guest hears synchronized audio | Passed live on the ordinary HTTPS surface | The Chrome guest connected no wallet, displayed `In sync`, showed an active audio tab, and remained synchronized with the Product host. The QA JSON export remains unavailable. |
| Evidence excludes sensitive transport and identity data | Passed locally | Model tests and harness secret-key rejection cover wallet, SDP, ICE, IP, key, signature, token, and audio fields. |
| Physical iPhone and supported-device checks | Not run | Requires the published candidate and real devices. |
| Rollback and aggregate pilot | Blocked | No safe-environment rehearsal or owner-authorized participant evidence exists. |

## Remaining gates

1. Capture the live payment/key smoke against the same deployed candidate,
   stopping for wallet confirmation before the transaction is submitted.
2. Grant the canonical Product Web wrapper its own declared network access and
   repeat room entry there; Product Desktop permission does not transfer to
   that browser origin.
3. Export the payment and room QA JSON when the compiled debug panel is
   available, then run the Product journey harness with both files. Complete
   physical iPhone, independent-network/TURN, backgrounding, and keyboard
   checks.
4. Retain the headless Smoldot limitation in automation notes and investigate
   only if it reproduces in a supported interactive browser.
5. Rehearse rollback and complete the owner-authorized aggregate pilot before
   changing W13/#158 from blocked to shipped.

## Next agent

- Next eligible work: live W13 payment/key validation and canonical Product Web
  room entry on the published candidate; do not begin speculative feature
  expansion first.
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

- Project metadata: PR #193 is in Project 5 with `P1`, `Production spine`,
  `Now`, `Work`, and the W13 backlog path mirrored from issue #158. Its workflow
  state moves from `In Progress` to `In Review` when the draft is marked ready.
