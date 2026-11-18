# Finalized and current audio-key authority

This reference defines the A09 source candidate for API/client maintainers and
operators. It is not a deployment or endpoint acceptance record.
[Scope #488](../backlog/finalized-key-authority.md) follows the merged
[A01 runtime isolation](catalog-runtime-isolation.md).

## Decision

A content key is irreversible disclosure. A block hash that is canonical at
query time can still be reorganized before finality. The API therefore requires
positive access in **both finalized and current state**. Current state may deny
a finalized entitlement; it cannot independently authorize a new one.

[`chainAccess.ts`](../../services/api/src/services/chainAccess.ts) observes
`eth_getBlockByNumber("finalized", false)` and `("latest", false)` using the
configured Viem RPC client. Both must return a nonnegative block number and a
32-byte hash. Finalized cannot be above latest; equal heights require equal
hashes, and equal hashes cannot identify different heights. A racing observation
can conservatively fail and be retried. There is no fallback to `latest`, `safe`
or an N-confirmation heuristic when finalized evidence is unsupported.

The catalogue must still be fresh and match chain/directory/full release
identity. Its release `sourceBlock` must be at or below the observed finalized
height. Confirmation-depth catalogue indexing remains discovery evidence;
it does not itself finalize a purchase or transfer.

For each distinct observed hash the API independently checks:

1. `ArtistDirectory.runtimeOf(artist)` matches the requested runtime.
2. `musicRegGetTrack(hash)` matches artist, source and key version and is active.
3. `musicAccCanAccess(hash, requester)` permits the requested listening policy.

All reads use EIP-1898 `{ blockHash, requireCanonical: true }`. Distinct states
run concurrently: six contract reads plus two block observations on a cold
request. If both block identities coincide, one three-read proof is reused.
No Multicall deployment or new contract ABI is assumed. The existing queue cap,
request limits and in-process coalescing remain; this change does not establish
hosted quota or first-sound latency acceptance.

## Responses and cache

| Evidence | Result before key derivation |
| --- | --- |
| Current and finalized checks both allow | Existing allowed response and runtime-bound key scope |
| Current state denies, including a newer deactivation or policy/ownership change | Existing current-state denial; no finalized-only override |
| Current allows but finalized identity/activity/access does not | `ACCESS_PENDING_FINALITY`; retry, no unlock/payment action |
| Release source block is not finalized yet | `ACCESS_PENDING_FINALITY`; do not query a not-yet-existing finalized release |
| Finalized/current observation or either canonical-state read fails | `RPC_UNAVAILABLE`; no positive cache insertion or latest fallback |
| Catalogue is stale/unknown or source-block evidence is invalid | Existing catalogue/identity denial |

`ACCESS_PENDING_FINALITY` is an ordinary denied product response (HTTP 200),
with `hostAction: { type: "none", label: "" }` and a message to wait/retry without
paying again. Signed EVM/Product requests, identity sessions, queue preparation,
Room hosts and anonymous Free requests share the authority boundary. The client
maps this reason to its existing confirmation/retry experience. Wallet-free
Room guests still receive the host's ephemeral media stream, not source keys.
A newer denial wins even if finalized access would allow; neither state can
resurrect an inactive or identity-mismatched release.

Verdicts contain no keys. Cache/coalescing identity includes chain, directory,
requester, purpose, full canonical release and **both block numbers/hashes**.
Fresh catalogue and block observations precede every cache lookup. Changing
either identity, including a same-height head reorg, forces a new proof. The
existing 512-entry cache and original 30-second verdict expiry remain; a warm
request needs at least ten seconds of remaining validity. Coalesced callers
share the original expiry and an overlong proof denies. Key routes retain their
expiry and sign-out checks immediately before derivation.

This observes blocks at request time, not continuously. A change after that
observation can race an in-flight bounded grant. Keys already disclosed,
prepared client keys and ongoing streams cannot be recalled by finality or
revocation checks. No permanent licensing promise is introduced.

## RPC trust and delivery

The configured EVM RPC/fallback must truthfully implement finalized tags,
canonical hash reads and historical state on the selected Revive chain. This
API trusts those reports; it does not verify GRANDPA proofs or infer whether a
provider silently aliases `finalized` to `latest`. Unavailable finalized state
fails closed. Ordinary Web and Product share the server boundary; Product's
finalized submission UI remains a separate helpful check.

Before matching API/client delivery, accept these semantics on the exact
configured endpoints and test finalized payment-to-access, newer revocation,
RPC failure and retry without another payment. See the
[deployment gate](../operations/deployment-configuration.md#finalized-key-authority-candidate-488).
This source change does not switch RPCs, add environment variables, reset state,
send a transaction or deploy the owner-selected fresh testnet generation. No
on-chain storage, key derivation, permanent nonce or historical receipt format
changes. A03 ownership/directory drift and other audit findings remain separate.
