# 23 - Room identity: a pseudonym set once per wallet

## Sprint

Design track - social presence / onboarding.

## Priority

P2

## Objective

Let a listener or host pick a room pseudonym once and never retype it, and give
link/QR guests a name step instead of a silent "Listener". Off-chain first
(no gas, no friction); on-chain handle registry is future work. Full design in
`docs/design/room-identity.md`.

## Context

The EVM address is Dotify's canonical product identity, but nothing remembered a
display name for it: connected users retyped their pseudonym on every room
create/join, and share-link / QR guests were auto-joined as "Listener" with no
chance to choose. Both are onboarding-friction gaps that the "invisible Web3"
posture argues against.

## Delivered (Layer 1)

- `web/src/features/identity/walletIdentity.ts` (pure, unit-tested):
  `sanitizeDisplayName`, `isChosenDisplayName`, per-address
  `getStoredDisplayName` / `storeDisplayName` over localStorage.
- `SessionProvider` pre-fills the session display name from the connected
  wallet's stored name on connect, and persists a chosen name (not the untouched
  default) back to the address. The name then pre-fills room create/join.

## Constraints

- Off-chain and local: a convenience, not an attestation. Room social events
  still carry only the display name, never the address.
- Do not persist the untouched "Listener" default as a chosen name.
- Straight ASCII in source (control-char regex built via `new RegExp` with
  escaped backslashes so no literal control bytes land in the file).

## Acceptance criteria

- A connected user who sets a name once sees it pre-filled on the next room
  create/join, after reconnecting. (Pure round-trip covered by tests; wiring by
  manual QA.)
- The default "Listener" is never stored as a chosen name.
- `lint`, `build`, `test:unit`, `fmt:check` stay green.

## Non-goals / future

- Layer 2: route link/QR arrivals through the join modal with the pseudonym
  pre-filled (own PR - touches the one-link effect the room-join e2e depends on).
- No blocking "are you sure" leave confirmation (leaving is reversible; the
  design system's no-confirmation-dialog rule applies).
- Layer 3: on-chain `DotifyIdentity` handle registry (`address -> handle`).
