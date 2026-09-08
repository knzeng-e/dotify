# Royalty Settlement

> **Reading level:** Plain-language explanation first, then technical mechanics.

---

## How royalties work for artists

When a listener pays to unlock a Classic-access track, the configured chain's
native token leaves their wallet and is settled by the artist's SmartRuntime.
On the current Product DevNet/Paseo Asset Hub runtime rail, that token is PAS.
There is no platform payout account and no off-chain payout schedule.

Recipients that can receive native transfers are paid immediately in the
listener's payment transaction. If one recipient rejects native tokens or uses
too much gas in its receive hook, that recipient's share becomes claimable in
the runtime instead of reverting the listener's purchase or blocking the other
recipients.

You can also split royalties with collaborators. When you register a track, you specify a list of recipient addresses and a share for each (expressed in basis points, where 10,000 = 100 %). The contract calculates the split exactly on every payment. Each share is either paid immediately or recorded as claimable for that recipient.

Everything is verifiable on-chain. Any listener can inspect the payment, settled-share, claimable-share, and claim records using a block explorer like Blockscout.

A Classic payment receipt proves that the runtime accepted the support
transaction and granted paid access. It does not prove that every recipient
received native tokens immediately, and it does not promise perpetual media
availability. Dotify opens protected playback only after the current runtime
read-back confirms both the paid record and playable access for that wallet.

---

## What you see in the artist studio

After connecting a wallet on `/artists`, the **Royalties** tab shows the
connected recipient wallet's settlement ledger across known SmartRuntimes. That
includes the wallet's own artist runtime and other artist runtimes where the
catalogue lists the connected wallet as a royalty split recipient. For each
entry you can see:

- The track that was unlocked.
- The listener's wallet address.
- The recipient wallet.
- Whether that recipient share is `Paid`, `Claimable`, `Claimed`, or a
  pre-upgrade `Legacy access` record.
- The amount in the configured runtime-native token.
- The date and time of the transaction.
- A link to the transaction receipt on Blockscout.

The settled total counts only immediately paid rows and claimable rows that were
later cleared by `MusicRoyRoyaltyClaimed`. Current claimable balances are shown
separately per runtime, and the claim action calls `musicRoyClaim(recipient)` on
each known runtime with a pending balance. Dotify does not display pending
claimable funds as already received. Pre-W05 access-payment records are kept as
legacy history because they do not contain per-recipient settlement evidence.

---

## Technical mechanics

### Royalty splits

When calling `musicRegRegister()`, the artist provides two parallel arrays:

```solidity
address[] royaltyRecipients   // wallet addresses to receive payment shares
uint256[] royaltyShares       // basis points per recipient (must sum to ≤ 10,000)
```

The remainder after all splits is sent to the original artist address stored on
the track record.
Those recipients are stored at registration for the release's payment split.
They are separate from the current track NFT owner and from the current
SmartRuntime owner.

**Example:** A track with a 30 % collaborator split.

```
royaltyRecipients = [collaborator, artist]
royaltyShares     = [3000, 7000]   // 30 % + 70 % = 100 %
```

These splits are stored in the runtime and applied on every payment.

### Payment transaction

When a listener calls `musicRoyPayAccess(contentHash)`, the contract:

1. Verifies `msg.value >= pricePlanck`.
2. Sets `paidAccess[contentHash][msg.sender] = true`.
3. Iterates the royalty recipient list and calculates `(price * bps) / 10_000` for each.
4. Sends each share with a bounded-gas native transfer.
5. Records any failed share as claimable for that recipient.
6. Sends any rounding remainder to the original artist address through the same bounded settlement path.
7. Refunds any overpayment to the caller.
8. Emits `MusicRoyAccessPaid(contentHash, listener, price)` plus per-recipient settlement events.

The `pricePlanck` field name is historical. The active EVM path stores and pays
prices as 18-decimal native token units. The frontend uses `parseEther()` for
artist price input and `formatEther()` for display, but unlock payments are
built from the catalog's authoritative `pricePlanck` when present. `priceDot`
is never used as the source of truth for an on-chain Classic payment. The
frontend derives the payment symbol from the configured chain and wraps the
native amount as a typed runtime payment intent before submitting
`musicRoyPayAccess`.

Product CASH settlement is deliberately not executable through this path. CASH
lives on People chain while Dotify runtime entitlements live on Asset Hub, so
that future flow needs an explicit Product-confirmed receipt or bridge design.

### Royalty event structure

