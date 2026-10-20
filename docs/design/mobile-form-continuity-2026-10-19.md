# Mobile form continuity and calm controls

Design and form audit, 2026-10-19. Scope: the owner-reported room-name keyboard
regression after Product 0.1.55 and a restrained refinement of existing controls.
See the [backlog scope](../backlog/mobile-form-continuity.md) and the
[validation record](../backlog/implementation/evidence/mobile-form-continuity-2026-10-19.md).
This note describes the implementation contract, not a deployment or native-device
acceptance claim.

## Keep the writing visible

Naming a room is part of welcoming people. The person writing should see their
words, understand the field, and reach the next action without fighting the
keyboard. Opening a sheet first shows its context; room creation no longer
immediately focuses a text field and opens the keyboard.

The original shared dialog used fixed viewport placement and `vh` height limits.
A software keyboard can reduce the visible screen without reducing the layout
viewport. `VisualViewport` exposes the visible dimensions, offsets and zoom, so
the overlay can follow what is actually available. This follows the browser
model described by [MDN's VisualViewport reference](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport).

Short contextual actions remain sheets on mobile and dialogs on larger screens.
Artist publishing remains a page-based workflow. This adapts the distinction
between a focused task and a prolonged flow in
[Apple's sheets guidance](https://developer.apple.com/design/human-interface-guidelines/sheets).
The goal of keeping fields and relevant actions above the keyboard also follows
[Apple's virtual-keyboard guidance](https://developer.apple.com/design/human-interface-guidelines/virtual-keyboards).
These are design references; Dotify remains a web interface with its own Night
Console identity and does not claim native UIKit sheet behavior.

## Shared geometry, explicit ownership

[`FormViewport`](../../web/src/app/FormViewport.tsx), mounted once beside the
application providers, publishes valid visible-screen measurements as CSS
properties. [`form-viewport.css`](../../web/src/styles/form-viewport.css) uses them
to bound every shared dialog. It also provides document forms with room below
the keyboard and keeps fixed navigation out of the way during inline editing.

On focus or viewport changes, the controller reveals only the necessary portion
of the focused field and its nearby label. It scrolls the nearest eligible
container first and stops at the dialog boundary. It does not scroll the
listening page behind a sheet, recreate a form, or reset its draft. Fields are
revealed even when keyboard detection is inconclusive; geometry owns visibility,
while the keyboard heuristic controls supplementary layout changes.

The existing [`useRoomViewport`](../../web/src/features/rooms/useRoomViewport.ts)
retains ownership of chat composition and in-room track search. Both controllers
use the same [`roomComposerSelector`](../../web/src/features/rooms/roomViewport.ts)
to avoid competing over those fields. Other fields do not inherit that exemption
merely because they appear inside a room shell.

Transient zero or invalid native measurements preserve the last valid geometry.
The initial reference is learned only from valid measurements. Zoom is normalized
when estimating keyboard occlusion. Focus changes get bounded follow-up reads to
cover delayed keyboard animation measurements, rather than continuous polling.
While an action is pressed, geometry waits until release so blur cannot move the
target away from the finger before the click.

## Form inventory

All genuine modal surfaces in the audited application use
[`Dialog`](../../web/src/components/Dialog.tsx). No separate editable modal
implementation was found that needed its own viewport controller.

| Surface | Relevant entry points | Ownership |
| --- | --- | --- |
| Room creation and identity | `CreateRoomModal`, `RoomProfileFields`, `NearbyControls` | Shared dialog geometry and field reveal for nickname, room name and invitation |
| Joining and artist visits | `JoinRoomModal`, `RoomsView`, `ArtistLiveRooms` | Shared geometry for nickname and explicit code/link entry |
| Tips and gifts | `ArtistDonationButton` | Shared geometry for amount and receipt-block recovery inputs; submission state is unchanged |
| Release editing | `ReleaseMetadataEditor` | Shared geometry for title, story, credits and editorial fields |
| Other sheets | Wallet/account, access, transaction, sharing, release details, queue and radar dialogs | The same bounds, focus contract and dismissal behavior, including surfaces without text entry |
| Catalog and release search | `CatalogBrowser`, artist `ReleasesTab` | Document-form reveal |
| Artist identity | `ArtistOnboarding`, `OverviewTab` | Document-form reveal for onboarding and profile inputs |
| Artist publishing and rights | `NewReleaseTab`, `ReleasesTab`, `ContributionPolicyEditor` | Document-form reveal across metadata, access, recipient and campaign fields |
| Artist room invitations | `ArtistLiveRooms` | Document-form reveal for the invitation field; shared dialog geometry for the visit |
| Room chat and track requests | `RoomChat`, `RoomTrackSearch`, host lineup | Existing room-composer layout, with shared selector ownership |
| Diagnostic forms | `FirstSoundEvidencePanel`, `ProductRoomSmokeEvidencePanel`, `ProductCdmHostSmokeEvidencePanel`, `CelerityCapturePanel` | Shared document behavior for editable text inputs; read-only exports and native pickers retain their own semantics |

Range sliders, toggles, file selection and native select/date controls are not
treated as text-keyboard composition. Existing input types, numeric/decimal input
modes and form submission rules remain intact.

## A quieter control language

Shared fields have a clear inset surface, a visible caret, readable placeholders
and an explicit focus ring. Invalid states remain distinguishable. Secondary
actions change tone gently instead of flashing into a competing primary action;
touch presses provide a small bounded response. Close controls have consistent
size and contrast, and room-name disclosures separate optional details from the
main action.

Sheets use a short entrance transition and a restrained surface highlight.
Changing keyboard height does not replay that entrance. Reduced motion removes
the entrance and press transforms. Text enlargement remains available, and mobile
text controls have a 16 px minimum without disabling browser zoom. No decorative
grabber or swipe affordance implies a gesture that the application does not
implement.

## Focus, validation and native boundaries

`Dialog` keeps its existing focus trap, background `inert` state, Escape behavior
and optional history dismissal. Its initial focus frame now respects a control
the person has already focused. Closing restores focus with `preventScroll` so
the parent page keeps its place. Scroll correction is immediate and minimal;
smooth page scrolling must not compete with keyboard positioning.

This slice changes presentation and focus management. It does not alter room
visibility consent, location permissions, access checks, contribution submission,
audio lifetime or signaling protocols. Test outcomes and exact build evidence
belong in the linked validation record, not in this design note.

Physical iOS, Android and installed Product keyboard behavior remains unverified
for this change. Acceptance must exercise typing, multiline input, dismissal,
rotation, text enlargement and the first action after editing on actual devices.
Browser viewport simulations cannot establish native keyboard or Host behavior.

An embedded Host is an additional boundary: iframe visual-viewport dimensions can
describe the frame's layout rather than the top-level visible screen, as noted in
the [MDN reference](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport).
If a Host covers an unchanged iframe with its native keyboard, the child cannot
infer that occlusion from its own viewport alone. Host resizing or an explicit
viewport bridge would then be needed. This is a compatibility condition to verify,
not a claim that the current Product Host has that failure or that such a bridge
has been implemented.
