# W01 — Make dev a tested integration branch

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W01** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record. Do useful authorized work through a reviewable PR; do not stop at a plan. If this is a research sequence, its decision record and runnable feasibility checks are the deliverable.

- Branch: `chore/dev-quality-gates` created from the latest tested `origin/dev` when work starts.
- Dependencies: playbook available on dev; no feature dependencies.
- Release stage: Pilot.
- Existing issue: #132.
- Product purpose: effortless shared listening, meaningful artist control, transparent value, and a coherent poetic interface. Product DevNet is a first-class target alongside ordinary web.

## Outcome

Every relevant PR into dev produces meaningful checks before the next sequence starts.

## Read first

- `.github/workflows`
- `web/package.json`
- `services/api/package.json`
- `contracts/evm/package.json`
- `web/playwright.config.ts`
- `scripts/backlog-sync.mjs`

Paths are starting points from the reviewed dev snapshot; locate moved files and inspect current code rather than recreating old modules. Read the matching current issue and earlier dependency evidence.

## Work sequence

1. Inspect existing workflows and their triggers before editing. Add dev pull-request/push coverage without dropping existing main coverage. Use the repository Node 22 baseline and locked dependency installation.
2. Run frontend unit tests/build, API tests/typecheck, signaling tests, and contract tests in appropriate jobs. Inspect the generated ABI check and preserve it. Use least-privilege workflow permissions and ensure fork PRs never require secrets.
3. Include deterministic core Playwright flows using local services and fixtures. Keep live Product host, real-wallet, and device evidence in an explicit release gate; mocked Playwright transactions do not prove settlement.
4. Make required check names stable. Document suggested branch protection, but do not change repository administration or enable auto-merge. Classify baseline failures rather than hiding them with continue-on-error.

## Acceptance and meaningful verification

- Validate workflow syntax and execute the changed job commands locally where supported.
- Demonstrate a failing assertion would fail its job, without committing intentionally broken tests.
- Check path filters do not strand a required check on documentation-only PRs.

Run the relevant command groups in common.md and add focused regression coverage for the changed risk. Record commands, results, actual tested commit, and untested environments. A checklist with no evidence does not satisfy these criteria.

## Scope boundary

No dependency-major migration, application refactor, deployment workflow execution, or invented branch-protection evidence.

## Release condition

Merge the gates before feature implementation. Record remote CI evidence when a run exists; local success is not a remote CI result.

## Handoff

Write `docs/backlog/implementation/evidence/W01.md` using `evidence-template.md`. Include the initial base SHA, implementation SHA, PR, artifacts, operational changes, known risks, and the next eligible sequences. Keep Project 5 as the workflow-status source. End with an implementation summary and the exact next step; do not start another sequence automatically.
