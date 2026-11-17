# API validator security candidate — 2026-11-12

The candidate replaces API Zod 3.25.76 with patched 4.6.7, using real v4 schemas.
It does not change the deployed services, stored data, keys or publication
allowances. Scope: [#432](../../api-schema-security-migration.md).
[Compatibility contract and reproduction](../../../reference/api-schema-compatibility.md).

## Artifact and local observations

Implementation: `eafda1019146e3a3fa0fb85c055262bab17476ac`, based on tested dev
`1a6b22d49679a4af4c9156f3229e69c754fcd0be`. The subsequent merge
`6dc349bb6837a8442d1336d8c15038be821b70e5` includes #444 from dev
`c6e6fea8f237ba754bf388f0ba1022f064dc895b`; its test-list conflict was resolved by
retaining both recovered-key verification and schema compatibility tests.

| Check | Observation |
| --- | --- |
| Existing API tests, Node 22.13.1 / macOS | 521 passed before integrating #444. |
| Historical schema regression | 86 passed: 42 canonical digest comparisons, 42 unknown-field refusals, early oversized-array refusal and malformed queue values. |
| Typecheck and production TypeScript build | Passed. |
| FFmpeg codec/format suite | Six passed. |
| Zod 3 producer → candidate recovery | Fourteen generated cases passed: coherent standard/compact state recovers and authenticates twelve playback objects per layout; six inconsistent-history cases per layout refuse without new stores. |
| Compiled historical modules | Candidate `eafda101…`, compatible #438 `61869fb4…`, unsupported #426 `8d070654…`. Both layouts preserve plan bindings, reconcile without duplicate stores, authenticate twelve objects through each reader and restart ready queues without rewriting history. Stale plans and the unsupported pilot command refuse before signer loading. |
| API production dependency audit | `npm audit --omit=dev`: zero reported vulnerabilities at this check. Historical test lockfiles intentionally remain unchanged. |
| Backlog and whitespace | Offline backlog check and `git diff --check` passed. |

## Remaining gates

The integrated #444 API run and exact-head GitHub CI were still pending at this
record's creation; the PR carries the final check status. Required checks include
PostgreSQL shared state, encoded publication, generated restoration and the
compiled historical exercise. These are generated-data/module checks, not a
Fly rollout, exhaustive live-record audit or physical-device acceptance.

A later delivery must follow the existing reviewed maintenance procedure and
preserve all journals and retained key versions. Stricter malformed UUID/unsafe
integer refusal is deliberate; never reset rejected state to make startup pass.
No signing key, live music, private backup or operation allowance was used here.
