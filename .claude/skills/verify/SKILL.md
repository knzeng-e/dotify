---
name: verify
description: >
  Run the Dotify workspace checks (types, lint, unit tests, build) for web/, services/api/,
  and contracts/evm/. Use after any code change and before reporting completion or committing.
  Fixes failures and re-runs until the touched workspaces pass.
---

# Verify - Dotify workspace checks

Run the checks for every workspace the change touched. If the change crosses a shared
boundary (ABI, API contract, signed message format), run all three. The risk-based
extras (signaling, e2e, production smoke) live in the CLAUDE.md verification matrix.

## Steps

### 1. Frontend (`web/`)

`web/` has no `typecheck` script. `npm run build` runs `tsc -b` first.

```bash
cd web
npm run test:unit 2>&1
npm run lint 2>&1
npm run build 2>&1
```

### 2. Backend API (`services/api/`)

```bash
cd services/api
npm run typecheck 2>&1
npm test 2>&1
npm run build 2>&1
```

### 3. Contracts (`contracts/evm/`)

```bash
cd contracts/evm
npm run compile 2>&1
npm test 2>&1
```

### 4. Every change

`git diff HEAD --check` covers staged and unstaged changes; plain `git diff --check`
misses anything already staged.

```bash
git diff HEAD --check
cd web && npm run fmt
```

## Rules

- Report each workspace separately: pass, fail with the first error line, or not run with the reason.
- If a check fails, fix the issue in place and re-run that workspace's checks.
- Do not report "done" until every workspace you ran is green. Never claim a check passed that was not run.
- Watch for smart quotes (U+2018/2019/201C/201D), unescaped apostrophes, and unclosed JSX - these break esbuild silently.
