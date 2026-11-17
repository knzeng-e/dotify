# Bulletin media adapter: publication ownership and Web ciphertext path

Refs #288 / #287. Base dev `18fcdd93e19aa6eb67bc78513c3fb49db079f5d7` (merged
#365); its quality gates pass in run `41220113881`. The [previous protected
rehearsal](bulletin-protected-rehearsal-2026-10-31.md) now exercises a reusable
server-side adapter rather than its fixture-only publication callback.
[ADR 0038](../../../adr/0038-bulletin-media-adapter.md) records the decision,
limits and failure boundaries. **No live provider, app default, chain record,
account grant, signer or deployed service changes.**

## Delivered and review order

1. `services/api/src/services/bulletinGraph.ts` accepts only a complete current
   streaming directory matching its parsed manifest. It imports/readdresses a
   bounded graph, preserving exact encrypted file bytes and authenticated
   manifest fields. Its API reader verifies directory edges and raw blocks by
   CID and reconstructs only the requested playback object.
2. `bulletinMedia.ts` implements the existing `StreamingJobs.pin` interface,
   with explicit account/network/transport/budget and a separate provisioned
   custody directory. Ownership/job inventories persist after queue cleanup;
   inventory contains no key or audio bytes. A missing recorded journal, changed
   root/budget/account, unsafe state file or stale writer lock fails closed.
3. Follow its durable submission order: account barrier → pending CID and
   cumulative attempt allowance → broadcast → finalized metadata/raw readback
   → clear pending CID. Lost acknowledgements reconcile; missing uncertain
   submissions are never resent. The selected directory serializes writers;
   it cannot coordinate an account used elsewhere. Crashed writers require
   explicit operator reconciliation, not a TTL lock reset.
4. `bulletinReader.ts` can be injected into unchanged `createMediaRoutes`.
   The route checks the active catalog before fetching, refuses archives,
   queries and ranges, and returns no key. The reader bounds bytes/concurrency/
   deadlines and verifies exact CID bytes before returning an object.
5. `bulletinMedia.test.ts` covers structural/crypto and failure boundaries.
   `research/bulletin-prototype/protected-release.test.mjs` supplies actual
   generated AAC, custody queue, Web/Product signatures and key checks; it now
   uses this adapter and compares the result with the physically tested
   prototype's directory root. No runtime/registration/entitlement/storage
   model is presented as live chain evidence.

## Validation, 2026-10-31

Tested implementation: `f735998b0c12d4a51e73a63377c1b4d8f5b5ab1b`.
The complete 11-case adapter and 8-case protected runs cover `70de8987`;
the final owner-marker write optimization is additionally checked by the
three affected complete-release/reconciliation/exclusive-writer tests and strict
TypeScript checks. It writes ownership only when that account barrier changes,
while every pending CID/attempt/receipt remains durably checkpointed.

| Check | Result |
| --- | --- |
| New adapter suite | 11/11 pass, including a complete structural release exceeding the old 64-file/128-block fixture caps, durable inventory in a fresh Node process, replay/restart, cumulative allowance and corrupted/expired/unfinalized data |
| Protected generated-AAC rehearsal | 8/8 pass using the actual adapter; canonical EIP-191/sr25519 requests, denied key derivation, lost-acknowledgement queue retry, identical directory root and all-bitrate FFmpeg decode |
| Full API suite | 244/246 pass in the restricted sandbox; the two failures are loopback `listen EPERM`. Both affected files rerun with local-listener permission: 11/11 pass, including those two cases |
| API TypeScript | Strict typecheck and production build pass; compiled storage/reader modules import successfully |
| Formatting/docs | Prettier, offline backlog, local links and whitespace checked before handoff |

The structural API fixtures use encrypted placeholder init/segments, not playable
media. Only the protected research suite claims AAC frame decoding. Neither
suite measures audible first sound, actual Host signing, live quota economics,
physical protected playback or a real retention cycle.

## Storage and deployment boundaries

The four pinned directory dependencies match the prototype's versions:
`@ipld/dag-pb@4.2.0`, `ipfs-unixfs@12.0.0`,
`ipfs-unixfs-importer@16.1.5`, `multiformats@14.0.5`. Existing dependency versions
are unchanged. The API's existing test command includes the adapter suite; the
Bulletin workflow observes adapter changes and runs the updated protected
rehearsal. No frontend build or encrypted format change is required.

This preparation deliberately leaves `app.ts` composition and Pinata defaults
unchanged. The library accepts an explicitly supplied live transport; it does
not construct SDK clients, select a public deployment-pool signer or read
credentials. The prototype's owner-bound live canary transport still has its
own small budget and is not an unrestricted full-release writer.

Publication is sequential in this slice. The larger structural fixture does
not prove real-song throughput within the existing five-minute job deadline.
Measure that gate before selecting the provider; any required durable
nonce-aware pipelining belongs in a separately reviewed continuation. This is a
material activation limit, not an accepted performance result.

Before a live canary, prepare and review one concrete composition: same custody
job seam, new private receipt directory on a backed-up persistent volume,
one accountable storage signer and allowance, recoverable encrypted bundle and
permanent nonce ledger, bounded real transport, catalog/runtime registration,
Web media-reader and native-reader selection, and existing signed key route.
Then calculate the exact graph plus one renewal cycle; obtain any new network
allowance before sending it. Do not reuse a completed lab-publication budget.

A failed retry must display an actionable verification state before exposing
this provider in the public studio; `PREPARATION_FAILED` alone is insufficient
operator guidance for an unresolved broadcast. Reader/transaction deadline,
account isolation and raw-byte response checks must be validated with the real
transport. A dependency missing in the final audit blocks readiness even when
the root itself was stored successfully. No automatic renewal is implemented.

Keep W32/W33 open for that composition, live canary, physical Web/Desktop/mobile
allowed/denied playback, resource/cost measurements, uncached recovery and
recurring retention. An inventory's `ready` field describes its last successful
observation; it is not proof that the chain still retains its blocks today.
