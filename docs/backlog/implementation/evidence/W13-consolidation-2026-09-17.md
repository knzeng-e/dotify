# W13 pilot readiness consolidation — 2026-09-17

## Identity

- Scope: reconcile the W13 pilot gate after the room, mobile, interface,
  artist-support, and candidate-binding follow-ups merged through PR #174, then
  validate the Product CDM native payment-unit correction.
- Reviewed base: `dev` at
  `7ae99893229a551673882401dfd5ec000b3c616a`.
- Tested implementation candidate:
  `956f71df2a9d3c3db35235bc4ba321c1d8f73fa7`. The later documentation-only
  review follow-up does not change the tested Product bundle.
- Product executable version: `[0, 1, 21]`.
- W13 issue: #158 remains open.
- W13 release-package PR: #159 merged on 2026-09-14.
- This record does not claim a deployment, a real Product payment, a physical
  device certification, a rollback rehearsal, or a completed participant pilot.

## Decision

The current candidate is **code-ready but pilot-blocked**.

The release harness reports 77 passed static/local gates, 0 failed gates, 2
blocked gates, and 8 not-run gates. The merged follow-ups materially improve the
candidate and close several known implementation regressions. They do not supply
the live artifacts W13 requires. The correct go/no-go state is therefore
**hold** until the Product host, room, device, rollback, and aggregate pilot
evidence below is captured against one exact deployed candidate.

## Post-W13 merged evidence

