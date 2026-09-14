# Shared-presence implementation pass

- Branch: `feat/killer-dapp-experience`
- Reviewed base: `origin/dev`, `f6e6ee78645080cded22eafc1e45075cc9027016`
- Worktree: `/private/tmp/dotify-killer-dapp-experience`
- No deployment, contract changes, real payment, or location collection. The unrelated edit in the original `dev` checkout was preserved.

## Implementation

The existing Shared Score / Living Light system is refined through quieter actions, stronger text contrast, smaller editorial hierarchy, and human listening/support language. Mobile retains compact catalog rows and touch-safe sheets. The room uses a persistent compact player with Chat, Requests and People views; desktop places conversation alongside playback and independently scrollable room controls. QR sharing is disclosed on demand. The artist profile keeps the player dock available for returning to the room.

Chat and requests clear their draft only when the signaling server acknowledges acceptance. Rate limits, full requests, disconnection and uncertain delivery retain text. There is no automatic retry. Replies remain server-authoritative; guests still receive only the existing media stream. The composer and player fit in tested 320 × 568, 390 × 844 and 768 × 1024 layouts. The visual viewport hook also handles a simulated 430px keyboard viewport. Short phones hide the redundant top bar to retain at least 80px of readable conversation; account access remains under You and the existing access gate.

At 390 × 844, the original room document was 2,574px tall and its composer began around 1,985px. The reworked room fits the viewport, with the composer around 702px. These are local deterministic-fixture measurements, not field telemetry.

## Experiments and strategy

This section records the first pass at `8c12187`. The [next-phases follow-up](killer-dapp-next-phases.md) supersedes the local-lineup and documentation-only nearby status.

- `VITE_DOTIFY_HOST_LINEUP=on`: host-only local planning preview, up to 12 selections, manual ordering/removal/opening. Access still goes through the existing gate. Not saved, synchronized or automatically played.
- `VITE_DOTIFY_ROOM_GALAXY=on`: rollout gate and lazy component loading around the already-delivered Three.js renderer. Off by default. Existing 2D/list and degradation paths remain.
- Nearby and circles: [UX/architecture proposal](../../../design/dotify-shared-presence-pass.md), extending the existing W18 privacy contract. No runtime geolocation or memory tracking.
- [Operational rollout notes](../../../operations/deployment-configuration.md) document acknowledgement compatibility and flag rollback.

## Validation

| Check | Result |
| --- | --- |
| `npm run build` | Passed on final source. Existing large-chunk and dependency annotation warnings remain. |
| `npm run build:product-devnet` | Passed. Its catalog refresh was removed from the diff; final source was rechecked with `vite build --config vite.product.config.ts --mode product-devnet` after the shared TypeScript build. |
| `npm run test:unit` | 435 passed across 55 files; the subsequent focused flag suite added 5 passing cases (440 total). |
| `npm run test:signal` | 56 passed, including new acceptance/rejection acknowledgement checks. |
| `npm run test:e2e -- --workers=2` | Final run: 36 passed, 1.3 minutes, no retries. Includes existing access/publish/room flows and 8 new room workspace cases. |
| `npm run lint` | Passed with 3 pre-existing hook-dependency warnings in App/ArtistShell. |
| `npm run fmt:check` | Passed. |
| `git diff --check` | Passed. |
| Existing nearby simulation | 8 synthetic scenarios passed; no real location used. |
| Separate default-off browser smoke | Galaxy selector and host plan absent; room creation and player remain available. |

The galaxy checks exercise real local rooms, selection, a painted canvas, reduced motion, WebGL fallback and mobile discovery. Room checks cover drafts across panels, accepted sends, guest messaging, persistent audio element identity, offline draft retention, keyboard viewport simulation, protected host selections, QR projection, and return from artist support.

An intermediate run exposed a duplicate Start audio control; it was removed. A later intermediate Web Audio test timed out while the Product build regenerated catalog source and triggered a Vite reload. The final build and browser runs were separated and all cases passed. These failures are not hidden by retries.

Final output sizes: ordinary main JS 1,053.73kB / 322.87kB gzip; Product main JS 1,072.55kB / 327.70kB gzip; shared CSS 134.69kB / 24.94kB gzip. The Product profile emits separate chunks. These are build outputs, not real-device latency measurements.

## Evidence screenshots

Screenshots use synthetic E2E tracks and real local signaling, not production community data. The test build enables both experiments; the production defaults are off.

- [Mobile before](../../../images/killer-dapp/mobile-before.png)
- [Mobile conversation after](../../../images/killer-dapp/mobile-after.png)
- [Small phone after](../../../images/killer-dapp/small-phone-after.png)
- [Desktop conversation after](../../../images/killer-dapp/desktop-after.png)

## Review risks and limits

- Physical iOS/Android keyboards, Safari/Firefox, native Product hosts, cellular networks and live settlement were not exercised. Chromium uses synthetic audio with real Socket.IO/WebRTC negotiation. A Product build is not native-host evidence.
- Signaling should be released before or alongside the new composer. Older servers may deliver without acknowledging: the retained draft and uncertainty message prevent a false success claim, but manual resend can duplicate text. Exactly-once messaging is not claimed.
- Host planning deliberately clears when the player unmounts, the room changes, or the page refreshes. A shared queue needs revisioned server state, host authorization, safe metadata, reconnect and denied-track tests before rollout.
- The existing large runtime/WASM chunks remain. No performance or live sound-energy claim is added. Three.js is still a separate 746.88kB (191.78kB gzip) optional chunk; its component wrapper is separately lazy-loaded.
- Nearby and community memory are proposals, not implemented features. Approximate location reduces precision but does not guarantee anonymity.

## Proposed PR split

1. **Visual system and responsive app polish:** tokens, landing rhythm, typography, touch readability, quiet connection control, public page alignment.
2. **Mobile-first room and persistent conversation:** room viewport, panels, player, roster/QR disclosure, draft retention and server acknowledgements, artist return dock, regressions. Include client and server acknowledgement code together.
3. **Host playlist/queue and activity:** default-off local lineup scaffold and its gate test. Shared queue synchronization remains the documented follow-up.
4. **Galaxy prototype rollout:** default-off flag, lazy renderer boundary, existing painted-canvas/fallback regression evidence. The renderer itself predates this pass.
5. **Nearby rooms design:** W18-linked consent, approximate zones, expiry/revocation, manual/QR fallback and reversible community-memory direction. Documentation only.

This branch is one coherent pass. No PRs have been opened or split yet.
