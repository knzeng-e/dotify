# ADR 0040: Verify Bulletin stores from a bounded canonical block

Date: 2026-10-31. Status: **implemented and read-tested; publication is not activated**.
Refs #288 / #287. Extends [ADR 0039](0039-bulletin-media-pipeline.md).

## Decision

Supply the prepared media adapter with an RPC reader and an explicit PAPI 3
writer composition. The API owns receipt interpretation; PAPI stays in the
isolated research/operator package, outside the API dependency graph. No
endpoint, signer or environment credential is selected by these modules.
There is no new resident service or change to the deployed Pinata path.

Use the queried CID's current retained position to select **one candidate
block**. Establish that its number is finalized, resolve its canonical hash,
then inspect its extrinsics and events. The returned body header must agree
with the selected canonical header, including both state and extrinsics roots. This avoids an unbounded history scan
or an external transaction indexer. CID presence itself still proves nothing
about the submitting account.

`lookupSubmission` now receives `{ cid, nonce, afterBlock }`. The CID comes from
the existing pending-map key, so v2 journals and their custody rules do not
change. The verifier requires:

1. A canonical retained CID position after the intent's `afterBlock`.
2. Exactly one signed extrinsic matching the selected account and nonce.
3. A **direct** `TransactionStorage.store_with_cid_config` call, containing
   bytes that hash to the requested BLAKE2b CID, with matching codec and size.
4. Exactly one successful `System` dispatch result and one matching `Stored`
   event in that extrinsic's event phase.
5. Agreement between the event's storage index and the retained CID position.
   The extrinsic index is a different coordinate and must not substitute for it.

The custody adapter independently retains its own finality, raw-byte, quota,
lifetime and durable nonce-cursor checks before readiness. The new transport
cannot authorize a content key, register a release or announce publication.

## Runtime and resource boundaries

Request metadata v15 explicitly: the node's ordinary v14 metadata response does
not contain runtime API definitions. Cache at most two decoded runtime contexts,
keyed by the selected RPC's runtime code hash. Storage/runtime responses are
checked against their complete canonical SCALE encoding. Copy Node Buffer views
before decoding; pooled backing storage must not influence the decoded bytes.

A candidate block's calls and events are decoded using its **parent runtime**,
which executed the block, including on an upgrade boundary. The implemented
signed format is v4 with a single `CheckNonce` extension, as observed on the
current network. Unsupported signed formats fail closed; this is not a claim of
universal runtime upgrade compatibility.

Each transport operation has a 25-second deadline, below the custody adapter's
30-second call limit. Admit at most 4,096 block extrinsics / 8 MiB of encoded
body, 8,192 events / 2 MiB, 1 MiB of metadata and 512 KiB per raw block. Check the
event count before decoding its vector. The PAPI composition caps concurrent
RPC requests at sixteen, and a cancellation destroys its exclusively owned
client as well as unsubscribing the transaction observer.

These bounds apply to decoded responses/application waiting. PAPI's provider
allocates JSON before this module can validate its size; production composition
still needs a reviewed wire-frame/response limit. The selected node remains a
trust boundary for canonical hashes, state and finality. This does not implement
a light client, verify block trie proofs or independently recheck signatures.

## Write ownership and failure

`createPapiMediaTransport` takes ownership of a dedicated caller-created client.
It requires explicit account/network identity and a bounded immutable session
allowance. A writer additionally requires the caller's matching account and
PAPI 3 transaction creator. It never loads an environment mnemonic or chooses a
wallet. Signer derivation and public-account verification remain the operator's
separate responsibility before supplying that creator.

Session reservations are serialized and count attempts before transaction
construction. Nonces cannot be reused by that session. Quota checks account for
concurrent reservations not yet reflected in the observed finalized head.
The upstream custody journal remains the durable authority across restarts;
a fresh transport is not permission to clear an old intent or reset allowance.

Invoke one direct PAPI store with the supplied nonce; never wrap it in a batch,
renew automatically or retry it. Wait for finalized dispatch success, extract
the storage event index, and check CID metadata readback. The custody adapter
then performs the independent exact-submission verification above. On an
uncertain outcome its pending intent/account barrier survives. Cancellation or
closing the client does not retract a broadcast; reconstruct a dedicated client
for later explicit reconciliation.

## Alternatives and remaining gates

A full history scan is more general but adds unbounded recovery time and node
load. A transaction indexer adds another operational dependency. The candidate
block approach is small and bounded, with an explicit limitation: if another
store or renewal replaces the CID's latest pointer before reconciliation, the
original sender/nonce may no longer be provable through this path. Recovery also
requires the node to retain the candidate block body, events and parent metadata;
CID retention alone does not guarantee that historical execution data is available. Keep the
intent unresolved and require operator evidence; do not infer failure or resend.

A read-only check on the configured node verifies the previously published
117-byte synthetic directory marker at block 1429874: sender nonce 927,
extrinsic index 2, storage index 0. The captured public body/events and v15
metadata support offline regression tests. This check sent no transaction and
used no signer. It is not new publication, throughput, protected-access or
audibility evidence.

Before a signed canary: review the explicit operator composition, coherent
private-state backup/restore and client/provider limits, prepare a generated
protected fixture with a precise store/byte/renewal budget, and obtain the
owner's approval for those writes. Then measure actual publication duration,
resource costs and protected Web/Host playback. Previous lab publication budgets
are complete and cannot be reused. Recurring retention and production provider
activation remain separate gates.
