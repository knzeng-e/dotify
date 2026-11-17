# Bulletin manual network canary, 2026-10-29

Refs #288/#287; extends the [offline prototype](bulletin-prototype-2026-10-29.md).
Base: tested `dev` `50490cb31958248f7d11a0b8f9763aa27cb8b67a`, resumed in the
existing #354 draft. This experiment does not activate a production provider.

## Design and execution limits

`live-transport.mjs` verifies genesis, authorization summary, storage hash/codec,
size and expiry against a pinned finalized PAPI snapshot. It reads raw blocks
through `bitswap_v1_get`, the method used by the official Bulletin console.
RPC errors and missing/expired metadata fail closed. The SDK preserves each
existing block's SHA-256 CID and waits for finality without re-chunking it.

`canary.mjs` persists one synthetic ciphertext graph and a private local test key
before any upload. A separate Node process can reopen those exact bytes and
receipts without re-encryption. Its exclusive operator lock prevents concurrent
processes and survives abrupt termination for manual reconciliation. A pending
write is never retried merely because a CID is temporarily absent. The signer
must arrive on an explicit local descriptor and match the owner-selected account;
no automatic environment lookup, public dev signer or DotNS update exists here.

The graph is 19 blocks / 870,498 bytes. The local ceiling is 1 MiB stored bytes
and 40 attempted transactions per command; planned consumption is 19 stores and
19 immediate one-off renewals. Reopening a completed publication should issue
no additional store. `renew-now` uses `forceRenew`; `renew` only schedules at the
retention boundary and would not prove immediate extended retention. Verification
must observe later finalized storage positions and readable bytes for every
dependency, not only the root. No recurring registration is enabled.

## Read-only preflight

At 19:35 UTC the adapter verified the pinned genesis
`0xe101f0fa4627d29a257645e02be86d80378fea1a2bf8fa6a918d150ebc760a59`
at finalized heads 1,419,950–1,419,951. The account selected by the owner had
100 unused transactions, 10,485,760 unused bytes and renewal allowance of the
same size, expiring at block 1,621,405. No write occurred during this check.

A separate raw read of the already-public Product 0.1.67 app root returned 807
bytes; its finalized metadata agreed on SHA-256, DAG-PB codec, size and storage
position (1,417,277, 0). This verifies the RPC/decoder boundary, not the canary's
media delivery or physical Host support.

## Validation and remaining gates

### Operator correction and validated implementation, 2026-10-30

The first operator invocation stopped with `ENXIO` before any storage submission:
`npm run` did not preserve the extra signer descriptor. The temporary signer was
removed automatically. The corrected command invokes Node directly and validates
the descriptor/account before opening a network connection. A real-shell pipe
test now covers this boundary without a secret or network call.

Unsigned call-encoding checks also caught an SDK example/API mismatch: SDK 0.5.0
requires numeric `HashAlgorithm.Sha2_256`, despite string examples in its comments.
The additional regression exercises the actual SDK hash preparer, CID calculation
and SCALE enum construction; only signing/broadcast is replaced. It verifies raw
and DAG-PB CIDs rather than merely checking builder options.

