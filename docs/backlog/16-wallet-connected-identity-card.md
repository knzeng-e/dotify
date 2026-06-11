# 16 - Wallet connected identity card

## Sprint
Design track - Living Light experience

## Priority
P2

## Objective
Give the connected wallet a calm identity card, matching the prototype's "Your wallet" modal: address/handle, a few support stats, and a "You hold your keys" reassurance, with a clear Disconnect.

## Context
`web/src/components/WalletModal.tsx` already nails the not-connected invitation (passkey-first, "keep your music"). When connected, the app only shows `WalletStatusPill` (label + disconnect) - there is no connected identity surface. The prototype `WalletModal` connected state (`design/Dotify-design/app/screens-modals.jsx`, screenshot `wallet-connected.png`) shows an avatar/identity, balance, artists supported, tracks unlocked, and "Dotify never sees your seed."

## Required work

- Extend `WalletModal` to render a connected state when `state.status === 'connected'`:
  - Identity row: aura/orb avatar + the wallet label/address (the real `state.wallet.label` / address), handle if available.
  - Stats from real data where possible: balance (if known), artists supported and tracks unlocked (derive from unlocked tracks already tracked in `App`/`useCatalog`); if a value is unknown, omit it rather than inventing a number.
  - Trust note: "You hold your keys - Dotify never sees your seed. Payments and access proofs are signed by you, on your device."
  - Disconnect action (reuse existing `disconnect`).
- Open this modal from the connected `WalletStatusPill` click (currently `onClick` opens the wallet modal; ensure it routes to the connected view).

## Constraints

- Never display fabricated balances or counts; show only values the app actually has, else omit (information-accuracy rule).
- Do not echo or persist any secret/seed; copy must reinforce self-custody.
- Straight ASCII; hyphens only.

## Acceptance criteria

- Clicking the connected wallet pill opens an identity card with real label/address and a self-custody note.
- Disconnect works and returns to the not-connected invitation.
- No invented stats.

## Non-goals

- Transaction history UI.
- Multi-account switching beyond what `useWallet` already supports.

## Senior-engineer notes
This is reassurance, not a dashboard. Keep it small and truthful; the wallet must never feel more important than the music (brief UX risk).
