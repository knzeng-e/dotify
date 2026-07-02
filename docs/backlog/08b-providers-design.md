# Ticket 08 - PR8b design: providers/context boundary

Design annex for the `refactor/frontend-app-shell` step of
`08-frontend-feature-module-refactor.md`. The tracker
(`08-frontend-refactor-tracker.md`) flagged PR8b as "Large; scope carefully";
this document is that scoping. PR8b is delivered as five small stacked PRs
(8b-1 through 8b-5), each independently green and mergeable.

## Goal

Make `App.tsx` composition-only by moving its 28 `useState` calls and five
mega-hook invocations behind a provider stack, eliminating the two worst
prop-drilling chains (`ArtistConsole` at 50+ props, `PlayerView` at 30+) and
the `artistConsoleBulletinRef` circular-dependency hack (`App.tsx:161-163`).

Behavior-preserving: every step keeps `test:unit`, `lint`, `build`,
`fmt:check`, and the full Playwright suite green, per the tracker method.

## Design principles

1. Providers wrap the existing hooks, they do not rewrite them. Each provider
   calls one existing hook (`useWallet`, `useCatalog`, ...) exactly once and
   publishes its value. Hook internals stay untouched in PR8b; slimming
   `useCatalog` (879 lines) into its `features/*` seams is a later step.
2. Provider order mirrors the existing hook dependency order already visible
   in `App.tsx:98-248`: ui feedback, then wallet, then release form, then
   catalog, then session, then artist studio, then playback.
3. Fail closed: every `useXxxContext()` accessor throws if called outside its
   provider, matching the project access posture. No default context values
   that silently mask a missing provider.
4. Split by change frequency, not by domain purity. The one place this matters
   is playback transport, which ticks on every `timeupdate`; it gets its own
   context so the rest of the tree does not re-render several times a second.

## Provider stack

```
web/src/app/providers/
  UiFeedbackProvider.tsx      AppProviders.tsx (composes the stack, in order)
  WalletProvider.tsx          index.ts (accessor re-exports)
  NavigationProvider.tsx
  ReleaseFormProvider.tsx
  CatalogProvider.tsx
  SessionProvider.tsx
  ArtistStudioProvider.tsx
  PlaybackProvider.tsx
```

| Provider | Owns (moved from App.tsx) | Consumes | Prop drilling it kills |
| --- | --- | --- | --- |
| `UiFeedbackProvider` | `transactionFeedback`, `showWalletModal`, the Escape-key effect (`App.tsx:302-309`) | nothing | `setTransactionFeedback` / `setShowWalletModal` injected into 3 hooks and ~6 components |
| `WalletProvider` | `useWallet()`, `ethRpcUrl`, `expectedChainId`, `isSwitchingNetwork`, `bulletinAccountIndex`, derived identities (`connectedWallet`, `activeEvmAddress`, `listenerEvmAddress`, substrate address/signer with the dev-fallback guard from `App.tsx:114-119`), `getActiveWalletClient` | UiFeedback | wallet pill props in TopBar, WalletModal's props |
| `NavigationProvider` | `activeView`, `isArtistPortal`, `publicArtistName`, `railCollapsed`, `navigateToView`, `handleOpenArtistStudio`, popstate effect | nothing | `navigateToView` threaded into `useCatalog` and `useSession` |
| `ReleaseFormProvider` | `title`, `description`, `artistName`, `priceDot`, `royaltyBps`, `accessMode`, `personhoodLevel`, `coverFile`, `uploadToBulletinEnabled`, `assetAction`, `artistTab`, `releaseStep`, plus `bulletinManifestRef` (relocated here, see below) | nothing | the 8 setters currently injected into `useCatalog` (`App.tsx:171-183`) and ~15 of ArtistConsole's props |
| `CatalogProvider` | `useCatalog()` call | Wallet, UiFeedback, Navigation, ReleaseForm | catalog/access/track props on ListenView, YouView, ArtistProfileView |
| `SessionProvider` | `useSession()` call, `createRoomOpen`, `joinRoomOpen`, `pendingArtistTrack` | Catalog, Navigation | room props on RoomsView, PlayerView, both room modals |
| `ArtistStudioProvider` | `useArtistConsole()` call, royalty derivations (`totalRoyaltyWei` etc., `App.tsx:257-259`) | Wallet, Catalog, ReleaseForm, UiFeedback | the ArtistConsole 50-prop interface drops to roughly 5 |
| `PlaybackProvider` | `usePlayback()` call, split into two contexts: `PlaybackActionsContext` (stable methods, flags) and `PlaybackTransportContext` (currentTime/duration) | Catalog, Session | PersistentAudio and PlayerDock props |

