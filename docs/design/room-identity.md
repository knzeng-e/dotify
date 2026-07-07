# Room identity - a pseudonym you set once

## Problem

Two gaps in how listeners are named in rooms:

1. A connected user retypes their pseudonym every time they create or join a
   room. Their wallet is their identity, but nothing remembers a name for it.
2. Guests arriving by share link or QR are auto-joined with the placeholder
   "Listener" and get no chance to pick a decent name.

## Direction (off-chain first)

Dotify treats the EVM address as the canonical product identity. The chosen
direction is off-chain: a display name is picked once per wallet and remembered
locally, with no gas, no permanence, and no friction. This matches the product's
"invisible Web3" stance. An on-chain handle registry is possible later; the
identity module is written as the seam it would plug into.

Three layers, delivered independently:

### Layer 1 - wallet-scoped display name (delivered)

`web/src/features/identity/walletIdentity.ts` (pure, unit-tested):
`sanitizeDisplayName`, `isChosenDisplayName`, and per-address
`getStoredDisplayName` / `storeDisplayName` over localStorage.

`SessionProvider` wires it:
- On wallet connect, the session display name is pre-filled from the address's
  stored name. A guest with no wallet keeps whatever they typed.
- When a connected user sets a real name (not the untouched "Listener"
  default), it is persisted back to their address for next time.

Net effect: a connected user picks their pseudonym once; it then pre-fills room
create and join everywhere, on this browser.

Boundary: localStorage is per-browser and user-editable - a convenience, not an
attestation. Room social events still carry only the display name, never the
address.

### Layer 2 - deliberate join by link/QR (next)

Route the share-link / QR arrival through the existing join modal with the
pseudonym pre-filled (from the wallet identity when connected, editable
otherwise) instead of a silent auto-join, so link/QR guests get a name step.
Deferred to its own PR because it touches the one-link effect that the room-join
Playwright e2e depends on, and that change deserves browser verification. Not a
blocking "are you sure" modal on leave: leaving a room is reversible (rejoin with
the same link), so the design system's no-confirmation-dialog rule applies.

### Layer 3 - on-chain handle registry (future, optional)

A `DotifyIdentity` contract mapping `address -> handle` (unique, revocable) for a
portable, verifiable identity across devices and apps. Real but heavier (gas per
change, permanence, uniqueness/revocation handling) and unnecessary for the
immediate UX. The Layer 1 module shape is the migration seam: swap the storage
backend, keep the callers.

## Tests

`walletIdentity.test.ts` covers sanitize, chosen-vs-default, and per-address
round-trip (case-insensitive key, default not persisted). The SessionProvider
wiring is behavioral and covered by manual QA (connect a wallet, set a name in
the create/join sheet, reconnect: the name pre-fills).
