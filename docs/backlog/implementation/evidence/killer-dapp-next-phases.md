# Shared queue and manual-area preview — implementation evidence

## Revision and scope

- Branch: `feat/killer-dapp-experience`.
- Reviewed base: `origin/dev` at `f6e6ee78645080cded22eafc1e45075cc9027016`, still the remote dev head when this continuation began.
- First pass, pushed before this implementation: `8c121872822e7a3b596b9adeaef6454eb0057f62`.
- Implementation commit: `b315fbe18ccc08e36407bd0e08ccc53d7b1ddcbe`. The following commit adds only this evidence record.
- Worktree: `/private/tmp/dotify-killer-dapp-experience`; the original dev checkout and its unrelated catalog-bootstrap edit were preserved.
- No deployment, contract changes, real payments or device location collection. Manual area choices do reach the opted-in signaling service.
- This continues the user's coherent pass. No PRs were opened or split. W19 and the public pilot are not marked complete.

## Result

The first pass's responsive visual system and persistent player/composer remain intact. The local host plan is now a shared queue in Requests: up to 12 catalog tracks, guest-visible order, host-only add/reorder/remove, explicit matching and acceptance of a text request, and manual opening through the existing listening-access flow. Selecting a protected track leaves it in the queue; it does not claim playback success or dequeue automatically. Unavailable local catalog entries can be removed but not opened.

The signaling service owns a revisioned snapshot. Stale changes are rejected with the current order; bounded operation fingerprints deduplicate retries. Queue data survives listener rejoin and host resume, stays out of global discovery, and disappears with the room. Host resume also restores chat and requests received while the host was disconnected. Acknowledgement timeouts retain confirmed state and explain uncertainty; the client does not buffer or retry mutations automatically.

The nearby feasibility preview offers separate host and listener choices in three broad named pilot areas: Lisbon, Paris and London regions. It does not define a geographic boundary or verify proximity. Hosts explicitly publish for 90 seconds; listeners explicitly search, with at most 20 results lasting no longer than 30 seconds. On mobile, completed search results receive focus and scroll above the persistent player dock. Ordinary links, codes and the full live-room list remain available.

The service accepts only an allowlisted area ID and explicit consent. Publishing is bound to the connected room host. Listings are memory-only, expire server-side and are removed on disconnect/room closure. The client requests revocation on hidden/pagehide/unmount; it never automatically renews or republishes after reconnect. Results clear on stop, hiding or disconnection. Rotating discovery identifiers and bucketed counts reduce some exposure, but stable room IDs, copy, timing and operator connection metadata still permit correlation.

The existing Three.js galaxy was retained and regression-tested: painted canvas, room selection, mobile fallback, reduced motion and unavailable WebGL. No fabricated rooms, sound-energy measurements, geospatial galaxy positions, settlement changes or community-memory tracking were added.

## Feature gates

| Preview | Frontend build flag | Signaling flag |
| --- | --- | --- |
| Shared room queue | `VITE_DOTIFY_HOST_LINEUP=on` | `SIGNAL_HOST_LINEUP=on` |
| Existing room galaxy | `VITE_DOTIFY_ROOM_GALAXY=on` | None |
| Manual-area discovery | `VITE_DOTIFY_NEARBY_PREVIEW=on` | `SIGNAL_NEARBY_PREVIEW=on` |

