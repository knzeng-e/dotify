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

The offline suite covers consumed-vs-allowed counters, wrong chain/account,
unfinalized or substituted metadata, RPC corruption/timeouts, explicit signer
input, private fixture preservation and overlapping operators, in addition to
the previous directory/nonce/recovery scenarios. CI never invokes the live CLI.

Live upload/renewal results are not yet recorded. Do not infer success from the
read-only preflight. After the run, record tested implementation SHA, exact public
receipts, before/after quota and selective read evidence here.

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
