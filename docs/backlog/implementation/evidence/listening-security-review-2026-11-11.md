# Listening security review and fixes — 2026-11-11

Refs #431; separate from compact-format #407/#430. Baseline is tested dev
`3e3757c2` (#429). Three agents reviewed scoped paths independently. The compact
PR diff had no confirmed introduced defect. The findings below predate #430.
No production state, secrets, live Rooms or artist files were inspected.

## Findings addressed

| Priority | Confirmed defect                                                       | Correction and regression evidence                                                                                                                                     |
| -------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | Malformed HTTP Host/target or socket object/ACK can crash signaling    | Constant-base/caught URL parse; envelope/scalar/ACK validation before mutation; existing Room survives malformed requests                                              |
| P2       | Logout/expiry during an access read still derives a key                | Server rechecks the session after reads, then checks verdict freshness immediately before derivation; zero derivations on revocation/expiry                            |
| P2       | Late401/error parsing restarts an old identity or clears a replacement | Same-generation and exact-token checks before prepared cache and after every asynchronous boundary; replacement/cleanup produces cancellation without signing/retrying |
| P2       | Batch waits out an earlier grant but still returns its key             | Expired/invalid grants return temporary denial and are excluded from grant expiry metadata; no derived key                                                             |
| P2       | Readiness/negotiation floods rebuild peers and grow ICE queues         | Per-socket role-gated relay budgets, strict size/shape limits, bounded/deduplicated browser queue and departed-listener cleanup                                        |
| P2       | Zod 3 constrained collections can expand validation work before auth   | Bounded iterative parsed-JSON gate before route schema parsing; real major migration remains #432                                                                      |

The live HTTP/socket crash was reproduced only in isolated disposable child
processes. Other findings were demonstrated from call sites and deterministic
failure-path tests. Re-review found no remaining introduced defect in the key
fixes, signaling/ICE limits or JSON mitigation after correcting its control test.
This is not an exhaustive repository/cryptography audit.

## Dependency evidence

Lockfiles preserve SDK/signer/TrUAPI versions. The installed shared frontend was
older than its checked-in lock, so final validation uses fresh isolated installs.
Compatible updates include Engine.IO6.6.11; Fastify5.12.8; Busboy3.2.5;
fast-uri3.1.9/4.2.3; sharp0.35.5/libvips1.3.4; Vite6.4.6;
Browserslist4.29.5/source-map-js1.2.2 and Web Zod 4.6.7.
Scoped overrides select Host API Nano ID5.1.16, PostCSS Nano ID3.3.18 and
write-package/deepmerge8.0.0. Async/sync updatePackage compatibility and both
PAPI CLI startup checks supplement Web/Product builds.

Primary advisories: [Engine.IO](https://github.com/advisories/GHSA-2gc4-cqfq-p2gv),
[Fastify](https://github.com/fastify/fastify/security/advisories/GHSA-4mh8-r7rc-xpvc),
[Busboy](https://github.com/advisories/GHSA-xjh9-v7x6-24jw),
[Busboy CRLF](https://github.com/advisories/GHSA-gxm5-99cw-xjw9),
[sharp](https://github.com/advisories/GHSA-wq5f-xc86-pv6w),
[Nano ID](https://github.com/advisories/GHSA-2v37-7h3g-55p8),
[deepmerge](https://github.com/advisories/GHSA-ggr8-5vv4-36mx),
[Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).

The final production-dependency audit reports **Web 0 findings / API 1 high (Zod 3)**.
These are audit database results, not a claim that all attack paths are safe.
The JSON gate mitigates the demonstrated public Zod 3 amplification scenario but
does not remove its advisory. #432 requires a real patched-v4 migration with
persistence/canonical-binding compatibility. No forced downgrade or global
cross-major Nano ID substitution is used.

Full development audit still has findings behind Vitest/Tinypool and lint/parser
major constraints; [#433](../../tooling-security-migration.md) tracks their tested
migration. Compatible updates also patch concurrently/shell-quote, js-yaml,
selector-parser and the existing brace-expansion override. A clean production
subset is not a clean full-development audit.

## Validation and limits

Final validation: **437 API tests / 42 suites**, **1,126 Web unit tests**,
**131 signaling tests / 11 suites**, **26 offline Product/CLI guard cases**,
**22 Room/audio browser cases + 5 logout browser cases** pass. API typecheck/build,
Web build, frozen Product DevNet build, Web formatting and offline backlog/docs
checks pass. Both PAPI CLI help commands start successfully. Lint has zero errors
and the two pre-existing App hook warnings. Web/Product retain their existing
large-chunk warning. SDK/signer versions were compared against baseline locks
and are unchanged.

The full final Web development audit has **8 moderate / 2 critical** findings;
the production subset has zero. These remaining dev findings require the tested
major migrations in #433 and are not treated as remediated. API has one remaining
high Zod advisory, mitigated at network boundaries and tracked in #432.

Regression coverage includes
free/paid key boundaries, anonymous guests with no keys, session cancellation,
normal/malformed Room traffic, ordinary candidate exchange, JSON structure and
byte limits, private publication recovery and native image generation.

Signaling and cache bounds are explicit in [the ticket](../../listening-security-hardening.md).
They are not a crowd-scale benchmark: higher Room capacity, sustained hostile
traffic and physical Host reconnect/background behavior need separate acceptance.
The existing large-bundle and two App hook lint warnings are not silently
changed by this scope. Public-pilot security, conservation and recovery gates
remain; no image upload, maintenance, deployment, real musical write or signer
operation occurs here.

## Shared-state CI follow-up

The first #434 CI exposed a raw JSON proxy stream being inspected as if it were
parsed JSON, returning413 before custody authentication. The request gate now
exempts actual Node `Readable` and `Buffer` instances without consuming them;
ordinary JSON cannot forge that exemption with a `pipe` property. Custody still
validates the parsed body. A dedicated regression covers both directions.

All **15 W36 tests pass locally on disposable PostgreSQL16**, including rolling
restart/logout, backup/restore, custody exit/lock loss and streamed proxy failure
behavior. PostgreSQL16 dump/restore clients run inside that same disposable
container (the system client is14); the container and temporary clients are
removed afterwards. No existing database or production state is involved.
