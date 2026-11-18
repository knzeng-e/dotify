# Artist-runtime catalogue isolation

This reference describes the A01 source candidate for API maintainers and
operators. It is not evidence of deployment or native Host acceptance.
[The scope](../backlog/catalog-runtime-isolation.md) is tracked in #486.

## Authority and failure boundaries

An artist can replace their SmartRuntime selectors. Discovery must therefore
regard each runtime's execution and returned ABI as untrusted, independently
of the trusted ArtistDirectory and RPC transport. The defining code is
[`runtimePolicy.ts`](../../services/api/src/services/catalog/runtimePolicy.ts),
[`chain.ts`](../../services/api/src/services/catalog/chain.ts) and
[`readModel.ts`](../../services/api/src/services/catalog/readModel.ts).

| Observation during an artist-runtime read | Catalogue consequence |
| --- | --- |
| Typed Viem execution revert, including a missing selector | Exclude the whole runtime (`execution-failed`) |
| Returned bytes cannot decode against the required ABI, invalid release schema/enums or inconsistent/duplicate inventory | Exclude the whole runtime (`invalid-output`) |
| Runtime exceeds a reader admission budget | Exclude the whole runtime with the corresponding code below |
| Existing metadata-byte or 16-recipient release limit | Retain the existing per-release exclusion; never truncate metadata or rights |
| HTTP error, quota error, dropped connection, malformed JSON, per-call network timeout or unknown error | Global `rpc-outage`; keys fail closed |
| Store failure or checkpoint hash change | Do not publish the candidate checkpoint; retain the existing failure/reorg handling |

The gateway uses raw, block-pinned `eth_call` for runtime reads and decodes the
returned bytes inside a separate ABI boundary. It does not treat the generic
Viem execution wrapper as a contract fault or match RPC error messages.
Directory, block and log failures remain global. A concurrent global read
failure takes precedence over a local exclusion; started reads drain before
the elected writer returns.

## Reader budgets

These are off-chain discovery admission limits, not new contract publication
limits. Exceeding one excludes the entire runtime rather than admitting the
first N releases. The constants live only in `runtimeReadPolicy`.

| Budget | Value | Scope / failure |
| --- | --- | --- |
| Advertised tracks | 1,000 | Per runtime; `track-limit`, checked before page enumeration |
| Track-hash page | 100 hashes | Exact requested length; duplicates rejected across the inventory |
| Response bytes | 65,536 bytes | Per runtime RPC response, including JSON envelope; `response-limit` on an HTTP-success response |
| Execution gas | 5,000,000 | Per runtime `eth_call`; revert is local, an ambiguous provider rejection remains global |
| Call deadline | 10 seconds | Fetch and body completion; ambiguous network timeout remains global |
| Scan deadline | 20 seconds | Per runtime inventory plus selected releases, including queue wait; `scan-deadline` only for the actual owner cancellation |
| Outstanding work | Existing 8 default | Shared model/gateway concurrency gates also cover nested split reads |

HTTP bodies are bounded before JSON/ABI decoding. Excess cancels the stream;
a body stalled after headers is still inside the call/scan deadline. Runtime
transport retries are disabled. An elapsed scan budget cannot relabel an
unrelated provider failure as a runtime fault. Non-success HTTP responses remain
transport errors even when their bodies exceed the byte budget.

The scan deadline includes shared-queue contention: an exclusion is a bounded
reader-policy result, not proof of an artist attack. Provider latency, maximum
metadata and split fan-out require acceptance on the selected Revive artifact
before deployment; the synthetic scale fixture is not that acceptance. Raising
limits is a reviewed policy change, never an automatic per-request retry.

## Persistence, freshness and repair

A cold scan or event replay builds a candidate per runtime. A runtime failure
removes **all** its accepted releases and per-release diagnostics atomically.
Its directory membership remains with zero accepted releases. Stable sanitized
`excludedRuntimes` entries contain `runtimeAddress`, `code` and `reason`; raw
provider errors, secrets and retry timestamps are not persisted there.
Public metadata adds `excludedRuntimeCount` when nonzero. The full diagnosis
belongs to the durable catalogue snapshot, not a new public diagnostic endpoint.

Exclusions participate in the content revision/ETag and are saved with the
confirmed snapshot. They survive local base/checkpoint reload, PostgreSQL
writer handover and compact reader reuse. A failed write cannot advance the
in-memory authority or clear an exclusion. Existing schema-1 snapshots without
the optional field remain readable; no old-generation state migration is added.

On incremental replay, recheck the runtime inventory admission limit before
reading changed releases. A previously excluded runtime is fully scanned before
readmission, even when just one release event triggered the retry. Without an
event, the ordinary configured reconciliation retries exclusions (default five
minutes after catch-up), including runtimes with no accepted releases. Healthy
known-empty runtimes keep their existing skip optimization. Force reindex and
reorg reconstruction also repeat full admission. There is no manual allowlist
that can bypass these reads.

A catalogue containing healthy releases can remain `fresh` with another runtime
excluded. An all-empty catalogue retains `empty`. A healthy release still needs
the full runtime/hash/artist/source identity and independent directory, track
and access-policy checks before a key verdict. An excluded release is absent
and receives `TRACK_NOT_FOUND`, never a stale-key fallback. Previously delivered
keys and already-running listening sessions are outside catalogue revocation.

## Delivery and remaining limits

Deliver matching API writers/readers together; see the
[deployment procedure](../operations/deployment-configuration.md#catalogue-runtime-isolation-candidate-486).
The broader index remains proportional to directory size and subject to its
16-MiB shared document limit. This change does not isolate provider-wide
outages, directory failures, unbounded chain growth or log flooding. It does not
change key finality (A09), directory/ownership reconciliation (A03), NFT safety
(A04), future personhood (A06), wallet APIs or smart-contract bytecode.
