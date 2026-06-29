# 06 — Artist publish end-to-end coverage

## Sprint
Sprint 1 — Stabilization and maintainability

## Priority
P1

## Status
Delivered on `main`.

## Objective
Add end-to-end coverage for the artist publication flow.

An external artist must be able to connect a wallet, create a runtime, upload assets, register a track, and see it appear in the listener catalog.

## Flow under test

```txt
1. Open `/artists`.
2. Connect deterministic test wallet.
3. Create artist runtime if none exists.
4. Upload audio fixture.
5. Upload cover fixture.
6. Fill title, artist name, description, access mode, price, royalties.
7. Publish/register release.
8. Assert runtime transaction success.
9. Open Home catalog.
10. Assert track appears with correct metadata and access mode.
```

## Requirements

- Use small fixture files committed under an appropriate test fixture directory.
- Mock backend upload responses where full Pinata integration is not desired.
- Exercise the real frontend workflow.
- Assert no dev account fallback is used for public artist flows.
- Assert network mismatch and wallet missing states are handled.

## Acceptance criteria

- Artist publish e2e test exists and passes locally.
- Test can run in CI deterministic mode.
- Failing upload, failing transaction, and missing wallet are covered at least as component/integration tests.
- README documents how to run the test.

## Delivery notes

- Added Playwright coverage in `web/e2e/artist-publish.spec.ts`.
- Added committed test fixtures under `web/e2e/fixtures/`.
- Added `VITE_E2E_ARTIST_PUBLISH=true` deterministic mode with a test wallet, mocked uploads, mocked runtime creation, mocked release registration, and persisted catalog visibility.
- The happy path covers artist runtime creation, audio and cover fixture uploads, release metadata/access/royalty inputs, release registration, and Home catalog visibility.
- Negative coverage asserts missing wallet, wrong network, upload failure, and transaction failure states.
- The artist publish path now rejects wrong-chain wallets before signing publish transactions.

## Non-goals

- Do not require real Pinata in CI.
- Do not require real Paseo testnet in CI unless explicitly marked as smoke test.

## Senior-engineer notes

The artist flow is the sovereignty flow. Keep the UX simple, but verify every state transition. An artist should never wonder whether their work is uploaded, registered, protected, or merely floating in UI illusion.
