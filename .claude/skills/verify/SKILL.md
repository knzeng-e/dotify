---
name: verify
description: >
  Run all Dotify workspace checks (typecheck, lint, build) across web/, services/api/,
  and contracts/evm/. Use after any code change to confirm everything is green before
  reporting completion. Fixes failures and re-runs until all pass.
---

# Verify — Dotify workspace checks

Run the full check suite across all three Dotify workspaces. Report each result. Fix any failures and re-run until everything is clean.

## Steps

### 1. Frontend (`web/`)

```bash
cd web
npm run typecheck 2>&1
npm run lint 2>&1
npm run build 2>&1
```

### 2. Backend API (`services/api/`)

```bash
cd services/api
npm run typecheck 2>&1
```

### 3. Contracts (`contracts/evm/`)

```bash
cd contracts/evm
npm run compile 2>&1
npm test 2>&1
```

## Rules

- Report each workspace separately: pass or fail with the first error line.
- If any check fails, fix the issue in place and re-run that workspace's checks.
- Do not report "done" until all three workspaces are green.
- Watch specifically for: smart quotes (U+2018/2019/201C/201D), unescaped apostrophes, unclosed JSX — these break esbuild silently.
