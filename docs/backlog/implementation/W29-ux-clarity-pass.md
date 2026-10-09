# W29 - UX clarity pass, protected playback resilience, room exit and sign-in flow

Delivery record for the owner-requested slice that followed the 2026-10-08
UX/UI audit of the running app. Project 5 owns workflow status; evidence is in
[`evidence/W29.md`](evidence/W29.md).

- Branch: `design/ux-clarity-pass`, created from `dev`.
- Issue: #250. Pull request: #249.
- Dependencies: W21, W22, W23, W24, W25, W28.
- Release stage: Pilot polish. It does not replace any W13 evidence gate.
- Product purpose: a listener who has never used a wallet should understand
  `create a room -> share a link -> listen together` from the interface alone.

## Outcome

1. **One word per gesture.** Join (not Enter or Inspect), Open a room, Unlock,
   Review tip / Review gift, Artist studio. The room discovery toggle reads
   Galaxy / Map.
2. **Room first.** Home states the promise, keeps one Open a room action, and
   places live rooms above the catalog when people are listening. The host's
   share control is a labeled Invite button. Room track picks carry titles.
3. **Payment as trust.** The unlock dialog names who receives the payment and
   moves accounts under the disclosure. A split paid to the artist's own
   account folds into one named artist row. Release details show the same
   complete split.
4. **Protected playback that explains itself.** When access is granted but no
   sound starts, the player names the cause (declined signature, service out
   of reach, access not yet confirmed server-side, slow audio, missing account)
   and offers a retry in place. Transient causes retry quietly twice first.
5. **Leaving is one tap.** Leave / Close room sits in the room header. A host
   with guests confirms; a host alone closes immediately. The People tab is a
   group icon with the live count, and the header presence opens the same list.
6. **Sign-in at the right moment.** When someone connects in order to unlock,
   support or publish, the one Dotify sign-in signature follows the connection.
   A plain connection still waits until something needs the session.
7. **Visual system.** Dialog titles use the interface face; editorial type is
   kept for page, artist and release titles and the room threshold. Page
   titles share one scale, redundant eyebrows are removed, and off-scale font
   sizes snap to the type tokens.
8. **Artist studio.** Plainer onboarding, no idle status pill, the Rights tab
   renamed Rights & support, a compact release stepper.

## Decisions that changed an earlier record

- **Catalog cards show a short access cue again** (price, Free, Unlocked).
  W21 / #195 and W28 kept cards to cover, title and artist with access details
  on demand. The owner reversed that on 2026-10-09; the three specs that
  forbade a visible price now assert it.
- **Dialog titles moved from `--text-display-sm` editorial to `--text-title`
  interface.** `docs/design/visual-system-contract.md` is updated to match.

## Boundaries kept

- A content key is released only after server-side authorization. Every
  playback retry repeats that check; retries never widen access.
- Room guests join from a link without wallet, signature or payment, and
  receive only the host's stream.
- A chosen room name stays required (ticket 23); it is not pre-filled.
- The disabled tip control stays visible while attribution is unavailable, as
  the existing room-tip recovery coverage requires.

## Not in this slice

- Consolidating the stylesheet layers under `web/src/styles/`.
- Visible labels on secondary player controls.
- An always-visible people list on large screens.
- An explanation for the disabled play control before audio is ready.
- A review of Human free as the default shown in the release preview.
