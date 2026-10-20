# Mobile form continuity and calm interaction polish

Owner feedback after Product 0.1.55, 2026-10-19. Follow-up to completed W28
(#223), with room identity introduced by #304.

## Outcome

Writing a room name must remain visible above the software keyboard. Apply that
same contract to every shared dialog and document form, including artist release
editing and support, while retaining the room's existing composer behavior.
Refine the current Night Console controls and sheets with clear hierarchy,
readable fields and restrained touch feedback.

## Scope and boundaries

- A shared visible-viewport observer bounds dialogs and minimally reveals the
  focused field in its scroll container. Preserve drafts and parent-page scroll.
- Cover valid and transient-empty geometry, viewport panning, zoom, resizing and
  keyboard dismissal. Keep focus trapping, Escape/Back and focus restoration.
- Opening room creation shows its context before the user chooses to type.
- Keep inputs readable, secondary actions quiet and primary actions distinct.
  Respect reduced motion and text enlargement; do not add nonfunctional handles.
- Audit all form entry points; do not change access, support submission,
  playback, location permissions or server protocols. No new UI dependency.

## Acceptance

- Focused room name/invitation, join nickname, support amount and artist form
  controls fit above a simulated keyboard in Chromium and WebKit.
- A tap after editing performs its intended action once, drafts survive geometry
  changes, and closing a sheet restores focus without scrolling the page.
- Existing room-composer keyboard/rotation tests continue to pass.
- Mobile widths, desktop, text enlargement and reduced motion have visual and
  functional evidence. Unit checks, lint and builds pass.
- Physical iOS/Android/Product keyboard behavior is recorded separately from
  browser simulations; absence of native keyboard evidence is not a claimed pass.

## Delivery

Implemented by #307, merged into `dev` at `b08966698709b06378349a6ffd0567cda5dc8f53`,
and published as Product 0.1.56 with #308. The owner confirmed expected mobile
keyboard behavior on 2026-10-20. The implementation scope is complete; the full
native-device acceptance matrix remains separate under W13. See the
[implementation evidence](implementation/evidence/mobile-form-continuity-2026-10-19.md)
and [rollout record](implementation/evidence/product-0.1.56-rollout-2026-10-19.md).

Original delivery instruction:

Create from tested dev `893418de06b9eda8379a350b3bca8912a8ebb4b8`, implement one
reviewable PR and retain a dated evidence record. Deployment and physical-device
acceptance follow review. Broader speculative navigation redesign stays separate
from the usability regression and shared control polish.
