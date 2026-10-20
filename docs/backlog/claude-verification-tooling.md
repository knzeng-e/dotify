# Claude verification tooling

Issue: #265. Implementation: PR #264.

## Delivery record

PR #264 was merged into `dev` on 2026-10-11 at
`e86406d0cb0282b8e67be3a5f7897b87fe13e032`. All executed PR CI checks passed,
including Web, API, contracts/ABI drift, signaling, Product DevNet build,
repository hygiene, and Playwright core flows. The local tooling scope is
complete; #265 and the merged PR are recorded as Done in Project 5. The
post-merge `dev` workflow is a separate validation run.

## Outcome

Make local Claude Code feedback reflect the checks that actually ran. The
frontend has no `typecheck` npm script; its TypeScript project build is
`tsc -b`. The previous hook and `/verify` instructions invoked a nonexistent
command and reported misleading frontend errors.

## Scope

- Run `npx --no-install tsc -b` for `web/src/` TypeScript edits and retain
  `npm run typecheck --silent` for `services/api/src/` edits.
- Report other TypeScript files in those workspaces as outside the tsconfig
  include, rather than claiming a successful check of build/deploy/test configs.
- Bound the advisory hook at 120 seconds and report timeouts without a traceback.
- Align `/verify` with the touched-workspace checks in `CLAUDE.md`, including
  frontend unit/lint/build, API typecheck/tests/build, contracts compile/tests,
  formatting, and `git diff HEAD --check` for staged and unstaged changes.

This task changes local development tooling only. The hook remains advisory;
release CI and deployment acceptance retain their own checks.

## Acceptance

- Source edits select the correct command and working directory.
- Compiler errors are visible; excluded config files are labelled unverified;
  unrelated files are skipped.
- Timeout handling neither claims success nor raises an uncaught traceback.
- Verification instructions distinguish checks that passed from checks not run.
- The issue and PR share Project 5 fields, labels, ownership, and this scope doc.
- The reviewed implementation is merged into `dev`; close #265 and set its
  Project item to Done in the merge handoff because `dev` is not the default
  branch.

## Validation evidence

The review of `611787a1ac821c5cb8b8613bf5a45731645b893e` verified Python syntax
and 12 isolated hook scenarios: workspace routing, excluded configs, unrelated
files, compiler failure, timeout, and smart-quote warnings. Actual hook
execution passed both Web and API typechecks using installed local dependencies.
The PR diff passed whitespace checks, and both automated review findings were
independently verified and resolved.

Application and contract suites were not run for the tooling-only patch, and
no GitHub CI result was claimed in that review. The synchronous frontend check
costs about 12–17 seconds locally; explicit `/verify` is a future alternative
if that per-edit cost becomes disruptive.