```solidity
event MusicRoyAccessPaid(
    bytes32 indexed contentHash,
    address indexed listener,
    uint256 amount
);

event MusicRoyRoyaltyPaid(
    bytes32 indexed contentHash,
    address indexed listener,
    address indexed recipient,
    uint256 amount
);

event MusicRoyRoyaltyClaimable(
    bytes32 indexed contentHash,
    address indexed listener,
    address indexed recipient,
    uint256 amount,
    uint256 pendingTotal
);

event MusicRoyRoyaltyPayoutFailed(
    bytes32 indexed contentHash,
    address indexed listener,
    address indexed recipient,
    uint256 amount
);

event MusicRoyRoyaltyClaimed(address indexed recipient, uint256 amount);
event MusicRoyRoyaltyClaimFailed(address indexed recipient, uint256 amount);
```

`MusicRoyAccessPaid` records the access payment. The artist studio reads
`MusicRoyRoyaltyPaid`, `MusicRoyRoyaltyClaimable`, and
`MusicRoyRoyaltyClaimed` for the connected recipient address so recipient
settlement is never inferred from the full payment amount. It also keeps
pre-upgrade `MusicRoyAccessPaid` rows that have no W05 per-recipient settlement
event in the same transaction, labeling them as `Legacy access`. Block
timestamps are fetched separately to display human-readable dates.

### Claiming pending royalties

`musicRoyClaimable(recipient)` returns the pending native-token amount for that
recipient. `musicRoyClaim(recipient)` requires `recipient == msg.sender`, sends
the pending amount with the same bounded native-transfer helper, and either:

- emits `MusicRoyRoyaltyClaimed` and clears the pending balance; or
- emits `MusicRoyRoyaltyClaimFailed` and restores the balance for a later retry.

The failed-claim path does not revert, because a reverted transaction would also
discard the failure event. The caller must read `musicRoyClaimable` again before
treating the money as received.

### Runtime upgrades and clean migration

Artist SmartRuntimes are Diamond proxies. The preferred upgrade path is an
owner-signed `diamondCut` that replaces or adds only the affected pallet
selectors while preserving the runtime address, catalogue storage, paid-access
state, claimable balances, and content-key binding.

W05 adds Hardhat tasks for that path:

```bash
cd contracts/evm
npm run runtime:export:testnet -- --runtime <OLD_RUNTIME> --recipient <RECIPIENT> --out /tmp/runtime-snapshot.json
npm run runtime:royalties-upgrade:testnet -- --runtime <OLD_RUNTIME> --out /tmp/royalties-upgrade-plan.json
npm run runtime:royalties-upgrade:testnet -- --runtime <OLD_RUNTIME> --execute --confirm-plan <PLAN_DIGEST> --out /tmp/royalties-upgrade-final.json
```

The upgrade task is dry-run by default. Execution requires the current runtime
owner key, an output evidence path, and an exact fresh plan digest. It snapshots
track state before the cut, simulates the owner call, records signed/broadcast
evidence, waits for finality, verifies every royalties selector, and compares
the post-upgrade catalogue hash with the pre-upgrade hash.

Clean redeploy is a fallback, not the default. You can save a runtime snapshot
and render replay calldata for a new runtime:

```bash
npm run runtime:migration-plan -- --snapshot /tmp/runtime-snapshot.json --target-runtime <NEW_RUNTIME> --out /tmp/runtime-migration-plan.json
```

That plan does not move paid-access state or claimable balances. It also blocks
encrypted `dotify:enc:v2:` audio refs by default because content-key derivation
is bound to `chainId + runtimeAddress + contentHash`; migrating those releases
requires re-encrypting/re-uploading audio for the new runtime or an explicit
key-recovery flow.

### Human free tracking

`musicRoyRecordListen(contentHash)` is available for Human free tracks. It does not process a payment but records that a listener completed playback. This data is available for analytics. The event is:

```solidity
event MusicRoyListenRecorded(bytes32 indexed contentHash, address indexed listener);
```

This function is not yet wired in the current frontend but the contract supports it.

### Royalty data in the frontend

```
refreshArtistRoyalties() in useArtistConsole
        │
        ▼
discover known royalty runtimes for the connected recipient
        │
        ▼
musicRoyClaimable(runtime, recipient) for each runtime
client.getLogs({ address: runtime, event: MusicRoyRoyaltyPaid, recipient })
client.getLogs({ address: runtime, event: MusicRoyRoyaltyClaimable, recipient })
client.getLogs({ address: runtime, event: MusicRoyRoyaltyClaimed, recipient })
client.getLogs({ address: runtime, event: MusicRoyAccessPaid }) for legacy rows
        │
        ▼
for each log → fetch block timestamp
        │
        ▼
reconcile claimable accruals with successful claim events
        │
        ▼
build RoyaltyPayment[] sorted by blockNumber desc, logIndex desc
        │
        ▼
compute aggregates:
  totalRoyaltyWei = sum of paid + claimed amountWei
  claimableRoyaltyWei = sum of direct runtime reads
  uniqueRoyaltyListeners = distinct listener addresses
  paidRoyaltyTracks = distinct track hashes with a paid or claimed settlement
```

The `RoyaltyPayment` type is defined in `web/src/shared/types.ts`.
