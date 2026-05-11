# Royalty Settlement

> **Reading level:** Plain-language explanation first, then technical mechanics.

---

## How royalties work for artists

When a listener pays to unlock a Classic-access track, the DOT goes directly from their wallet to yours. There is no platform account, no holding period, and no payout schedule. The smart contract distributes the payment the moment the transaction is confirmed.

You can also split royalties with collaborators. When you register a track, you specify a list of recipient addresses and a share for each (expressed in basis points, where 10,000 = 100 %). The contract distributes the payment proportionally in the same transaction.

Everything is verifiable on-chain. Any listener can inspect the payment records using a block explorer like Blockscout.

---

## What you see in the Artist Console

The **Royalties** tab in the Artist Console shows you a ledger of every paid unlock recorded against your SmartRuntime. For each entry you can see:

- The track that was unlocked.
- The listener's wallet address.
- The amount paid in DOT.
- The date and time of the transaction.
- A link to the transaction receipt on Blockscout.

The ledger is populated by reading `MusicRoyAccessPaid` events emitted by your SmartRuntime from block 0. This means the full payment history is always available and cannot be deleted.

---

## Technical mechanics

### Royalty splits

When calling `musicRegRegister()`, the artist provides two parallel arrays:

```solidity
address[] royaltyRecipients   // wallet addresses to receive payment shares
uint256[] royaltyShares       // basis points per recipient (must sum to ≤ 10,000)
```

The remainder after all splits is sent to the artist's address (the runtime owner).

**Example:** A track with a 30 % collaborator split.

```
royaltyRecipients = [collaborator, artist]
royaltyShares     = [3000, 7000]   // 30 % + 70 % = 100 %
```

These splits are stored in the runtime and applied on every payment.

### Payment transaction

When a listener calls `musicRoyPayAccess(contentHash)`, the contract:

1. Verifies `msg.value >= pricePlanck * 1e8` (converts Substrate planck to EVM wei).
2. Iterates the royalty recipient list and transfers `(value * bps) / 10_000` to each.
3. Sends any remainder to the runtime owner.
4. Sets `paidAccess[contentHash][msg.sender] = true`.
5. Emits `MusicRoyAccessPaid(contentHash, listener, amount)`.

The price conversion accounts for the different decimal bases between Substrate (10 decimals) and the EVM (18 decimals): `pricePlanck * 100_000_000 = priceWei`.

### Royalty event structure

```solidity
event MusicRoyAccessPaid(
    bytes32 indexed contentHash,
    address indexed listener,
    uint256 amount
);
```

The frontend fetches these events using `client.getLogs()` with `fromBlock: 0n` and the artist's SmartRuntime address. Block timestamps are fetched separately to display human-readable dates.

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
client.getLogs({ address: artistRuntimeAddress, event: musicRoyAccessPaidEvent })
        │
        ▼
for each log → fetch block timestamp
        │
        ▼
build RoyaltyPayment[] sorted by blockNumber desc, logIndex desc
        │
        ▼
compute aggregates:
  totalRoyaltyWei = sum of amountWei
  uniqueRoyaltyListeners = distinct listener addresses
  paidRoyaltyTracks = distinct track hashes
```

The `RoyaltyPayment` type is defined in `src/types.ts`.
