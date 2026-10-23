# Contribution scope validation and measured Solidity optimizations

Owner-requested follow-up to PR #324, refs #317. Baseline application source:
`3ec61ce895dfa490602546427f8b84ce998b9265`. This is a bounded pass over
`MusicContributionsPallet`, the inherited `MusicRoyaltiesPallet` and their shared
royalties library, rather than a storage migration or a whole-system rewrite.

## Policy semantics

`musicGiftPolicy(0)` remains the artist profile policy. A registered work with
no saved policy returns the default struct, including version zero. A nonzero
unregistered scope now reverts with the registry's existing `track not found`
error instead of looking indistinguishable from an unconfigured work. Inactive
registered works remain readable/editable; quote/payment still rejects them.
The repeated `LibMusicRegistry.store()` calls identified in review were in
`musicGiftSetPolicy` and `musicGiftQuote`; both now use a local storage reference.
`store()` computes a namespace pointer, not a storage read by itself, so caching
that pointer is not a claim that every removed call saves an `SLOAD`.

## Pattern decisions

The [requested article](https://blockhertz.com/blog/solidity-gas-optimization-15-patterns-to-reduce-costs-2026)
is a review checklist, not an authoritative fee schedule. For example,
[EIP-2929](https://eips.ethereum.org/EIPS/eip-2929) distinguishes cold 2,100 and warm
100 gas storage reads, whereas the article uses a general 800 gas figure.
[Solidity 0.8.28's optimizer documentation](https://docs.soliditylang.org/en/v0.8.28/internals/optimizer.html)
explains inlining/common-subexpression optimization and automatic unchecked
increments for eligible idiomatic loops. Actual savings depend on compilation
and execution rail; the measurements below use our configured compiler.

| Article pattern | Decision in this pass |
| --- | --- |
| Cache storage reads | Reuse namespace/mapping references and local recipient/amount values. Compute claimable totals once; do not copy whole dynamic policies into memory. |
| Custom errors | Replace contribution revert strings with named ABI-decodable errors, retaining registry/owner errors. Regenerate the client ABI. Function selectors/events remain unchanged. |
| Immutable values | Already used for factory configuration. Per-artist policy, ownership and balances must remain writable in Diamond storage. |
| Storage packing | Policy's small fields are already grouped. Preserve every deployed namespace, struct order and mapping key. |
| Prefix increment | Use `++i` in touched loops; do not claim a universal saving when IR already optimizes it. |
| Cached lengths | Cache policy calldata lengths and immutable royalty split lengths; reuse quote array capacity. Never cache a collection length across a call that can change that collection. |
| Unchecked arithmetic | Keep all monetary, version and aggregate arithmetic checked. Leave simple loop-increment optimization to the configured IR compiler. |
| Calldata | Policy/context/proof and royalty registration inputs already use calldata. |
| External over public | Keep `musicGiftQuote` public because contribution execution calls it internally; an external self-call would add overhead/change the call path. Other entry points are already external. |
| Short circuit | Validate work existence/activity before quote allocations. Do not allocate inactive policy destinations or read a nonexistent profile royalty list. |
| Remove redundant state | Keep policy versions, used intents and pending amounts: they enforce stale-quote, replay and claim safety. |
| Events over storage | History is already event-based. Claimable balances and replay protection must remain enforceable on chain. |
| Avoid zero-to-nonzero writes | Do not renumber versions or change the shared reentrancy lock/initialization contract for a micro-optimization. |
| Batching | A contribution already settles every destination atomically; no new bulk-payment API. |
| Mappings over array lookup | Work policies, used intents and pending balances already use mappings. Arrays are necessary to enumerate split destinations. |

Native transfer gas bounds, shared reentrancy protection, receipt identity,
rounding, rights splits and host precedence are unchanged. A cached storage
reference remains a reference, not a stale value snapshot. Royalty split arrays
are immutable through the public registry API. Checks-effects-interactions
remains intact for contributions and claims.

## Reproducible local measurements

Both runs use solc 0.8.28, viaIR, optimizer runs 200, the same deterministic
wallets, deployment order, fixture block clock (2,000,000,000), fixed quote expiry (2,000,001,000), inputs and state
transitions. `*Estimate` rows are estimated EVM gas for reads; payment/policy rows
are transaction receipt gas. Bytecode size is bytes, not gas. These are local
Hardhat results, **not** measured Polkadot/Revive fees, storage deposits or native
Product execution weights.

| Scenario | Before | After | Change |
| --- | ---: | ---: | ---: |
| `policyReadEstimate` | 44,883 | 47,227 | +5.22% |
| `directTipQuoteEstimate` | 60,197 | 59,953 | -0.41% |
| `directTip` | 114,176 | 113,160 | -0.89% |
| `classicAccess` | 90,685 | 90,488 | -0.22% |
| `setHostPolicy` | 91,466 | 90,869 | -0.65% |
| `roomTip` | 132,092 | 130,674 | -1.07% |
| `set16Destinations` | 527,813 | 524,121 | -0.70% |
| `gift16QuoteEstimate` | 113,996 | 111,928 | -1.81% |
| `gift16Destinations` | 338,009 | 331,094 | -2.05% |
| `royaltiesRuntimeBytes` | 13,725 | 12,303 | -10.36% |

The extra policy-read cost is intentional existence validation. The complete
quotes, recipient order, amounts, roles, campaigns, authorities and digests are
identical for the three fixed scenarios. See the [machine-readable evidence](contribution-gas-2026-10-23.json).

From `contracts/evm`, run:

```sh
CONTRIBUTION_GAS_REPORT=/tmp/contribution-after.json npx hardhat run scripts/contributionGas.ts
```

To reproduce the comparison, compile baseline `3ec61ce` in a separate checkout,
copy this measurement script into it, and record `/tmp/contribution-before.json`.
Copy its `artifacts/contracts/pallets/MusicRoyaltiesPallet.sol/MusicRoyaltiesPallet.json`
to `/tmp/contribution-old-facet.json` before compiling the candidate. In the
candidate checkout, set `CONTRIBUTION_GAS_BASELINE_REPORT` to that before report
to assert complete quote equality. Set `CONTRIBUTION_BASELINE_ARTIFACT` to the
old facet JSON for a separate upgrade-rehearsal run. That mode seeds an actual
old facet, replaces its selectors with the candidate, and asserts preservation
of both policies, catalogue and paid access, replay rejection and exactly-once
recovery of an old pending contribution. Rehearsal-mode gas rows use the old
facet and are not the optimized measurement. The script refuses every network
except the ephemeral `hardhat` network before executing any fixture transaction.

## Verification and deployment boundary

Contract regression coverage includes unknown/default/inactive scopes,
unauthorized and stale policy writes, allocation limits, sixteen destinations,
odd-amount conservation at schedule boundaries, shared cross-pallet reentrancy,
rejected transfers, repeat submissions and exactly-once claims. The 78-test contract suite passes, as does the actual baseline-to-candidate
local facet cut above. All 982 frontend unit tests, generated ABI drift checks,
Web and frozen Product builds pass. Lint has no errors and two existing App E2E
hook warnings; Solidity formatting and the offline backlog check pass.

No factory, artist runtime, CDM mapping or live policy has been changed. The new
scope guard and gas savings require deploying the reviewed royalties facet and
an artist-owner approved selector replacement (or a separately coordinated
fresh factory configuration). Rebuilding Web/Product alone does not change
existing runtime bytecode. The earlier #324 signaling/client configuration fix
can still work against the existing facet. Native Product simulation, finality,
recipient value readback and code-hash verification remain live rollout gates.
