# W06 — Make returning accounts and wallet-later UX safe

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W06** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record. Do useful authorized work through a reviewable PR; do not stop at a plan. If this is a research sequence, its decision record and runnable feasibility checks are the deliverable.

- Branch: `feat/returning-identity` created from the latest tested `origin/dev` when work starts.
- Dependencies: W01.
- Release stage: Pilot.
- Existing issue: #90 (reconcile current state; do not close an epic for a partial slice)
- Product purpose: effortless shared listening, meaningful artist control, transparent value, and a coherent poetic interface. Product DevNet is a first-class target alongside ordinary web.

## Outcome

Listening starts without account bureaucracy; returning users do not accidentally create a different identity.

## Read first

- `web/src/hooks/useWallet.ts`
- `web/src/app/providers/WalletProvider.tsx`
- `web/src/features/wallet`
- `web/src/features/identity`
- `web/src/components/AccountWalletModal.tsx`
- `docs/backlog/polkadot-product-readiness-and-killer-dapp-roadmap.md`

Paths are starting points from the reviewed dev snapshot; locate moved files and inspect current code rather than recreating old modules. Read the matching current issue and earlier dependency evidence.

## Work sequence

1. Inspect WebAuthn PRF capability detection and enrollment versus authentication paths. Generic WebAuthn availability is not proof that PRF is supported or returned.
2. Handle missing local credential IDs with a discoverable returning-credential path where supported. Require an explicit new-account choice instead of silently replacing identity. Explain unsupported authenticators and preserve an explicit supported wallet path.
3. Document and test RP/origin binding across standalone, .dot gateway, and Product hosts. Do not imply a passkey-derived EVM key migrates between unrelated domains. Prefer host-owned identity inside Product without accessing its private key.
4. Make account creation/connection contextual to an action requiring it. Label local credential removal accurately; add recovery/setup guidance without inventing recoverability. Do not store raw private keys in persistent browser storage.

## Acceptance and meaningful verification

- Returning account after localStorage loss, unsupported PRF, canceled prompt, registration without immediate PRF output, and account mismatch.
- Origin migration and device change are either demonstrated or explicitly unsupported.
- A fresh guest joins and hears a host with no wallet/passkey prompt.

Run the relevant command groups in common.md and add focused regression coverage for the changed risk. Record commands, results, actual tested commit, and untested environments. A checklist with no evidence does not satisfy these criteria.

## Scope boundary

No custom cryptographic recovery protocol, hidden seed export, or forced guest identity.

## Release condition

If recovery cannot be proven on target authenticators, keep the risky enrollment path off for the pilot and ship an explicit supported account path.

## Handoff

Write `docs/backlog/implementation/evidence/W06.md` using `evidence-template.md`. Include the initial base SHA, implementation SHA, PR, artifacts, operational changes, known risks, and the next eligible sequences. Keep Project 5 as the workflow-status source. End with an implementation summary and the exact next step; do not start another sequence automatically.
