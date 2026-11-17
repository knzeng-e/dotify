# Product artist bootstrap finalization, 2026-10-22

Refs #317. Current Product 0.1.58 fails the artist's last runtime installation
approval with `installRuntimeStep` / `Revive.ContractReverted`. This correction
is source work, not a new Product publication or completed artist registration.

## Isolated cause

Read-only checks of the owner-reported account found a pending runtime at stage
7, with no finalized directory entry. The six facets are already installed;
there is no need to create another runtime or redeploy the factory. The final
stage initializes access, transfers ownership, removes pending-bootstrap state
and registers the artist in the directory.

The pinned Product contracts SDK 0.10.7 uses the dry-run's `storage_deposit` to
size the native call. That field is the final net charge. Revive separately
reports `max_storage_deposit`: the peak needed while a nested call is running,
before pending-bootstrap storage is released. On this pending finalization:

| Native result / sizing | Observed |
| --- | --- |
| Net storage charge | 52,800,000 native units |
| Peak storage charge | 105,600,000 native units |
| Required weight | ref_time 3,650,728,452; proof_size 294,386 |
| Bounded replay with SDK net limit | REVERT flag 1 |
| Bounded replay with peak limit | flags 0, return stage 0 |

The SDK-original versus actual-adapter comparison is pinned to finalized block
14745042, hash
`0x8e4f6e39dd6c5067b97ae5a8508d7cfd9a895e30e02aeab2933adf0d06b75454`.
It differs only in the deposit ceiling, with identical weight/value/calldata.

Doubling weight while retaining the net deposit still reverts. Using the peak
with the original weight succeeds. This isolates deposit sizing from gas and
from the independent best-block/finality risk. No signature, submission,
payment, state override or contract mutation was used for these comparisons.
The ordinary EVM simulation also succeeds, so it alone does not exercise the
native Product deposit limit that failed.

## Correction and trust boundary

`productCdmStorageDeposit.ts` adapts the shared Product contract runtime before
both static `ContractManager` and dynamic artist-runtime handles are created.
For successful dry-runs it places the verified peak in the SDK sizing field.
The original result is not mutated; the actual chain charge, calldata, native
value, weight, return value and account/signer selection are unchanged.
No unlimited limit or guessed multiplier is introduced. Missing, negative or
inconsistent peak evidence stops before transaction construction/signing and is
classified as a pre-submission error for support recovery. Failed dry-runs and
revert payloads retain the SDK's normal failure path.

Remove this adaptation when an explicitly validated pinned SDK sizes from
`max_storage_deposit` itself. The workaround applies to Product contract
sizing, not the viem adapter, API, encrypted streaming, keys or contracts.

Factory creation/install writes also explicitly wait for finality before the
onboarding loop reads the next stage. This protects dependent approvals against
provisional best-block success; it is not presented as the root cause above.
A reverted installation gets understandable resume guidance, while technical
facts retain the pending runtime and original diagnostic under details. Retry
continues the existing factory pending runtime through normal user approvals.

## Validation and remaining gate

- 980 frontend unit tests pass. New tests exercise actual SDK `.prepare()` and
  `.tx()` interfaces: net-vs-peak sizing, refunds/zero/malformed evidence,
  dispatch/revert preservation and finality before resolving onboarding writes.
  Wiring coverage checks the same adaptation reaches static and dynamic handles.
- Frozen Product build passes. ESLint has no errors and the two existing E2E
  App hook warnings; no new dependency or eager Product SDK runtime import.
- Five Chromium Product identity tests and sixteen artist-publication/browser
  tests pass. They use simulated hosts/writes, not real wallet approvals or
  on-chain bootstrap completion.
- Read-only native replay with the actual adapter and SDK succeeds at the
  chain-reported peak, preserving the original weight/value/calldata.

After review/merge, publish a new Product executable, verify its loaded identity
and let the artist retry the existing setup through the normal Host approval.
Confirm pending state clears, directory/runtime owner resolve to the artist,
and only then proceed to real streaming publication. The operator must not
finish the artist's funded transaction with a hidden signer.
