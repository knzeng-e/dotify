# Bulletin media transport and direct receipts — 2026-10-31

## Outcome and source

The owner requested the next slice after merging #367. The prepared adapter now
has an RPC-backed reader and an explicit PAPI 3 writer composition. Exact store
recovery inspects one canonical candidate block rather than scanning account
history. No production composition/default, signer, store, renewal, registration
or DotNS record was changed. Refs #288 / #287; their live acceptance remains open.

- Base: tested `dev` `00424a3cf015f491cd1ddda0662bcdfb5524ae4d`, merge of #367.
- Base CI: [41240365960](https://github.com/knzeng-e/dotify/actions/runs/41240365960), successful.
- Initial implementation: `375eebdbeba5df470d5b6d7c756035552b268656`.
- Stable creator selection: `5daf19e239f6a55077bd9200ced8b759b7b0296a`.
- Final implementation: `d46a9fc58d4374564aae23a5801ca9e2a26a5ab2`.
- Branch: `feat/bulletin-media-transport`.
- Decision: [ADR 0040](../../../adr/0040-bulletin-direct-store-receipts.md).

## Read-only network observation

The explicitly configured `wss://bulletin-paseo.tservices.es:8443` reports the
expected genesis `0xe101f0fa4627d29a257645e02be86d80378fea1a2bf8fa6a918d150ebc760a59`.
The new transport reads authorization, finalized nonce, CID position and raw
bytes without a signer. A probe at head 1449285 observes account nonce 1030 and
141 remaining transactions; these are dated observations, not a future quota
reservation. Every session reports zero submitted transactions.

An independent exact-submission read verifies a marker already published during
the [addressing canary](bulletin-addressing-canary-2026-10-30.md):

| Field | Observed value |
| --- | --- |
| Capture time | 2026-10-31T21:14:47.003Z |
| Account | `5DnPdzxJWgfFuh1VYzpvz2TzU8BhPzfGKSzsDhGEkhvXEdca` |
| CID | `bafykbzacedgoz74o2gqwave7yj56rlkozrkcus4vdtntun6bc7yp64nmvslla` |
| Canonical block | 1429874 / `0xd8207e70eacb5e0554ae0a18b18fd74a91529aa8a50e53ebb3a9c12bd1db15b0` |
| Sender nonce | 927 |
| Extrinsic index / storage index | **2 / 0**, intentionally different |
| Raw bytes / observed expiry | 117 / block 1631474 |
| New stores, renewals, signer use | **0 / 0 / none** |

The query's `afterBlock` is 1429873, chosen just before the candidate for this
read-only verification. It is not a recovered historical write intent. This
proves receipt interpretation of existing chain data, not a new writer's
finalization or an actual lost-acknowledgement recovery on the live network.
The selected RPC remains trusted for canonical state/finality.

The [public fixture](../../../../research/bulletin-prototype/fixtures/bulletin-receipt.json)
contains the block body/events and synthetic directory bytes, without artist
audio, content keys or private signer material. Its parent-runtime v15 metadata
is 187,973 bytes. The test checks its SHA-256 against the fixture manifest before
building codecs. No test rebroadcasts the captured historical transaction.

A first read-only probe exposed a pooled Node Buffer offset problem in the
SCALE decoding boundary. Copying owned byte views fixes it; a pooled-view
regression test now verifies the actual signed transaction. Ordinary node
metadata defaults to v14 and omits runtime APIs; the transport explicitly
requests v15 instead of guessing definitions.

## Review path

1. `services/api/src/services/bulletinTransport.ts`: explicit RPC identity,
   metadata-by-code-hash cache, finalized CID lookup, canonical candidate block
   and parent-runtime metadata. No arbitrary history scan or endpoint default.
2. `services/api/src/services/bulletinReceipt.ts`: complete SCALE encoding,
   sender/nonce/direct-call binding, BLAKE2b payload identity, dispatch and event
   phase/storage-index agreement. Unsupported signed formats fail closed.
3. `research/bulletin-prototype/media-transport.mjs` and `finalized-store.mjs`:
   dedicated PAPI client ownership, copied signer selection/allowance, serialized
   reservations, one explicit nonced submission and abort/unsubscribe behavior.
4. API receipt tests and research composition tests, then the existing protected
   rehearsal. `bulletinMedia.ts` only adds CID to the lookup query, derived from
   its existing pending-map key; journal schema v2 and access rules stay intact.

## Automated verification

Node 22.13.1. Existing dependency/lockfile versions remain unchanged. API tests
use loopback permission where required. Network observations above were separate
manual read-only probes; automated RPC and submission cases are offline.

| Check | Result | Meaning |
| --- | --- | --- |
| Full API suite | 271/271 pass, including 10 new receipt/transport cases | Existing custody/access/media behavior plus captured receipt decoding, wrong sender/nonce, payload/index/event corruption, wrapped stores, wrong genesis, candidate mismatch, bounded responses and cancellation |
| Full research pipeline suite | 30/30 pass | Existing durable nonce/restart regressions plus explicit PAPI composition, budgets, single invocation, finality observation, cancellation/disposal and stable creator selection |
| Protected rehearsal | 8/8 pass | Existing real encoding, Web/Product signatures, canonical access denials, authenticated decode and custody retry over storage/runtime models |
| API strict typecheck, production build and compiled transport import | pass | Public query/transport contracts and built ESM imports |
| Formatting, offline backlog mapping, new relative documentation links, `git diff --check` | pass | Repository/documentation consistency |

The final API run covers the complete canonical-header check at `d46a9fc5`.
The final 30-case pipeline run covers observer extraction and immutable creator
selection at `5daf19e2`; the later header check uses the same captured fixture
and does not change PAPI submission behavior. The protected run preceded the
observer extraction and retains the unchanged key/custody boundaries. Final
production build/typecheck and import verify the server code. Read-only network
probes exercised the initial transport; final header consistency is replayed
locally from those captured inputs.
No throughput or audible-start figure is inferred from local test durations.

Tests use the real captured SCALE bytes with mutations to reject corrupted
payloads, absent/duplicated/wrong-phase events, mismatched metadata/index,
duplicate sender/nonce records, non-direct calls and trailing bytes. The RPC
fixture exercises the actual metadata-built storage keys and runtime results.
The PAPI submission observer is simulated: a passing mock does not prove a real
signer, transaction dispatch or pool behavior.

## Boundaries and next gate

The API has no PAPI 3 dependency added; the existing isolated operator package
owns that client. Neither factory selects a signer or endpoint. The signer must
be verified by the operator before supplying the explicit creator/account.
Abort destroys the dedicated client and stops observation, without retracting
an already submitted transaction. A new client must reuse the same durable job
state, never recreate custody or reset its allowance.

CID lookup selects one current retained position. If renewal or another store
replaces it, or historical body/events/parent metadata are unavailable, exact
reconciliation can remain unresolved. Keep the intent/account barrier; require
operator evidence instead of retrying. The provider remains trusted for
canonical hashes, state and finality; there is no light-client or trie proof.

The transport bounds application time and decoded response sizes, but PAPI's
initial JSON allocation is outside those checks. Review a wire-frame/response
limit, archive availability and dedicated-client disposal in production
composition. Signed v4 / metadata v15 support is verified here; broader runtime
upgrades are not claimed. No new server, gateway or hosting commitment is made.

Next: prepare and review an isolated generated protected-canary package that
binds this writer to durable custody, exact bytes/store/renewal allowances,
coherent state backup/restore and an explicit account lease. Obtain new owner
approval before any network write or signer activation; previous lab budgets
are completed. Validate real publication, lost acknowledgement/cancellation,
registration and signed denied/authorized access, Web/Host playback, duration,
memory and quota costs. Recurring retention and production provider activation
remain separate gates. See [deployment configuration](../../../operations/deployment-configuration.md#explicit-rpc-transport-prepared-not-deployed).

## Primary references inspected

- [PAPI client lifecycle and raw RPC boundary](https://papi.how/client/).
- [Bulletin direct store and event/index contract](https://github.com/paritytech/polkadot-bulletin-chain/blob/e0190de902b41b820844ec530ec21f5af04d1f11/pallets/transaction-storage/src/lib.rs).

Installed API metadata builders/bindings and PAPI 3.3.0 code were inspected too;
the captured parent-runtime metadata, rather than upstream `main`, determines
the decoding exercised by the fixture.