All default off. Server-off rejects publication/queue changes; frontend-off removes controls and sends no nearby events. Rebuild/restart requirements, bounds and rollback are in [deployment configuration](../../../operations/deployment-configuration.md#shared-presence-room-rollout). The [socket reference](../../../reference/socket-events.md) documents payloads, conflict/ack semantics and privacy limits.

## Validation

Commands below ran from `web/` unless stated otherwise. Existing installed dependencies were linked temporarily into the isolated worktree; the link was removed before committing. No dependency or generated catalog update was committed.

| Check | Observed result |
| --- | --- |
| `npm run test:unit` | 440 passed across 56 files. Includes the updated independent flag tests and existing W18 protocol tests. |
| `npm run test:signal` | Final run: 64 passed. Eight new queue/nearby cases exercise authorization, unsafe payloads, late joins, atomic request acceptance, revisions/retry, host resume with missed social activity, expiry, ID rotation, revocation, bounds and disabled collection. |
| `npm run test:e2e -- --workers=2` | 38 passed, no retries. Existing listening/access/publishing/discovery tests plus shared queue and manual-area consent journeys. |
| Room workspace after visual review | 10 passed after adding mobile result focus/scroll. |
| Final room/access regression | `npm run test:e2e -- e2e/room-workspace.spec.ts e2e/room-join.spec.ts --workers=2`: 19 passed after the host-resume snapshot change. |
| `npm run smoke:room-experiments-off` | Passed: room creation works; galaxy, queue and nearby controls absent; zero outgoing nearby frames. Local servers/browser are closed by the script. |
| `npm run build` | Passed on final application source. |
| Product build | `vite build --config vite.product.config.ts --mode product-devnet` passed after the shared TypeScript build. The catalog-generation wrapper was deliberately not run. |
| Opted-in Product build | Same Vite build with all three frontend flags `on`, output to `/tmp/dotify-next-product-preview`: passed. Nothing deployed. |
| `npm run lint` | Zero errors; three existing hook-dependency warnings in App/ArtistShell. |
| `npm run fmt:check` | Passed. |
| Repository checks | `git diff --check` passed; `node scripts/backlog-sync.mjs --check --offline` passed with existing issue-mapping/duplicate-number warnings. |

The browser consent test inspects outgoing publish/search frames: only `{ areaId: 'lisbon-region', consent: true }` is sent. It verifies no area choice in browser storage, no nearby traffic before explicit action, empty results before host consent, publication, revocation, hiding, and listener stop. Server tests verify no area in public `/status` or application logs. These are local synthetic tests, not a production traffic audit.

Final main JS: ordinary web 1,054.69kB / 323.17kB gzip; Product defaults 1,073.51kB / 328.04kB gzip; Product with all previews 1,085.81kB / 331.62kB gzip. Existing large runtime/WASM/Three.js chunks and build warnings remain. These sizes are not device-latency measurements.

## Visual evidence

Screens use synthetic catalog fixtures and real local signaling/WebRTC. They are not production people or locations. The preview test build enables all experiments; release defaults remain off.

- [Shared queue on mobile](../../../images/killer-dapp-next/shared-queue-mobile.png)
- [Shared queue on desktop](../../../images/killer-dapp-next/shared-queue-desktop.png)
- [Manual-area results on mobile](../../../images/killer-dapp-next/nearby-mobile.png)
- [Host area consent on desktop](../../../images/killer-dapp-next/nearby-host-desktop.png)

The player and composer still fit 320×568, 390×844 and 768×1024 rooms. Desktop, QR projection and the simulated mobile keyboard viewport pass. Visual inspection led to the result-focus improvement; the final nearby result button is checked above the mobile dock.

## Risks and unfinished work

- Queue order is intent, not autoplay or a durable playlist. The server trusts host-supplied catalog identity/labels and does not grant access. Starting/stopping playback remains the existing host flow. Exactly-once end-to-end delivery is not claimed.
- Nearby is a **manual-area feasibility slice**, not full W19 or a reviewed public launch. It uses a narrower Socket.IO schema than W18's proposed geographic cells. Device-side coarsening, adjacent-cell queries, sparse-region expansion, Product location permission checks, geospatial discovery filters and pilot abuse/moderation evidence remain unfinished.
- Named areas are self-declared. The operator sees coarse choice and connection IP. An observer can correlate stable room IDs and existing global room counts. An expired or revoked listing cannot retract information already copied. New queries exclude a revoked listing immediately; loaded results may remain up to 30 seconds. A lost client revoke falls back to the 90-second TTL.
- The 6/minute query budget is per network address using existing trusted-proxy rules. Crowds sharing a connection may share the budget; distributed/Sybil queries are not solved. Proxy/monitoring frame or body logging must stay disabled.
- State lives in the existing single-process signaling server. Restart ends rooms and erases queues/listings; adding replicas needs a separate room-ownership design.
- Physical iOS/Android keyboards, Safari/Firefox, native Product hosts, cellular conditions and real settlement were not tested. Product builds and synthetic WebRTC are not real-host or pilot acceptance evidence.
- Recurring circles and consented memory remain the [product proposal](../../../design/dotify-shared-presence-pass.md). No attendee lists, chat archives, location history or automatic reminders were introduced. Validate voluntary pilot needs before adding them.

## Recommended PR split

Keep the requested five review boundaries; split from the verified coherent branch rather than creating speculative PRs:

1. **Visual system and responsive polish:** first-pass tokens, landing hierarchy, touch readability and public-page alignment.
2. **Persistent room/player/chat experience:** first-pass viewport, panels, composer, acknowledgement protocol, offline drafts, roster/QR disclosure and artist return path.
3. **Shared host queue and room activity:** replace the local scaffold with host-authorized shared state, atomic request acceptance, join/resume snapshots (including missed chat/requests), client/server rollout flags and queue/access tests. Include both ends of the protocol together.
4. **Galaxy prototype rollout:** first-pass opt-in/lazy boundary and existing renderer regression evidence. The renderer itself predates this work.
5. **Manual-area nearby feasibility:** default-off client/server preview, privacy lifecycle, payload/network/storage tests, operational contract and W18/W19 limitations. Include relevant screenshots and the flags-off rehearsal.

The next eligible work is review and extraction of PR 3 and PR 5, followed by an authorized device/pilot rehearsal. Full geographic discovery and community memory still require their stated evidence gates.

## PR #164 review follow-up

Reviewed head `083feae767220101b63fe6ced42418dfac72893b`.
[Removed-request selection review](https://github.com/knzeng-e/dotify/pull/164#discussion_r4009447770):
both remove-selected and clear-all scenarios failed before correction because
Add sent an obsolete accepted-request ID and the queue remained empty.

`HostLineup` now derives the displayed selection and submitted accepted ID from
the current server request list. A vanished selection displays Host’s choice;
adding the chosen track succeeds without consuming another request. The server
still rejects a request that disappears after the last client snapshot, retaining
the existing concurrency boundary and recoverable error.

Both new browser regressions pass. PR #163's height-aware workspace is also
integrated into this branch, preserving the existing shared queue and nearby
styles and tests. The branch keeps #163 as its review base; neither PR is merged
into dev by this work. Builds and synthetic browser coverage do not replace the
physical-device and privacy review evidence listed above.

Final combined-branch validation: 440 unit tests, 64 signaling tests and 42/42
Chromium scenarios pass. Lint, formatting, TypeScript, ordinary Vite and Product
DevNet Vite builds pass (three existing hook dependency warnings and existing
large-bundle warnings remain). No catalog bootstrap regeneration. The suite
includes both selected-request regressions and the inherited landscape fix.
