# Ticket 08 - Frontend feature-module refactor: PR tracker

Living checklist for the incremental, behavior-preserving delivery of
`docs/backlog/08-frontend-feature-module-refactor.md`. Each row is one small PR.
Keep this file updated as PRs land so the work can be resumed at any time.

## Method (applies to every PR)

- Extract pure domain logic into `web/src/features/<domain>/` with a co-located
  `*.test.ts` (Vitest). No DOM/chain deps; helpers that read `window.*` take an
  explicit argument so they stay testable.
- Rewire callers; preserve behavior exactly. Hooks/views depend on `features/*`,
  never the reverse.
- Each PR must be green: `test:unit`, `lint` (0 errors), `build` (tsc),
  `fmt:check`, `test:e2e` (10/10).
- Update `web/README.md` (features list) and the ticket delivery notes.

## Stack / merge order

PRs 1-8d (#40-#50) are merged to `main`. PR 8e (#51, shared TopBar) is open,
branched from `main`. Remaining PRs branch directly from `main`; if several are
open at once, stack and merge bottom-up.

## PRs

| # | PR | Branch | Scope | Status |
|---|----|--------|-------|--------|
| 1 | #40 | `refactor/frontend-feature-modules` | Vitest infra + `features/access/accessPolicy` + `features/rooms/roomState` | Merged |
| 2 | #41 | `refactor/frontend-catalog-module` | `features/catalog/trackModel` (TrackInfo mapping, `isTrackManagedByArtist`, runtime-id parser) | Merged |
| 3 | #42 | `refactor/frontend-player-module` | `features/player/playbackStatus` (`AudioStatus`, status label, transport progress) | Merged |
| 4 | #43 | `refactor/frontend-wallet-module` | `features/wallet/network` (`parseChainId`, `toEip155ChainId`, `getProviderErrorCode`, `chainMismatchMessage` dedupe across App + useArtistConsole) | Merged |
| 5 | #44 | `refactor/frontend-uploads-module` | `features/uploads/uploadModel` (draft TrackInfo, title-from-filename, upload-status transitions) + `priceDotForAccessMode`/`localAudioRef` dedupe in `trackModel`; slim `App.tsx` `handleAudioFile`/`handleCoverFile` | Merged |
| 6 | #45 | `refactor/frontend-runtime-module` | `features/runtime/accessEncoding` - bidirectional access-mode / personhood codecs (encode in useArtistConsole, decode in useCatalog) | Merged |
| 7 | #46 | `refactor/frontend-artist-studio-module` | `features/artist-studio/releaseForm` - wizard step machine + `canReviewRelease` + artist setup/lock derivations; dedupe `NewReleaseTab`'s step list | Merged |
| 8 | #47 | `refactor/frontend-app-routing` | Introduce `app/routing.ts` - pure view/route + history/popstate helpers pulled out of `App.tsx` (view guard, initial view, artist-portal path, popstate resolution) | Merged |
| 8a | #48 | `refactor/frontend-app-navigation` | Introduce `app/navigation.ts` - static `VIEW_COPY` + `NAV_ITEMS` nav model pulled out of `App.tsx` (handlers stay in App) | Merged |
| 8c | #49 | `refactor/frontend-primary-nav` | Extract `components/PrimaryNav` (`SideRail` + `BottomNav`) - dedupes the two inline nav renders in `App.tsx` | Merged |
| 8d | #50 | `refactor/frontend-artist-portal-shell` | Extract `views/ArtistPortalView` - the /artists shell (topbar + layout + modal slots); artist content + modals passed in as nodes | Merged |
| 8e | #51 | `refactor/frontend-topbar` | Extract shared `components/TopBar` (brand + wallet pill) used by both the listener shell and `ArtistPortalView` | Open (review) |
| 8b-1 | - | `refactor/frontend-providers-foundation` | `AppProviders` scaffold + `UiFeedbackProvider` + `WalletProvider`; TopBar, WalletModal, TransactionModal consume contexts | Done on branch (checks green; App.tsx 986 -> 859) |
| 8b-2 | - | `refactor/frontend-providers-navigation` | `NavigationProvider`; popstate/history effects move out of `App.tsx` | Done on branch (checks green; App.tsx 859 -> 832) |
| 8b-3 | - | `refactor/frontend-providers-release-form` | `ReleaseFormProvider` incl. Bulletin manifest-ref relocation; delete the `artistConsoleBulletinRef` hack | Done on branch (checks green; App.tsx 832 -> 845, see note) |
| 8b-4 | - | `refactor/frontend-providers-catalog-session` | `CatalogProvider` + `SessionProvider` wrap `useCatalog`/`useSession`; catalog + one-link-join effects move in | Done on branch (checks green; App.tsx 845 -> 762) |
| 8b-5 | - | `refactor/frontend-providers-studio-playback` | `ArtistStudioProvider` + `PlaybackProvider` wrap `useArtistConsole`/`usePlayback` + the open-track/preview handlers; App owns no hooks/state | Done on branch (checks green; App.tsx 762 -> 675; two deferrals, see notes) |
| 9 | - | `refactor/frontend-shared-tree` | Introduce `shared/`; relocate `components/ui` -> `shared/ui`, `config` -> `shared/config`, `utils` -> `shared/utils`, `types.ts` -> `shared/types.ts` with import updates | Done on branch (checks green; 15 renames + 47 import edits, +101/-101) |

## Acceptance criteria coverage (ticket 08)

- [x] Access logic has isolated tests (PR1).
- [x] Room-state logic has isolated tests (PR1).
- [x] Typed domain models introduced incrementally: AccessMode (PR1), RoomState (PR1),
      Track (PR2), PlaybackState (PR3), UploadState (PR5), ArtistRuntime access encoding (PR6).
- [~] `App.tsx` becomes an app composition shell: providers/context boundary complete
      (PR8b-1..8b-5) - App owns no feature hooks and no business state, reading everything
      from the provider stack (986 -> 675 lines). Remaining: extract the listener render
      tree into shell components + have `ArtistConsole`/`PlayerView` consume context
      directly instead of large prop lists (deferred follow-up).
- [x] TypeScript remains strict (each PR builds under `tsc -b`).
- [x] README documents the new frontend module structure (PR1+).
- [x] Full `features/* + shared/* + app/*` tree in place: `features/*` (PR1-7),
      `app/*` incl. `app/providers/*` (PR8, PR8b), and `shared/{ui,config,utils,types}`
      (PR9). `shared/errors` and `shared/hooks` are intentionally not created yet
      (no shared error module; stateful hooks stay under `hooks/`).

## Notes / decisions

- E2E is the regression net for behavior preservation; every PR runs the full
  Playwright suite (10 tests) and must stay 10/10.
- Chain-mismatch wording differs between `useWallet` ("Select chain X ...") and
  App/useArtistConsole ("Switch your wallet to chain X ..."). PR4 dedupes only the
  two identical App/useArtistConsole strings; `useWallet`'s distinct copy is left
  as-is to preserve its exact user-facing text.
- Scope per PR is intentionally small so each diff is reviewable and the e2e net
  stays meaningful. Do not bundle the tree-move (PR8/PR9) with logic extraction.
- PR8b (`refactor/frontend-app-shell`) is designed in `08b-providers-design.md`
  and delivered as the five stacked rows 8b-1..8b-5 above, which supersede the
  original single 8b row. Provider order, ownership table, the
  manifest-ref relocation, and acceptance criteria live in that design doc.
- 8b-1 transitional boundary: `WalletModal` reads wallet + UI-feedback state from
  context but still takes the catalog-derived support summary (backed artists,
  unlocked tracks) and `onOpenAccountDetails` as props, because catalog and
  navigation are not yet provider-owned. Those props are removed in 8b-4 (catalog)
  once `CatalogProvider` exists. Both modals self-gate on their provider state and
  are rendered unconditionally by the shell.
- 8b-2/8b-3 approach: providers own state; App still reads from context and passes
  values into the still-in-App feature hooks (`useCatalog`/`useSession`/
  `useArtistConsole`). The hook signatures stay unchanged (pure dependency
  injection); the wiring relocates into `CatalogProvider`/`SessionProvider`/
  `ArtistStudioProvider` in 8b-4/8b-5, which is what shrinks App to a shell. So
  App.tsx can tick up slightly in a step (8b-3: 832 -> 845, a 28-line context
  destructure replacing 10 `useState` lines) before dropping sharply once the
  hooks move behind providers.
- 8b-3 finding: `artistConsoleBulletinRef` was write-only (catalog wrote it via
  `setBulletinManifestRef`, nothing read it - the artist console shows its own
  separate `bulletinManifestRef` state). Relocating it into `ReleaseFormProvider`
  is therefore a pure no-op-preserving move; it stays a write sink until a reader
  is introduced.
- 8b-5 deferrals (both intentional, noted in code + `web/README.md`):
  (1) `ArtistStudioProvider` mounts in the shared stack, not inside
  `ArtistPortalView`. Mounting it there - so listener sessions skip the
  runtime/royalty work - first needs `ArtistConsole` to consume the context
  directly instead of the ~50 props App still forwards. Behavior matches today
  (the hook already ran every session).
  (2) `PlaybackProvider` exposes transport + actions in one context. The
  fast-ticking transport/actions split from the design is an optimization to make
  only if profiling shows wasteful re-renders; deferred to avoid premature
  complexity.
- Providers/context boundary (PR8b) is complete: App.tsx calls no feature hooks and
  owns no business state. It still holds three modal/wizard `useState`s
  (`createRoomOpen`, `joinRoomOpen`, `pendingArtistTrack`), a few coordinating
  handlers/effects, and the full render tree; extracting the render tree into shell
  components is the next follow-up (candidate for after PR9).