| Area | Merged change | Evidence now present | Classification and remaining boundary |
| --- | --- | --- | --- |
| Shared room clock | [#165](https://github.com/knzeng-e/dotify/pull/165) synchronized host/guest progress and silenced stale paused audio. | Unit, signaling, loopback WebRTC, Chromium, build, and visual evidence in [room playback synchronization](room-playback-sync.md). | Automated/local pass. Physical devices, independent networks, forced TURN, backgrounding, and acoustic latency remain untested. |
| Mobile composition and discovery | [#166](https://github.com/knzeng-e/dotify/pull/166) kept chat/request inputs usable with keyboard geometry and introduced deliberate horizontal catalog navigation. | Chromium, WebKit, unit, build, and screenshots in [mobile listening and discovery](mobile-listening-and-discovery.md). | Browser/geometry pass. Physical Safari keyboard behavior remains an acceptance gate. |
| Player presence and controls | [#167](https://github.com/knzeng-e/dotify/pull/167) restored room progress and compact mobile playback controls. | CI, browser regressions, Product build, and reviewed mobile/desktop captures in [premium experience review](../../../design/premium-experience-review-2026-09-15.md). | Automated/local pass. Audible two-device Product/iPhone behavior was not certified. |
| Source changes and room continuity | [#168](https://github.com/knzeng-e/dotify/pull/168) retained one outgoing Web Audio track across Next/Previous and preserved the active room across in-app navigation. | Distinct 440/660 Hz receiver assertions, stream identity, Chromium/WebKit, and build evidence in [fluid discovery and room continuity](fluid-discovery-and-room-continuity.md). | Real local WebRTC pass. Product host, physical iPhone, TURN-only, background, and lock-screen scenarios remain untested. |
| Clear musical interface | [#169](https://github.com/knzeng-e/dotify/pull/169) and [#170](https://github.com/knzeng-e/dotify/pull/170) reduced catalog/room noise, clarified actions, and displayed optional Product host profile names. | CI, Chromium/WebKit, accessibility-oriented browser checks, builds, and screenshots in [clear musical interface](clear-musical-interface.md) and [catalog and host identity](catalog-and-host-identity.md). | Presentation pass. Product names remain unverified display data; native Product and physical-device acceptance remain open. |
| Keyboard transition | [#171](https://github.com/knzeng-e/dotify/pull/171) prevented invalid initial viewport samples from causing a visible layout jump. | Targeted Chromium/WebKit regressions, full build checks, and screenshots in [room keyboard transition](room-keyboard-transition-2026-09-15.md). | Synthetic viewport pass. The reported Polkadot Mobile/iPhone compositor path still needs a same-build device check. |
| Purchase recovery and direct support | [#172](https://github.com/knzeng-e/dotify/pull/172) made uncertain purchases recoverable and added feature-flagged gifts; [#173](https://github.com/knzeng-e/dotify/pull/173) exposed the paying/funding account and runtime identity in the transaction dialog. | 512 unit tests and 79 Chromium scenarios on #172, focused WebKit/payment checks, Product support build, and all required CI checks on #173. See [artist support recovery](artist-support-recovery-2026-09-16.md). | Automated/local pass. No real Product approval, native value transfer, final receipt, protected-key opening, or physical iPhone payment was recorded. CASH settlement remains unavailable under W16. |
| Product CDM native payment units | This consolidation fixes the Product contract path so an 18-decimal Solidity price is converted to the connected chain's native `Revive.call` Balance precision. | Focused adapter, chain-spec, and writer-provider tests cover the exact 4.2 PAS conversion and safe retry after an SDK dry-run rejection. | Automated/local pass. A newly published `[0, 1, 21]` Product build still needs one funded host payment and access read-back. |

## Current readiness snapshot

| Gate | Status | Evidence or exact blocker |
| --- | --- | --- |
| W01-W12 dependency evidence | Pass | `smoke:pilot-release` finds every dependency evidence file and integrated PR. |
| Current candidate contains merged follow-ups #165-#174 and the Product payment correction | Pass | Reviewed `dev` base `7ae9989`; tested implementation candidate `956f71d`. |
| Pilot release package and static Product configuration | Pass | 77 pass, 0 fail; Product appVersion `[0, 1, 21]`, safe origins, no browser secrets, candidate-bound Product/room evidence, and viem remains the default runtime writer. |
| Product CDM host Classic support and key opening | Blocked | No same-candidate Product host smoke JSON from a funded Product account. |
| Product-hosted room to walletless browser guest | Not run | No same-candidate room evidence JSON with audible and in-sync result. |
| Standalone desktop hosted smoke | Not run | The harness has no ordinary hosted Music/Rooms/Artist result for this candidate. |
| Physical iPhone room audio, controls, and keyboard | Not run | WebKit and synthetic VisualViewport checks are useful regressions, but they are not physical-device evidence. |
| Real Product/native artist support | Not run | No real signature, transfer, final receipt, runtime access read-back, or key opening was captured. |
| Safe rollback and old/new catalog-key compatibility | Blocked | Procedure is documented; rehearsal is absent. |
| Consented pilot and aggregate decision | Not run | No aggregate evidence for 3 artists, 5 hosts, 20 listeners, or 20 supported-device joins; no accepted three-fix go/no-go record. |

## Reproduction

Commands run locally from `web/` on tested implementation candidate `956f71d`:

```sh
npm run test:pilot-release-readiness
npm run smoke:pilot-release -- \
  --md-out /tmp/dotify-w13-consolidation.md \
  --json-out /tmp/dotify-w13-consolidation.json
npm run smoke:product-journey -- \
  --md-out /tmp/dotify-product-consolidation.md \
  --json-out /tmp/dotify-product-consolidation.json
```

Observed results:

- readiness tests: 9 passed;
- W13 release: `blocked` — 77 pass, 0 fail, 2 blocked, 8 not run;
- Product journey: `blocked` — 26 pass, 0 fail, 1 blocked, 1 not run.

The generated `/tmp` reports are local transient artifacts and are not committed.

## Exact next gate

Build and identify one candidate from the current `dev`, then capture the
Product CDM host smoke and Product room smoke from that same SHA/appVersion/CID.
In the same device session, record the physical iPhone room audio/control and
keyboard result plus one real native support result. Rehearse rollback before
recruiting the aggregate-only pilot. Only then run the W13 harness with all
three evidence inputs and produce the real go/no-go record.

## 2026-09-18 room-evidence follow-up

[PR #193](https://github.com/knzeng-e/dotify/pull/193) adds a candidate-bound
Product room smoke export backed by live host telemetry and explicit
guest-device observations. Its local verification and remaining live gates are
recorded in
[Product room smoke capture](product-room-smoke-capture-2026-09-18.md). This
improves the evidence path; it does not change the blocked W13 release decision.
