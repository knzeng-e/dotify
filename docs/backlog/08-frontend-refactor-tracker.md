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

PRs 1-8c (#40-#49) are merged to `main`. PR 8d (#50, artist-portal shell) is
open, branched from `main`. Remaining PRs branch directly from `main`; if several
are open at once, stack and merge bottom-up.

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
| 8d | #50 | `refactor/frontend-artist-portal-shell` | Extract `views/ArtistPortalView` - the /artists shell (topbar + layout + modal slots); artist content + modals passed in as nodes | Open (review) |
| 8b | - | `refactor/frontend-app-shell` | Decompose the listener render tree + a providers/context boundary so `App.tsx` is composition-only. Large; scope carefully | Planned |
| 9 | - | `refactor/frontend-shared-tree` | Introduce `shared/` (`ui`, `config`, `errors`, `hooks`, `types`, `utils`); relocate existing `components/ui`, `config`, `utils`, `types.ts` with import updates | Planned |

## Acceptance criteria coverage (ticket 08)

- [x] Access logic has isolated tests (PR1).
- [x] Room-state logic has isolated tests (PR1).
- [x] Typed domain models introduced incrementally: AccessMode (PR1), RoomState (PR1),
      Track (PR2), PlaybackState (PR3), UploadState (PR5), ArtistRuntime access encoding (PR6).
- [~] `App.tsx` becomes an app composition shell: routing/history helpers extracted (PR8);
      full render-tree/providers decomposition still pending (PR8b).
- [x] TypeScript remains strict (each PR builds under `tsc -b`).
- [x] README documents the new frontend module structure (PR1+).
- [ ] Full `features/* + shared/* + app/*` tree in place (PR8/PR9).

## Notes / decisions

- E2E is the regression net for behavior preservation; every PR runs the full
  Playwright suite (10 tests) and must stay 10/10.
- Chain-mismatch wording differs between `useWallet` ("Select chain X ...") and
  App/useArtistConsole ("Switch your wallet to chain X ..."). PR4 dedupes only the
  two identical App/useArtistConsole strings; `useWallet`'s distinct copy is left
  as-is to preserve its exact user-facing text.
- Scope per PR is intentionally small so each diff is reviewable and the e2e net
  stays meaningful. Do not bundle the tree-move (PR8/PR9) with logic extraction.
