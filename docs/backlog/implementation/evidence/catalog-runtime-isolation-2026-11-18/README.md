# A01 runtime-isolation source validation — 18 November 2026

## Artifact and environment

Frozen source: `a0a6a021b6cce9316efe9d0d2662d58fa6e0cbf6`, based on merged
`dev` `2198a44781f1d3ace322859f9eaee4131ede1a62` (#485).
macOS arm64, verified Node 22.23.5, locked API dependencies including Viem
2.55.19. PostgreSQL 14.17 runs in a dedicated disposable loopback database;
no hosted database, signer, chain transaction or active snapshot is used.
This record accompanies [#486](https://github.com/knzeng-e/dotify/issues/486) /
[PR #487](https://github.com/knzeng-e/dotify/pull/487).

## Checks on the frozen source

| Check | Observation |
| --- | --- |
| API typecheck and build | Pass |
| Catalogue/read-model/scaling, real Viem RPC, access, key and catalogue routes | 95 tests pass; no skips |
| PostgreSQL full shared-state suite, including catalogue checkpoint, writer/reader and restart behavior | 16 tests pass; no skips |
| Broader implementation API run | 674 tests pass, 43 suites, no skips; started before the final content/progress refinement, so the frozen-source acceptance is the 95-test boundary run above |
| Backlog offline check, whitespace and introduced documentation links/anchors | Pass |

The final boundary run takes 2.576 s; the isolated PostgreSQL run takes 8.593 s.
A preceding shared-state attempt returned PostgreSQL `57014` (statement timeout)
in the unrelated dump/restore test while the broader API fixtures were running;
the catalogue tests passed in that attempt. The full isolated rerun passes all
16 tests without a source/test change. Linux CI on the final PR head remains
pending at evidence creation; it is not represented as local acceptance.

The boundary command is `node --import tsx --test` with
`catalog/{readModel,chain,scaling,runtimePolicy,runtimeIsolation}.test.ts`,
`chainAccess.test.ts`, `routes/keys.test.ts` and `routes/catalog.test.ts` under
`services/api/src/services` / `services/api/src/routes` as appropriate.
Shared-state command: `TEST_DATABASE_URL=<isolated loopback database>`
`npm run test:shared-state`. No credential or remote database URL is recorded.

The HTTP stub uses the real Viem call/ABI decoder and records the gas limit and
pinned block. Revert, empty data, malformed ABI and excessive counts/bytes are
local; quota errors, HTTP 429/500, dropped sockets and malformed JSON remain
global. HTTP 500 carrying a revert-shaped error also remains global. Streamed
oversize responses cancel; owner cancellation drains a stalled real response;
the per-call deadline still covers a body stalled after headers. Maximum valid
metadata and 16 royalty recipients decode under the byte budget. These are
transport/ABI fixtures, not proof of Revive execution cost.

Read-model tests prove healthy independent key checks alongside an excluded
runtime and `TRACK_NOT_FOUND` before any grant for the excluded release. They
cover cold scan, whole-runtime removal on an incremental fault, full-inventory
repair, eventless recovery after restart, diagnostic revision binding, failed
writes and a checkpoint hash change. An elected-writer fixture checks that
aborted started work drains before election release. Progress tests preserve
base diagnostic arrays instead of rebuilding the catalogue on replica reads.

## Limits and delivery state

This is implemented source validation. No API delivery, contract deployment,
old-state reset, new publication or physical Host acceptance is performed.
Exact Revive admission budgets remain unverified. Catalogue-wide provider/
directory/log limits and other audit corrections remain as described in the
[reference](../../../../reference/catalog-runtime-isolation.md). In particular,
A09 key finality is not fixed here. The owner-selected fresh generation follows
those corrections; no old contracts/releases/references are migrated by A01.
