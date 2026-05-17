# 05 — Classic unlock end-to-end coverage

## Sprint
Sprint 1 — Stabilization and maintainability

## Priority
P1

## Objective
Add deterministic end-to-end coverage for the Classic paid unlock flow.

The app must prove that a listener can see preview-only playback, pay through the runtime, and then receive full-track access.

## Scope
Add e2e tests for the listener-side Classic unlock path.

Recommended tooling:

- Playwright for browser e2e
- Hardhat local chain or deterministic testnet mock mode
- Mock IPFS/Pinata where needed

## Flow under test

```txt
1. Seed or publish a Classic track.
2. Open listener app with an unauthorized wallet.
3. Select the Classic track.
4. Assert preview-only state and access warning.
5. Trigger payment action.
6. Confirm transaction or mock confirmation.
7. Re-select/reload track.
8. Assert full access state.
9. Assert no unauthorized full key is requested before payment.
```

## Requirements

- The test must fail if full playback is available before authorization.
- The test must fail if payment succeeds but access state does not refresh.
- The test must assert user-visible states, not only internal functions.
- Prefer stable test IDs over text selectors for brittle UI regions.

## Suggested test IDs

```txt
data-testid="track-card"
data-testid="access-warning"
data-testid="preview-player-state"
data-testid="classic-unlock-button"
data-testid="unlock-transaction-status"
data-testid="full-playback-state"
```

## Acceptance criteria

- `npm run test:e2e` or equivalent runs the Classic unlock test.
- Test is documented in README or testing docs.
- CI can run it in deterministic mode.
- Failure modes are actionable.

## Non-goals

- Do not cover every wallet provider.
- Do not require live Pinata for e2e.
- Do not require live user funds.

## Senior-engineer notes

This is a trust flow. If Classic unlock fails, Dotify fails both technically and ethically: the listener paid, and the artist/runtime promise was broken. Test it like money and reputation are involved, because they are.