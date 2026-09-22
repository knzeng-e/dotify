# W12 — Make artist publication and support understandable

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W12** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record. Do useful authorized work through a reviewable PR; do not stop at a plan. If this is a research sequence, its decision record and runnable feasibility checks are the deliverable.

- Branch: `feat/artist-support-experience` created from the latest tested `origin/dev` when work starts.
- Dependencies: W02, W04, W05, W10, W11.
- Release stage: Pilot.
- Existing issue: No dedicated issue assigned yet; reuse a matching open issue or create a scoped ticket when this sequence starts.
- Product purpose: effortless shared listening, meaningful artist control, transparent value, and a coherent poetic interface. Product DevNet is a first-class target alongside ordinary web.

## Outcome

Artists can publish with confidence and listeners can see what their support does.

## Read first

- `web/src/features`
- `web/src/components/TransactionModal.tsx`
- `web/src/hooks/useCatalog.ts`
- `docs/explanation/royalty-settlement.md`
- `docs/context/dotify-product-memory.md`

Paths are starting points from the reviewed dev snapshot; locate moved files and inspect current code rather than recreating old modules. Read the matching current issue and earlier dependency evidence.

## Work sequence

1. Locate existing artist onboarding/publishing and build on it. Guide one release through upload, access policy, collaborator splits, review, registration, and verified catalog visibility.
2. Before a transaction, show recipient shares, total price, actual chain asset, fees if available, and access conditions. Translate technical details into plain language, with deeper verification available on demand.
3. Make registration retries idempotent or explicitly recoverable. A successful upload without registration is not a published release; a transaction hash without confirmed access is not a completed unlock.
4. Show an honest receipt: amount, recipients, pending versus settled/claimable values, transaction link, and acquired access conditions. Ensure Product and standalone use the same domain states.
5. Design a short facilitator script to ask whether an artist understands control and a listener understands who benefited. Record real answers only after an authorized user session.

## Acceptance and meaningful verification

- Publish interrupted after upload, rejected signature, failed registration, delayed catalog index, rounding/split validation, and resumed draft.
- Support canceled/failed/confirmed/pending-claim paths on mobile and desktop.
- A newcomer can find who controls the release and where value goes without reading a blockchain tutorial.

Run the relevant command groups in common.md and add focused regression coverage for the changed risk. Record commands, results, actual tested commit, and untested environments. A checklist with no evidence does not satisfy these criteria.

## Scope boundary

No claim that a rights NFT proves copyright, fiat conversion without a source, new subscription model, or mandatory account for guests.

## Release condition

Required for the artist-and-support pilot. Contract migrations must be deployed and verified before UI advertises their new behavior.

## Handoff

Write `docs/backlog/implementation/evidence/W12.md` using `evidence-template.md`. Include the initial base SHA, implementation SHA, PR, artifacts, operational changes, known risks, and the next eligible sequences. Keep Project 5 as the workflow-status source. End with an implementation summary and the exact next step; do not start another sequence automatically.
