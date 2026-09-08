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

After claiming an artist profile on `/artists`, the **Royalties** tab in the
artist studio shows the connected recipient wallet's settlement ledger for the
selected SmartRuntime. For each entry you can see:

- The track that was unlocked.
- The listener's wallet address.
- The recipient wallet.
- Whether that recipient share is `Paid` or `Claimable`.
- The amount in the configured runtime-native token.
- The date and time of the transaction.
- A link to the transaction receipt on Blockscout.

The settled total counts only `MusicRoyRoyaltyPaid` rows. Claimable rows are
shown separately, and the claim action calls `musicRoyClaim(recipient)`. Dotify
does not display claimable funds as already received.

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
`MusicRoyRoyaltyPaid` and `MusicRoyRoyaltyClaimable` for the connected recipient
address so recipient settlement is never inferred from the full payment amount.
Block timestamps are fetched separately to display human-readable dates.

### Claiming pending royalties

`musicRoyClaimable(recipient)` returns the pending native-token amount for that
recipient. `musicRoyClaim(recipient)` requires `recipient == msg.sender`, sends
the pending amount with the same bounded native-transfer helper, and either:

- emits `MusicRoyRoyaltyClaimed` and clears the pending balance; or
- emits `MusicRoyRoyaltyClaimFailed` and restores the balance for a later retry.

The failed-claim path does not revert, because a reverted transaction would also
discard the failure event. The caller must read `musicRoyClaimable` again before
treating the money as received.

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
musicRoyClaimable(artist wallet)
        │
        ▼
client.getLogs({ address: artistRuntimeAddress, event: MusicRoyRoyaltyPaid, recipient })
client.getLogs({ address: artistRuntimeAddress, event: MusicRoyRoyaltyClaimable, recipient })
        │
        ▼
for each log → fetch block timestamp
        │
        ▼
build RoyaltyPayment[] sorted by blockNumber desc, logIndex desc
        │
        ▼
compute aggregates:
  totalRoyaltyWei = sum of paid amountWei only
  claimableRoyaltyWei = direct runtime read
  uniqueRoyaltyListeners = distinct listener addresses
  paidRoyaltyTracks = distinct track hashes with paid settlement
```

The `RoyaltyPayment` type is defined in `src/types.ts`.
