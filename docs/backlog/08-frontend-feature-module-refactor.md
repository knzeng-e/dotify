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