All **26 tests pass** locally and in the [dedicated Linux workflow](https://github.com/knzeng-e/dotify/actions/runs/40978575683)
on implementation `7d17b272224ec7f76c16f46c557d01f135e29ef9`. An unsigned live
metadata check encodes the store call and confirms immediate renewal compatibility;
it submits neither call. The same persisted fixture is used for the live run.

The offline suite covers consumed-vs-allowed counters, wrong chain/account,
unfinalized or substituted metadata, RPC corruption/timeouts, explicit signer
input, private fixture preservation and overlapping operators, in addition to
the previous directory/nonce/recovery scenarios. CI never invokes the live CLI.

### Live storage and read-only recovery, 2026-10-30

The owner temporarily reactivated the local signer. Implementation `7d17b272`
stored all 19 blocks, including the unchanged root
`bafybeigxn7eqo72r2zjyd7drktzqaoi7nubl74zthst4lf2vej7y2mozua`.
The initial 12-minute command limit stopped the process after 18 receipts were
checkpointed while the root was still pending locally. Read-only reconciliation
found the root finalized at (1,422,766, 0), verified all 19 block hashes/metadata
and rebuilt the checkpoint with **zero additional stores**. The original process
was confirmed stopped before removing only its stale operator lock. Ciphertext,
key, nonces and pending journal were preserved; the pending root was cleared only
after finalized lookup and readback. The signer was removed on timeout.

After the 19 stores and read-only resume, quota was 81 transactions and
9,615,262 stored bytes remaining; renewal allowance was still 10,485,760 bytes.
This is exactly 19 transactions / 870,498 bytes consumed. Store positions span
blocks 1,422,653–1,422,766. Roughly twelve minutes for this sequential publication
is an explicit throughput limitation, not a speed improvement. A production
writer needs separately designed/measured bounded scheduling or batching.

The nine streaming objects (init and both segments for 96/160/320 kb/s) passed
v3 authentication/decryption and plaintext-hash comparison. Startup fetched
28,767 bytes in eight raw-CID reads, with no archival-master block; the complete
read proof used 29 reads / 156,887 bytes. First authenticated objects took 424 ms
in this single-node, already-published path. This is not cold-cache, audible
startup or physical Host evidence, and is not a performance comparison to Pinata.

The CLI now offers signer-free `reconcile`, refuses to create write intents for
missing blocks on a read-only transport, and uses a bounded 30-minute command
deadline. Immediate renewal and its post-renewal readback completed below.
The reconciliation ran on implementation `01ada3a53077bad234c4ddc18a94d60ccfd9270b`;
all 27 offline tests pass. The [public run artifact](bulletin-network-canary-2026-10-30.json)
contains exact finalized receipts, before/after quota and selective read results,
without ciphertext, content keys, mnemonic material or private fixture files.

### Immediate renewal and post-renewal readback, 2026-10-30

Implementation `136144c4` completed 19 signed, finalized `force_renew` calls.
All 19 dependencies were then observed at later finalized storage positions,
with unchanged CIDs/sizes and later expiration blocks (minimum extension: 216
blocks). The complete graph was read back and all nine streaming objects again
authenticated/decrypted without reading the archival master. The second startup
object check fetched the same 28,767 bytes in 462 ms through the same node; the
same non-cold/non-audible limitations apply. An early immediate renewal resets
retention from its new position; it is not an extra full window beyond the old
expiry or a test of scheduled renewal at the retention boundary.

The final allowance is 62 transactions, 9,615,262 store bytes and 9,615,262
renewal bytes remaining. Total consumption was exactly **38 transactions**,
**870,498 stored bytes** and **870,498 renewed bytes**. Reads/reconciliation used
zero additional transactions. No recurring renewal was registered. The temporary
local signer is verified removed; the private synthetic fixture and permanent
nonce ledger are retained for reproducibility. The artifact includes original
and renewed receipts, exact quota snapshots and both selective read checks.

### Application CI boundary

The [27-test Linux prototype workflow](https://github.com/knzeng-e/dotify/actions/runs/40980623190)
passes on `136144c4`. A separate [full application run](https://github.com/knzeng-e/dotify/actions/runs/40980623441)
passed 284 core browser tests but failed the existing Web Audio room-sync case
(`web/e2e/room-sync.spec.ts:126`, received RMS 0 after a six-second poll). No
`web/`, `services/` or `contracts/` application file differs from the tested dev
base in this PR. Record that failure rather than attributing it to Bulletin or
claiming full CI is green. The final evidence push starts a fresh validation run;
current check status belongs to GitHub, not this historical observation.

The fixture is synthetic byte patterns, not decodable AAC. RPC reads through
one node are not Web/physical Product light-client playback, a cold first-sound
measurement, a multi-region benchmark, independent replication, a two-week soak,
an unattended renewal service or proof of economic sustainability. Pinata,
encryption/access custody, catalog, contracts and deployed services are unchanged.

Dependencies stay in the private research package (SDK 0.5.0, PAPI 3.3.0,
hdkd 0.0.32 and helpers 0.0.34). The audit reports deepmerge-ts recursive-merge
exhaustion through PAPI's CLI dependency chain and an esbuild dev-server advisory
through tsx. This command runs neither that CLI nor a dev server. SDK audit and
dependency remediation remain production integration gates; no forced upgrade
or production dependency change is bundled into this experiment.

## Reproduce and recover

Follow the [operator steps](../../../../research/bulletin-prototype/README.md#network-canary).
Never upload/commit `key.bin`, the private fixture directory or signer material.
Keep the ciphertext, nonce ledger and receipts together for exact resume. A stale
lock may be removed only after proving its process has stopped and reconciling
pending finalized storage. Do not erase pending receipts to force another write.
Remove the temporary local signer after either success or failure.

Primary reference inspected: official Bulletin source
[`e0190de9`](https://github.com/paritytech/polkadot-bulletin-chain/tree/e0190de902b41b820844ec530ec21f5af04d1f11),
`console-ui/src/lib/bitswap-rpc.ts`, `pallets/data-renewal/src/lib.rs` and
`pallets/transaction-storage/primitives/src/cids.rs`. Live metadata is authoritative
for the actual runtime; the source reference is not proof of runtime code equality.
