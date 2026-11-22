# Native fresh-factory readback

Before artist onboarding on Paseo Asset Hub (EVM chain 420420417), prove that
the reviewed factory has no unfinished runtime at the captured finalized block.
An empty directory covers finalized artists only. Empty `eth_getLogs` output
does not establish that native Revive callers never started a runtime.

## Bounded proof for an empty factory

[`nativeFactoryAudit.ts`](../../contracts/evm/scripts/nativeFactoryAudit.ts)
reads native storage through locked PAPI 3.3.0. Its caller first compares the
factory bytecode to the compiler artifact, masking only compiler-declared
immutable locations. The exact on-chain code hash is then retained.

The reader requires all of the following:

1. The native endpoint reports the pinned Paseo Asset Hub genesis, and its
   finalized head is at or beyond the captured EVM block number.
2. The canonical native block/header at that number exists. At that native
   hash, `Revive.BlockHash(number)` equals the captured EVM hash. Native and
   EVM hashes are distinct; equal block numbers alone are insufficient.
3. At the same native hash, `Revive.AccountInfoOf(factory)` is a `Contract`
   whose code hash equals the reviewed deployed factory code hash.
4. Both `storage_items` and `storage_bytes` are numeric zero.

The reviewed factory stores unfinished runtime addresses and stages in its
two persistent mappings; its deployment references are immutable. Empty
contract storage therefore excludes pending entries, including ones created
through native calls. This is a state check, not a historical event inventory.
Positive counts cannot identify the artists and are **unverified**, even if
the directory is empty or all EVM logs appear successful.

The native model is documented upstream in
[Revive's block-hash storage/mapping](https://github.com/paritytech/polkadot-sdk/blob/master/substrate/frame/revive/src/lib.rs)
and [contract storage accounting](https://paritytech.github.io/polkadot-sdk/master/pallet_revive/struct.ContractInfo.html).
Live metadata supplies the actual decoded storage layout; an absent or changed
entry fails rather than guessing another representation.

## Command and output contract

Set `DOTIFY_NATIVE_RPC` to a reviewed native Asset Hub `wss://` endpoint for
`fresh:readback:testnet` and `registry:audit:testnet`. The registry task also
accepts `--native-rpc`. No private key or Host account is needed. The
[fresh-generation procedure](../how-to/prepare-fresh-testnet-generation.md)
owns the complete bytecode, binding, precision and CDM readback sequence.

`dotify.fresh-cdm-readback.v3` adds `pendingRuntimeProof` to the earlier v2
core/CDM checks. It fails without positive native evidence.
`dotify.registry-audit.v2` uses `pendingDiscovery.method`:

| Method | Complete evidence | Failure |
| --- | --- | --- |
| `revive-empty-storage` (chain 420420417) | `nativeProof` with genesis, both block hashes, block number, factory/code hash and zero counts | `status: unavailable`, detail and exit code 2; never EVM fallback |
| `evm-factory-events` (ordinary EVM networks) | Deployment block, complete paginated events and pending mapping reads | `status: unavailable` and exit code 2 |

Consumers must branch on the method: native proof has no `deploymentBlock`.
Historical v1/v2 evidence files keep their original schemas and scope.

## Trust, lifetime and remaining gates

This check trusts the selected RPCs' canonical finalized state, runtime metadata
and Revive storage accounting; it is not local consensus or Merkle-proof
verification. A 30-second native deadline closes the client and releases its
pinned head on success or failure. Missing storage, malformed values, a wrong
network, block/code mismatch, RPC failure or timeout cannot yield completeness.

Evidence describes one block and does not reserve the factory. Repeat before
artist approvals. Nonempty storage needs a separate complete native inventory;
this bounded check deliberately cannot certify it. It cannot prove that no
runtime ever existed, signer control, artist authority, native transaction V2,
beneficiary settlement or listening acceptance.

These read-only commands do not change the checked-in publication attestation,
activate services, publish a Product, or authorize a transaction. The old
attestation remains bound to its old factory until the coherent new-generation
evidence and cutover conditions are explicitly met.
