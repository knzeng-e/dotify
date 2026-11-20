# Native payment review follow-up — 18 November 2026

## Outcome and artifact

Tested implementation: `b3a11a3cdd79733cfd8b20fcba7992c86cd8f2e1`. This dated record is a later documentation-only
change. It supersedes the rollout/migration scope of the
[earlier candidate evidence](native-payment-settlement-candidate-2026-11-18.md),
whose observations remain tied to their original source.

The [PR #485 review finding](https://github.com/knzeng-e/dotify/pull/485#discussion_r4611642124)
identified a completed transaction being rejected locally when its receipt could
not be saved. The corrected writer retains the finalized transaction hash and
block, exposes a separate history warning, and allows callers to finish their
settlement/access verification. Before submission, receipt-queue readability,
capacity and writability are checked. Post-finality storage failure cannot
promise durable saving: the reference remains in the current tab and must be
kept before closing it if saving failed. Read-only repair does not repay.

The support-payment journal also handles storage failure after submission
without interrupting the writer's status callback or skipping access readback.
Its initial durable reservation still fails closed before any payment. The
artist claim UI continues finalized pending-balance readback and retains the
hash/block when history persistence fails; a later failed batch operation also
retains the last completed transaction hash.

## Clean-generation scope

The owner chose a full fresh testnet generation, abandoning previous active
contracts, releases and references. The migration-only
`LegacyFixedGasPaymentPallet` and its old-debt replacement test were removed.
Existing general upgrade tooling is not the selected delivery path. Failed
payouts and recipient claims within the new generation remain required behavior.
The authoritative cutover steps are in the
[deployment runbook](../../../operations/deployment-configuration.md#native-payment-correction-candidate-484);
this record does not authorize or report a completed reset/deployment.

The payment finding from the wider contract audit is also corrected: royalty
registration rejects the runtime itself as a split recipient, and settlement
rejects self-destinations before any false paid event. Push budgets now reserve
for the maximum combined contribution fan-out: sixteen rights recipients plus
sixteen policy destinations, host and artist (34 entries), using `gasleft()/68`.
An adversarial local test exercises 32 gas-consuming entries, a healthy Room
host and a late healthy artist remainder, then successfully claims the retained
shares and checks that the runtime's balance returns to zero.

## Verification

Environment: Node 22.23.5, macOS arm64, repository lockfiles unchanged.

| Check                             | Result and boundary                                                                                                                                                                                                                     |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full frontend suite               | **1,248 tests, 162 files passed**. Includes queue malformed/full/unwritable preflight, post-finality save failure, provider wiring, no resubmission, access verification, and the artist claim hash/block/readback regression.          |
| Full contract suite               | **94 passed**. Includes runtime-recipient rejection, 34-entry adversarial Room settlement/claim conservation, expensive refunds, failed/repeated claims and reentrancy isolation. The old migration-specific test is removed.           |
| Browser earnings/gifts            | **38 passed** on Chromium, two workers. Synthetic fixtures cover receipt/history/repair journeys; this is not physical Product Host acceptance. The runner required local socket permission after the initial sandbox denied port 8789. |
| Web and frozen Product builds     | Both passed, including frontend TypeScript. Existing large-chunk warnings remain.                                                                                                                                                       |
| Lint and formatting               | Zero lint errors; two existing App.tsx dependency warnings. Web and contract formatting checks passed.                                                                                                                                  |
| Generated ABI / repository checks | ABI generation reproduces the tracked bindings; whitespace and offline backlog checks passed. Changed documentation links resolve.                                                                                                      |

API source is unchanged in this follow-up. The earlier candidate's **660/660**
API result remains historical evidence, not a newly executed API suite here.
No public-chain transaction, new payment, owner signature, facet cut, client/API
deployment or active-state deletion was performed.

Reproduction commands:

```bash
cd contracts/evm
npm test
npm run generate:abis
npm run fmt:check
cd ../../web
npm run test:unit
npm run lint
npm run fmt:check
npm run build
npm run build:product-devnet:frozen
npm run test:e2e -- e2e/artist-earnings.spec.ts e2e/artist-gift.spec.ts --project=chromium --workers=2
cd ..
node scripts/backlog-sync.mjs --check --offline
```

## Remaining delivery gates

This is a source candidate. Complete the remaining whole-system audit corrections
before freezing the clean deployment. Verify the fresh contract manifest,
generation-scoped API/client state and new Bulletin publications together.
Real payout/claim/refund and resource behavior on the exact Revive artifact,
physical Host finality/receipt/balance acceptance, and fresh listening/Room
acceptance still need deployment evidence. CASH and the held SDK/Host upgrade
remain separate. Retiring the old generation does not erase its immutable
on-chain history or waive ordinary claim accounting in the new generation.

## Subsequent W35 CI correction

The [W35 job on the earlier PR head](https://github.com/knzeng-e/dotify/actions/runs/44283426136/job/134731154509)
failed one `webkit-web` compact compatibility Room case; the compact matrix
reported 31 passes and four deliberate exclusions. The source media clock had
advanced to 12.629 seconds, all three contexts reported running, peers were
connected, and no media/reader error was recorded, but the source PCM meter
remained zero. RTC counters were not substituted for measured audio.

Test correction: `c95297e6f45936490ab0ba2183064d0694b68d35`. The Room gate now proves actual source PCM first,
pauses the source, connects the guest, verifies that negotiation preserves Pause
and media position, then requires explicit Play and source/guest PCM again.
The RMS thresholds and authenticated end-of-track assertion are unchanged;
there is no automatic retry, extra skip or longer timeout. This exercises the
solo → Pause → Room → Play sequence; it does not establish reliability of a
never-played source with a guest attached before its first Play gesture.

The downloaded CI synthetic fixture was used locally with matching-lock API
fixture dependencies. The unmodified WebKit Web case passed three local repeats,
so the intermittent Linux failure was not reproduced on macOS. An exploratory
run was invalidated by editing its fixture while Vite was running and is not
acceptance evidence. The frozen corrected version passed all four focused Room
cases (Chromium/WebKit × Web/injected Host), **4/4**, including both source and
guest signal and full playback. Compact harness TypeScript, formatting and
whitespace checks passed. Production audio, payment code and workflow limits
were not changed by this correction. Full Linux CI validation follows the push;
local passes alone are not a green W35 claim.

### Linux matrix refinement

The [next Linux W35 run](https://github.com/knzeng-e/dotify/actions/runs/44359968951/job/134999773984)
passed both WebKit Room cases, including the originally failing one. It exposed
a separate effect of applying the new priming/Pause sequence to Firefox: both
Firefox Room cases had real source/guest signal and reached `ended`, but the
browser reported duration/currentTime **25.216 s** instead of the authenticated
24.2-second duration. The matrix ended with 30 passes, four exclusions and those
two failures. These results are retained rather than described as a green run.

Refined test source: `1eacf6157a7acd7b78ca5b63456d48aab1390eeb`. Priming is now limited to WebKit. Chromium and
Firefox keep their original cold-capture sequence; all engines still require
Pause/position preservation during negotiation, source and guest PCM, and the
same strict 24.2-second end assertion. No threshold, timeout, retry or exclusion
was relaxed.

The frozen refined version passed the Chromium Web and WebKit Web Room cases
locally (**2/2**) plus compact-harness TypeScript, formatting and whitespace
checks. The unchanged WebKit priming branch had also passed six local repeats
(Web/Host, three each) before the first push. A local Firefox attempt cannot be
counted as decoder acceptance: macOS Firefox failed its renderer/framebuffer
startup before the test could run. Linux CI remains authoritative for that
engine. The attempted rewind experiment was not retained; it did not establish
a Firefox fix. Production audio and payment code remain unchanged by this
refinement.
