# 08 — Frontend feature-module refactor

## Sprint
Sprint 1 — Stabilization and maintainability

## Priority
P1

## Objective
Refactor the frontend away from a monolithic app shell into feature modules that can be tested, reviewed, and evolved safely.

## Context
Dotify now contains several product surfaces: catalog, player, rooms, artist portal, wallet/access, IPFS, chain runtime integration. Keeping too much logic in `App.tsx` will slow every production iteration.

## Target structure

```txt
web/src/
  app/
    App.tsx
    routes.tsx
    providers.tsx
  features/
    catalog/
    player/
    rooms/
    artist-studio/
    wallet/
    access/
    runtime/
    uploads/
  shared/
    ui/
    config/
    errors/
    hooks/
    types/
    utils/
```

## Required work

- Extract catalog rendering and track selection.
- Extract audio player state and preview/full playback logic.
- Extract room creation/join logic.
- Extract artist publication workflow.
- Extract wallet/network/access services.
- Keep chain-specific calls out of presentational components.
- Introduce typed domain models:
  - Track
  - ArtistRuntime
  - AccessMode
  - PlaybackState
  - RoomState
  - UploadState

## Constraints

- Refactor in small commits or PRs.
- Do not change product behavior unless explicitly necessary.
- Add tests around extracted pure logic.
- Avoid introducing global state libraries unless justified.
- Prefer composable hooks/services over deep prop drilling.

## Acceptance criteria

- `App.tsx` becomes an app composition shell, not the main business-logic container.
- Core flows still work locally.
- At least access logic and room state logic have isolated tests.
- TypeScript remains strict enough to catch broken integrations.
- README or architecture docs mention the new frontend module structure.

## Non-goals

- Do not redesign the entire UI.
- Do not migrate framework.
- Do not implement mobile.

## Senior-engineer notes

Refactor like a surgeon, not like a decorator. Preserve behavior first. Then make the system easier to evolve. The goal is not prettier folders; the goal is lower production risk.

## Delivery notes (incremental - foundation PR)

This ticket is being delivered as a series of small, behavior-preserving PRs (per the "refactor in small commits or PRs" constraint). First PR on `refactor/frontend-feature-modules`:

- Added a unit-test runner (Vitest) - `npm run test:unit` - and `web/vitest.config.ts`. Pure-logic tests live co-located as `*.test.ts`.
- Introduced `web/src/features/` with the two domains the acceptance criteria call out for isolated tests:
  - `features/access/accessPolicy.ts` - `isPolicyManagedTrack`, `trackHasAccess`, `trackNeedsAccess`, `playbackModeForAccess`. Centralizes the policy-managed-track predicate previously duplicated in `App.tsx`, `useCatalog.ts`, and `PlayerView.tsx`.
  - `features/rooms/roomState.ts` - `getInitialRoomCode`, `buildSessionLink` (re-homed from `useSession`), and `roomPresenceCount`. URL-reading helpers accept an explicit argument so they are testable without a DOM.
- Rewired callers (`App.tsx`, `useSession.ts`, `useCatalog.ts`, `PlayerView.tsx`, `RoomsView.tsx`, `ListenView.tsx`, `ArtistProfileView.tsx`) to use the extracted helpers with no behavior change. Verified by the existing Playwright suite (10/10 green).
- Documented the target module structure in `web/README.md`.

Second PR on `refactor/frontend-catalog-module` (stacked on the foundation PR):

- Added `features/catalog/trackModel.ts` - `catalogTrackToTrackInfo` and `isTrackManagedByArtist` (lifted out of `App.tsx`) and `runtimeAddressFromTrackId` (dedupes the `id.split(':')[0]` parsing previously repeated in three `useCatalog.ts` sites and `ReleasesTab.tsx`). Co-located `trackModel.test.ts`.
- Rewired `App.tsx` (drops the two inline mappers), `useCatalog.ts` (uses the runtime-id helper with fail-closed guards), and `ReleasesTab.tsx` (drops its local copy).

Deliberately deferred to follow-up PRs (to keep each diff reviewable and low-risk): moving the existing hooks/views/components into the full `features/* + shared/* + app/*` tree, and extracting the player, artist-studio, wallet, and uploads feature modules. `App.tsx` slimming continues across those PRs.