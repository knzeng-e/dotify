# W31 - Discovery follow-ups and lighter first load for the trusted pilot

## Selected verification follow-up, 2026-10-25

The original W31 implementation (#297) is merged and deployed. After #331's
Product 0.1.61 publication, the owner selects the remaining #286 verification:
exercise **Worldwide Report**, not only reversible Hide, through the browser UI
and real local signaling. Verify the minimal target-bound request, one accepted
anonymous server count, local hiding/restore and another client's continued
access. Run on ordinary Web and the Product Host fixture without requesting an
account or location. Keep physical Host acceptance separate.

The existing Nearby hover gate also failed on starting dev `75d05f1`. Correct
that test's pointer/scroll setup and fixture teardown without forcing hover or
relaxing assertions. The original implementation prompt below is historical;
do not rebuild its visibility controls, lazy studio or discovery modes.

This follow-up uses `test/worldwide-report-coverage` because the original
`fix/discovery-follow-ups` branch belongs to the already merged implementation.

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W31** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record.

- Branch: `fix/discovery-follow-ups` created from the latest tested `origin/dev`.
- Dependencies: W19 (merged by PR #283). Can run in parallel with W30; no shared files are expected.
- Release stage: Pilot polish. Recommended before the 2026-10-17 trusted pilot; it is not a W13 evidence gate.
- Source: owner review of PR #283 on 2026-10-15, including the Codex P2 finding on `WorldwideRooms.tsx`.
- Product purpose: worldwide and nearby discovery must recover on their own, explain what becomes public, and never flicker or drop a gesture.

## Outcome

1. **Worldwide recovers after a short reconnect.** When the socket reconnects during the 10-second cooldown, the worldwide list restarts once the cooldown ends instead of staying in `disconnected`. Its messages use worldwide wording, never Nearby wording.
2. **No refresh flicker.** Automatic 30-second refreshes keep the current phase. Only an explicit start shows `locating` or `checking`, so the host switch, slider, and listener button stay stable and the status region is not re-announced.
3. **Worldwide cards can be reported or hidden**, reusing the Nearby report flow.
4. **One discovery choice.** The creation sheet and the room panel replace the two mutually exclusive switches with one labelled group, "Who can find this room?", with three options: Link only (link icon), Nearby (radar), Everyone (globe). Choosing Everyone states that the host name and current track become visible to anyone on Dotify. A failed Nearby attempt states that the previous visibility was turned off.
5. **Truthful messages.** Revoking worldwide visibility says so. A device that only returns coarse fixes ends with the existing "too uncertain" message instead of a 32-second timeout, and shows "Waiting for a more precise location..." after the first coarse fix. The empty state invites ("No open rooms within about N km yet. Widen the search, or open a room here.") with an Open a room action.
6. **Lighter first load.** Load `ArtistShell` with `React.lazy` so listeners do not download the artist studio.
7. **Small hygiene.** Use `useId` instead of the fixed `worldwide-title` id, and derive the 42 km maximum from `NEARBY_RADII`.

## Read first

- `web/src/components/WorldwideRooms.tsx`, `NearbyControls.tsx`, `NearbyVisibility.tsx`
- `web/src/features/rooms/nearbySession.ts`, `nearbyLocation.ts`, `useNearby.ts`
- `web/src/App.tsx`
- `docs/design/dotify-nearby-discovery-privacy.md`

## Acceptance and meaningful verification

- Unit tests: reconnect during cooldown resumes worldwide reads; refresh keeps the phase; coarse-only fixes end with `INACCURATE`; revocation copy depends on the mode.
- Playwright: the three-option group is keyboard reachable, has correct radio semantics, and passes axe on mobile and desktop; worldwide report hides the card; the existing nearby and worldwide journeys still pass.
- Build output shows the artist studio in a separate chunk.
- Commands: `npm --prefix web run test:unit`, `npm --prefix web run lint`, `npm --prefix web run build`, `npm --prefix web run test:nearby`, `cd web && npm run fmt`, `git diff --check`.
- Update the privacy contract and `docs/index.html` wording if the visible discovery vocabulary changes.

## Scope boundary

No server protocol change (W30 owns the server), no new discovery mode, no change to the location privacy model.

## Handoff

Write `docs/backlog/implementation/evidence/W31.md` using `evidence-template.md`.
