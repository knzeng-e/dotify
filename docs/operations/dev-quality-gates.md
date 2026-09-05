# Dev Quality Gates

Dotify uses the `Dev Quality Gates` workflow to make `dev` a tested integration
branch before each implementation sequence starts.

## Workflow behavior

The workflow runs on:

- every pull request targeting `dev`;
- every push to `dev`;
- manual `workflow_dispatch` runs.

It does not use repository secrets and should remain safe for fork pull
requests. Live Product host, real-wallet, device, deployment, and fund-moving
checks stay outside this workflow as explicit release evidence.

## Stable required checks

Suggested branch protection for `dev` should require these check names:

- `W01 / Workflow syntax`
- `W01 / Repository hygiene`
- `W01 / Web checks`
- `W01 / Signaling tests`
- `W01 / API tests and typecheck`
- `W01 / EVM contracts and ABI drift`
- `W01 / Product DevNet build`
- `W01 / Playwright core flows`

Do not require the legacy path-filtered `main` / `master` workflows for `dev`
branch protection. A path-filtered workflow can be skipped on documentation-only
changes and leave a required check pending. The W01 workflow intentionally has
no path filters so documentation-only PRs still produce the same required check
set.

## Coverage

- Repository hygiene validates backlog metadata offline and whitespace.
- Workflow syntax runs pinned `actionlint` over all GitHub Actions workflow
  files. This validates Actions-specific keys and expressions, not only generic
  YAML syntax.
- Web checks run formatting, lint, unit tests, production-env smoke, and the
  ordinary Vite build.
- Signaling checks run the Socket.IO signaling test suite.
- API checks run typecheck and the Fastify service test suite.
- EVM checks run Solidity formatting, compile, tests, ABI generation, and a
  generated-binding drift guard that fails on tracked or untracked output
  changes under `web/src/generated/contracts`.
- Product DevNet checks regenerate the bootstrap catalog in strict mode from
  `web/fixtures/product-devnet-catalog.json`, build the Product package without
  relying on the live catalog API, and fail if the generated bootstrap changes
  unexpectedly.
- Playwright checks run deterministic browser flows against local Vite and
  local signaling services from `web/playwright.config.ts`.

## Operations

Enabling branch protection is a repository administration action and is not
performed by this PR. After merging W01, configure `dev` branch protection to
require the stable checks above and to keep Project 5 as the workflow-status
source.

Rollback is straightforward: remove the required checks from branch protection,
then revert the W01 workflow commit if the workflow itself is the blocker. Do
not disable branch protection as a way to hide baseline failures; record the
failing job and fix it in a scoped PR.
