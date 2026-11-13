# Room startup diagnostic candidate — 2026-11-12

The client candidate can export correlated successful and failed audio preparation
from About. It supplies measurement for #395; it does not claim faster mobile
startup, native background acceptance or a new deployment. #407 recovery remains
the activation priority while this independent, offline client work progresses.

Implementation reviewed and tested: `14b2c887e3cdd22f224dfead7d7860b8ee317453`,
based on tested dev `1a6b22d49679a4af4c9156f3229e69c754fcd0be`.
The subsequent evidence commit changes documentation only.

## What the checks establish

| Local check                                   | Result and scope                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Exact-lock Web and API `npm ci`               | Installed the committed dependency versions for browser/fixture checks. An earlier reused dependency directory had incompatible SDK types; that environment was discarded, not worked around in application code.                                                                                                                          |
| Web unit suite                                | 1,147 tests across 149 files pass. New tests cover overlapping read durations, failure accounting, detached snapshots, export-local attempt correlation and counter allowlisting.                                                                                                                                                          |
| Web build / lint / format                     | Build and format pass. Lint has zero errors and the two existing App hook warnings. Existing chunk-size warnings remain.                                                                                                                                                                                                                   |
| Chromium audio suite                          | 43 pass, one existing skip at the preceding test-file state. This includes the new complete-preparation evidence test and existing access, cancellation, source-retirement and transport regressions.                                                                                                                                      |
| Final targeted Chromium + WebKit              | Both new scenarios pass on both engines (four checks): successful authenticated complete preparation and a key-request retry retaining selection identity and Room capture intent. The initial Room test omitted the harness capture option; the corrected harness passes it explicitly.                                                   |
| About Chromium                                | Six tests pass; the two new clipboard cases also pass after adding screenshots. At 390 × 844, the collapsed support section remains opt-in, successful observations export without internal identity, clipboard refusal exposes selectable text, and the modal has no horizontal overflow. The fallback screenshot was visually inspected. |
| Backlog / whitespace / changed-document links | Offline manifest check, diff check and local link checks pass.                                                                                                                                                                                                                                                                             |

The browser fixture is generated synthetic AAC/encrypted media. Requests are
intercepted; no real artist upload, wallet action, live access grant, Fly operation,
Bulletin transaction, DotNS signature or service restart was used for these tests.

## Limits and next acceptance

Read/decrypt counters measure completed work. Parallel durations overlap, failure
snapshots may precede sibling completion, and the bounded event ring can evict
older phases. The report does not separate Host-internal work from transport wait
and does not measure what listeners actually hear. It neither changes the existing
60-second/40-MiB bounds nor bypasses authorization to reuse a prepared source.

Follow [the measurement procedure](../../../how-to/measure-room-startup.md) after
review and a matching client rollout. Obtain repeated same-track starts, including
failures, actual host/Web/Desktop guest sound and lock/unlock behavior before
selecting a latency correction. No matching physical-phone report exists for this
candidate yet. Existing deployed client behavior is not inferred from these checks.

The API dependency audit still has the already tracked high-severity Zod item
[#432](../../api-schema-security-migration.md). This PR changes no dependency or
API schema and makes no claim of a clean API audit. The prior bounded-body
mitigation and remaining migration are documented in that ticket.
