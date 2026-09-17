# W23 — Keep the solo player immersive and the support prompt plain

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W23** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record. Do useful authorized work through a reviewable PR; do not stop at a plan.

- Branch: `fix/player-support-clarity` created from the latest tested `origin/dev` when work starts.
- Dependencies: W04, W12.
- Release stage: Pilot polish.
- Existing issue: #178. Related: #90, #143 (W04), #156 (W12), #172/#173 support recovery.
- Product purpose: effortless shared listening, meaningful artist control, transparent value, and a coherent poetic interface. Product DevNet is a first-class target alongside ordinary web.

## Outcome

The solo player stays a listening surface, and the support prompt says plainly what happens, to whom, and when.

## Read first

- `docs/design/ux-design-audit-2026-09-17.md` (findings UX-20 to UX-23)
- `docs/backlog/implementation/evidence/W04.md` and `evidence/W12.md` (decisions that must not be reversed)
- `docs/explanation/access-control-model.md`
- `docs/explanation/royalty-settlement.md`
- `web/src/views/PlayerView.tsx`
- `web/src/components/AccessGateOverlay.tsx`
- `web/src/features/access/accessPromise.ts`
- `web/src/components/WalletModal.tsx`
- `web/src/components/TransactionModal.tsx`
- `web/src/hooks/useCatalog.ts`

## Work sequence

1. Record before captures of a free release, a protected release (disconnected and connected), and each support outcome from the classic-unlock fixtures.
2. Remove the dashboard tail of the solo player (`Listening room`/`offline`, `Current track` endpoint rows, duplicate `Browse music`) or replace it with listener-relevant content that already exists (release description, artist, support). Align widths with the player card. Offer hosting only when the current person can actually play the release.
3. Show playback status once and close the empty gap in the player column.
4. Rewrite the support prompt in listener language: what opens, the amount and asset, who receives it (the existing split data), that nothing is sent before confirmation, and a button that names the action. Evaluate whether the dialog should open automatically; prefer an explicit action on the locked player unless tests or evidence show the automatic dialog is needed.
5. Make the wallet sheet copy depend on how it was opened (paid action, artist action, generic account entry) and replace `Use EVM wallet` with a human label while keeping the technical term available in details.

## Acceptance and meaningful verification

- `classic-unlock` scenarios (happy, reject-payment, confirmation-delayed, paid-without-access), `artist-gift`, and support recovery unit tests pass.
- A payment record still never renders as playable access; nothing charges twice; `Nothing is sent until you confirm.` or an equivalent guarantee remains visible.
- Listener-facing strings contain no runtime, registry, chain or EVM vocabulary except inside on-demand details.
- Web and Product builds succeed; captures at 390 and 1440 px in the evidence file.

Run the relevant command groups in common.md. Record commands, results, actual tested commit, and untested environments.

## Scope boundary

No contract, key-delivery, payment execution, receipt state, or CASH rail change.

## Release condition

Recommended before real listener support in the W13 pilot.

## Handoff

Write `docs/backlog/implementation/evidence/W23.md` using `evidence-template.md`. Include the base SHA, implementation SHA, PR, captures, known risks, and the next sequence. Keep Project 5 as the workflow-status source. End with an implementation summary and the exact next step.
