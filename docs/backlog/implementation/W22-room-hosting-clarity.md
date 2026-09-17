# W22 — Make hosting and joining a room unmistakable

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W22** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record. Do useful authorized work through a reviewable PR; do not stop at a plan.

- Branch: `fix/room-hosting-clarity` created from the latest tested `origin/dev` when work starts.
- Dependencies: W09, W10.
- Release stage: Pilot polish.
- Existing issue: #177. Related: #151, #160 (galaxy complement only), #90, premium review PR 3 recommendation.
- Product purpose: effortless shared listening, meaningful artist control, transparent value, and a coherent poetic interface. Product DevNet is a first-class target alongside ordinary web.

## Outcome

Hosting, inviting and joining a room read unmistakably, and guests see only what they can use.

## Read first

- `docs/design/ux-design-audit-2026-09-17.md` (findings UX-10 to UX-15)
- `docs/design/premium-experience-review-2026-09-15.md` (PR 3 and the #167 guest-mode decision)
- `docs/design/room-identity.md`
- `web/src/features/identity/walletIdentity.ts`
- `web/src/hooks/useSession.ts`
- `web/src/components/CreateRoomModal.tsx`
- `web/src/components/JoinRoomModal.tsx`
- `web/src/views/PlayerView.tsx` (room layout)
- `web/src/components/PlayerTransport.tsx`
- `web/src/components/HostLineup.tsx`
- `web/src/components/RoomChat.tsx`
- `web/src/views/RoomsView.tsx`
- `web/src/components/RoomDiscoveryRenderer.tsx`

## Work sequence

1. Run a two-context journey (host 1440 / guest 390, then reversed) on local signaling and record before captures.
2. Stop rendering a role as a person's name. A host without a chosen name either names themselves in the create sheet or is shown with neutral copy (for example `A listening room welcomes you`). Keep the #170 behavior where a Product username or saved alias seeds the field.
3. In the host room, show the room code once, the hosting state once, and a clean cover frame. While the host is alone, make inviting dominant: copy link, QR, and native share where available. Replace `Host plan · Preview` with plain words or hide it until it is useful.
4. For guests, keep only meaningful controls (volume/mute and any existing local listening control) plus a plain host state; do not show inert shuffle/skip/repeat. Do not fake host modes (#167). Align the person's own chat messages distinctly.
5. On Rooms, keep one clear primary path per state: join with a code or link, or open a room. Remove manual Refresh from a live view unless the socket is degraded; hide renderer toggle and refresh in the empty state; replace metric blocks with calm text or remove them; avoid a truncated monospace placeholder. For the optional galaxy, hide map controls when there are too few rooms to navigate and size the instruction as body text.
6. In the join sheet, use the room-availability color already chosen for live rooms and put initial focus on the name field (without forcing the keyboard open on touch if that hurts the threshold preview).

## Acceptance and meaningful verification

- Two-context journeys at 390 and 1440 px: no role-as-name, one room code, invite dominant while alone, guest controls limited to meaningful ones.
- Loading, empty, offline, full and reconnecting states remain distinct and truthful.
- `room-join`, `room-arrival`, `adaptive-rooms`, `room-workspace`, `room-continuity` e2e specs and `npm --prefix web run test:signal` pass.
- Guests still join without wallet, signature or payment; no signaling protocol change.
- Captures before/after in the evidence file.

Run the relevant command groups in common.md. Record commands, results, actual tested commit, and untested environments.

## Scope boundary

No signaling protocol change, fabricated presence, new room permissions, 3D default, or Statement Store work.

## Release condition

Recommended before the consented pilot room sessions in W13.

## Handoff

Write `docs/backlog/implementation/evidence/W22.md` using `evidence-template.md`. Include the base SHA, implementation SHA, PR, captures, known risks, and the next sequence. Keep Project 5 as the workflow-status source. End with an implementation summary and the exact next step.