### The circular-dependency fix

Today `useCatalog` writes a Bulletin manifest ref into state that
`useArtistConsole` owns, forced through a mutable ref in App
(`artistConsoleBulletinRef`). The ownership is inverted: the manifest ref
belongs to the release draft, so it moves into `ReleaseFormProvider`, which
sits above both consumers. `setBulletinManifestRef` and
`artistConsoleBulletinRef` are deleted. This is the one intentional structural
change in PR8b, and it is still behavior-preserving (same value, same
lifetime, cleaner owner).

### Mounting

`AppProviders` wraps the app in `main.tsx`. `ArtistStudioProvider` is the
exception: it mounts inside `ArtistPortalView` only, so listener sessions
never pay for artist-console effects (runtime resolution, royalty polling).
Relocating the manifest ref out of `useArtistConsole` is what makes this
possible.

### Render performance rules

- Every provider value is `useMemo`-ed; actions are wrapped in `useCallback`
  inside the providers so consumer memoization works.
- Only `PlayerDock`, `PlayerView`, and `PersistentAudio` may subscribe to
  `PlaybackTransportContext`.
- No other state/actions split up front; add one only if profiling shows
  churn.

### Dependency rules

- Providers depend on hooks; hooks and views depend on `features/*`, never the
  reverse (unchanged tracker rule).
- Components consume providers only through their `useXxx()` accessors; no
  component imports another provider's internals.

## Staged PR plan

Each step is independently mergeable, branched from `main`, stacked bottom-up
if several are open at once.

| Step | Branch | Scope | Approx diff |
| --- | --- | --- | --- |
| 8b-1 | `refactor/frontend-providers-foundation` | `AppProviders` scaffold + `UiFeedbackProvider` + `WalletProvider`; TopBar, WalletModal, TransactionModal consume contexts | small |
| 8b-2 | `refactor/frontend-providers-navigation` | `NavigationProvider`; popstate/history effects move out of `App.tsx` | small |
| 8b-3 | `refactor/frontend-providers-release-form` | `ReleaseFormProvider` including the manifest-ref relocation; delete the ref hack and the 8-setter injection into `useCatalog` (hook signature updated, internals untouched) | medium |
| 8b-4 | `refactor/frontend-providers-catalog-session` | `CatalogProvider` + `SessionProvider`; ListenView, RoomsView, YouView, room modals consume contexts | medium-large |
| 8b-5 | `refactor/frontend-providers-studio-playback` | `ArtistStudioProvider` (mounted in `ArtistPortalView`) + `PlaybackProvider` with the transport split; ArtistConsole and PlayerView shed their prop interfaces; `App.tsx` lands as a composition shell (target under 200 lines) | medium |

## Non-goals for PR8b

- No state-management library (context over the existing hooks is sufficient
  at this component count).
- No hook rewrites or renames.
- No `shared/` tree move (that is PR9).
- No visual or copy changes, no new features.

## Testing

- One small unit test per provider asserting the fail-closed accessor throws
  outside its provider.
- The Playwright suite remains the behavior-preservation net and must stay
  fully green at every step.

## Acceptance criteria

- `App.tsx` contains only provider composition, shell layout, and view
  switching.
- Zero components with more than ~10 props; `ArtistConsole` and `PlayerView`
  read from context.
- `artistConsoleBulletinRef` hack removed.
- Artist-console effects do not run in listener-only sessions.
- All checks green at every step; tracker and `web/README.md` updated per PR.
