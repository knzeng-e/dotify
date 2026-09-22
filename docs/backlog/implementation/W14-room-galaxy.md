# W14 — Build an optional immersive 3D room galaxy

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W14** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record. Do useful authorized work through a reviewable PR; do not stop at a plan. If this is a research sequence, its decision record and runnable feasibility checks are the deliverable.

- Branch: `feat/room-galaxy` created from the latest tested `origin/dev` when work starts.
- Dependencies: W09, W10.
- Release stage: Experience expansion.
- Existing issue: No dedicated issue assigned yet; reuse a matching open issue or create a scoped ticket when this sequence starts.
- Product purpose: effortless shared listening, meaningful artist control, transparent value, and a coherent poetic interface. Product DevNet is a first-class target alongside ordinary web.

## Outcome

People can explore live rooms as an inviting musical universe and still enter one immediately.

## Read first

- `web/src/components/SkyOfRooms.tsx`
- `web/src/features/rooms`
- `web/src/styles`
- `web/vite.product.config.ts`
- `docs/backlog/19-constellation-design-track.md`

Paths are starting points from the reviewed dev snapshot; locate moved files and inspect current code rather than recreating old modules. Read the matching current issue and earlier dependency evidence.

## Work sequence

1. Inspect the existing room model and rendering boundary. Evaluate a minimal Three.js integration and any React wrapper against current dependency compatibility; choose the smallest maintainable option.
2. Implement stable room positions keyed by room identity, artwork worlds, readable participant counts, selection, and direct join. New arrivals must not rearrange every existing room. Use only real active-room data; synthetic load scenes must be clearly development-only.
3. Support touch, pointer, keyboard, reduced motion, and a fully equivalent list/2D mode. Preserve audio state across renderer changes, context loss, selection, and navigation. Camera movement is optional and bounded.
4. Load graphics on demand in standalone builds. Verify the Product single-file/Bulletin build behavior separately: dynamic import may be inlined. Report actual initial bytes and use a compatible packaging strategy instead of assuming code splitting survives.
5. Cluster/limit distant labels and rendering work, cap pixel ratio, adapt quality, pause background animation, and dispose GPU resources. Give small rooms fair visibility; do not use exact geography for spatial placement.

## Acceptance and meaningful verification

- Real room lifecycle plus labeled stress fixtures; selection/join correctness after rooms appear/disappear.
- Context loss, unsupported graphics, reduced motion, low-memory mobile, and renderer switch leave audio and list discovery usable.
- Proposed targets: 60fps on the named desktop profile and >=30fps on the named midrange mobile profile, with sound-start regression measured against W08. Report achieved results.

Run the relevant command groups in common.md and add focused regression coverage for the changed risk. Record commands, results, actual tested commit, and untested environments. A checklist with no evidence does not satisfy these criteria.

## Scope boundary

No autoplaying many room previews, VR headset requirement, 3D-only navigation, fake live stars, or new signaling protocol.

## Release condition

Prototype may begin after W09/W10 while launch work continues. Enable broadly only after supported-device performance evidence; feature-off rollback must preserve rooms.

## Handoff

Write `docs/backlog/implementation/evidence/W14.md` using `evidence-template.md`. Include the initial base SHA, implementation SHA, PR, artifacts, operational changes, known risks, and the next eligible sequences. Keep Project 5 as the workflow-status source. End with an implementation summary and the exact next step; do not start another sequence automatically.
