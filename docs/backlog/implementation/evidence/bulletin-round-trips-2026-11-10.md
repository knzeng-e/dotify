# Publication round-trip candidate — 2026-11-10

Refs #407. Branch starts from tested dev `ad51a1fd`; its tree matches the fully
checked #425 source. [ADR 0050](../../../adr/0050-bulletin-proof-reuse-and-wave-ordering.md)
defines the boundaries; [machine-readable model](bulletin-round-trips-2026-11-10.json)
is generated entirely locally without artist input, signer or network writes.
This code is not deployed; custody remains `59244da5` and Web/Product/public
APIs remain 0.1.82.

## Measured locally

| Deterministic synthetic graph | Blocks | Original stages | Selected stages |
| --- | ---: | ---: | ---: |
| Smaller archive, 23 segments per rendition | 88 | 9 | 8 |
| Larger archive, 25 segments per rendition | 151 | 13 | 12 |
| Existing six-file cover directory | 8 | 3 | 3 |
| Existing release metadata directory | 2 | 2 | 2 |

These are equal-duration finalized stages, not seconds. The order is adopted
only when it reduces the remaining stage count under the existing window; no
files, CIDs, frame bytes, store count or journal inventory order change. Parent
and complete-root/archive receipt barriers remain. Ready and partial receipt
sets are exercised; legacy profiles keep their order.

The captured public receipt replay validates the same receipt sixteen times
sequentially. It fetches the block body and event data once, while still making
sixteen finalized-head and sixteen candidate canonical-mapping observations,
as well as fresh genesis/CID/retention reads. This measures fixture call counts,
not sixteen new on-chain transactions. Cold concurrent misses remain independent;
real transactions spanning multiple hashes or eviction need further downloads.
The two-entry cache holds at most 12 MiB of encoded body/event payload; this is
not the whole JavaScript heap or an authorization/retention cache.

## Verification

- **415 API tests / 42 suites pass**, including the real local IPv4/IPv6 tests
  run with loopback access. The restricted run's only failures were socket
  permission errors; no test was disabled or assertion weakened for that limit.
- Typecheck and compiled API build pass.
- A durable-writer regression sends an 88-block synthetic encrypted fixture in
  eight waves, with fsynced intents, proven children, root last and original
  inventory order. Reopening its ready job adds no stores. Existing lost-ack,
  missing-nonce, crash/reconciliation, retention and allowance tests pass.
- Receipt tests keep bad sender/nonce/payload/events closed, recheck changed
  canonical mappings and current CID metadata, and refuse expiry despite cache
  warmth. Independent cold body cancellation and failed-load recovery pass; the existing
  metadata-codec cache is unchanged. Capacity
  tests prove both count and encoded-payload eviction bounds.
- Existing full-body size rejection is checked with a cold session. Mutating a
  fake RPC response after a valid cache load does not mutate the owned cached
  bytes; a block hash is treated as immutable, not re-fetched to detect a lying
  endpoint's inconsistent same-hash body. The trusted-RPC boundary is unchanged.

Reproduce after installing API dependencies:

```sh
cd services/api
npm run build
node --import tsx scripts/measure-bulletin-round-trips.mjs
npm test
npm run typecheck
```

The benchmark uses compiled graph/transport modules and an explicitly local
public fixture (test fixtures are excluded from dist). Its deterministic model
output was identical across two runs. It reads no private operational state.

## Remaining work

The three-/two-stage public-asset tail remains: removing it needs a separate
format/resolver compatibility analysis. Live throughput, memory behavior in the
hosted process and lower artist wall time remain unverified. Phase sums overlap
and no wallet-render timestamp is instrumented. Prepare a matched bounded
custody rollout after review/CI and separate operational approval; another
funded source test is not implied. Preserve existing reserves and all histories;
#407 stays Now/In Progress before #395, #388 and CASH research.
