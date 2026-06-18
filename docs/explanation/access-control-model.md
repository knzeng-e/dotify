# Access Control Model

> **Reading level:** Plain-language explanation first, then technical mechanics.

---

## What access control means in Dotify

When an artist registers a track, they choose who is allowed to hear the full recording. This choice is not a setting on a platform — it is a rule written to a smart contract. Dotify cannot override it, and neither can anyone else.

Every listener gets a **42 % preview** for free, regardless of access mode. This lets listeners discover music before they commit to unlocking it.

There are two access modes:

---

### Human free

> "This track is for people, not bots."

In Human free mode, a listener unlocks full playback by proving they are a real human using **Polkadot Proof of Personhood (PoP)**. No payment is required. The artist sets which personhood level they require: `DIM1` or `DIM2`.

- `DIM1` — basic proof of unique humanity
- `DIM2` — higher-confidence proof (stricter verification)

The registrar (initially the artist themselves) is responsible for recording which wallet addresses hold which personhood level on-chain. Once a wallet is recognized as human at the required level, it can access the track permanently — without ever paying.

**When to choose Human free:**

- You want your music heard by real people, not scrapers.
- You do not want to charge for access.
- You want to experiment with Polkadot's identity infrastructure.

---

### Classic

> "Pay once, play forever."

In Classic mode, a listener pays a fixed amount of DOT to unlock full playback. The payment goes directly and immediately to the artist's wallet — no intermediary, no payout schedule, no platform cut.

Once a listener has paid for a track, their wallet is permanently recorded on-chain. They can return and play the track at any time without paying again.

**When to choose Classic:**

- You want to monetize your releases directly in DOT.
- You prefer familiar pay-to-play economics.

---

## What happens when a listener has no access

1. The first 42 % of the track plays.
2. Playback stops at the preview limit.
3. An access gate is shown with the appropriate action:
   - **Signin gate** — listener has no wallet connected. They must connect first.
   - **Personhood gate** — wallet is connected but lacks the required PoP level.
   - **Payment gate** — wallet is connected; DOT payment is required.

The listener can always choose to keep the preview and not act.

---

## Technical mechanics

### On-chain access check

Access is resolved by calling `musicAccCanAccess(contentHash, listenerAddress)` on the artist's SmartRuntime. This returns `true` if any of the following conditions holds:

```
listenerAddress == artist (NFT owner always has access)
OR
accessMode == Classic AND paidAccess[contentHash][listenerAddress] == true
OR
accessMode == HumanFree AND personhoodLevelOf[listenerAddress] >= requiredPersonhood
```

The frontend checks this at track selection time and caches the result in `catalogAccessByTrackId`.

### Payment flow (Classic mode)

```
listener calls musicRoyPayAccess(contentHash) with msg.value = stored track price
        │
        ▼
contract verifies value >= price
        │
        ▼
distributes payment across royalty splits (basis points)
        │
        ▼
sets paidAccess[contentHash][listenerAddress] = true
        │
        ▼
emits MusicRoyAccessPaid(contentHash, listener, amount) event
```

The frontend watches for the confirmed transaction receipt, then calls `selectTrack()` again to reload with full access.

### Personhood flow (Human free mode)

Personhood is recorded off-chain (by a registrar) and stored on-chain in `personhoodLevelOf[listenerAddress]`. Only the designated registrar address can call `musicAccSetPersonhoodLevel(listener, level)`.

In the current MVP, the registrar is set to the artist's own address at registration time. Delegation to an independent registrar is a planned improvement.

### Preview enforcement

The 42 % preview limit is enforced in the browser, not on-chain. When access is denied:

1. `useCatalog` sets `previewOnlyRef.current = true`.
2. On `loadedmetadata`, `setupPreviewLimit()` computes `audio.duration * 0.42` and stores it in `previewLimitRef.current`.
3. On every `timeupdate` and `play` event, `enforcePreviewCutoff()` pauses playback and shows the access gate if `currentTime >= previewLimit`.

Audio is also encrypted (see [content-protection.md](./content-protection.md)), so the raw IPFS file cannot be played directly even if the URL is discovered.

### Access check caching

The frontend runs `checkTrackAccess()` for every track in the catalog on load and whenever the connected wallet changes. Results are stored in `catalogAccessByTrackId` (a `Record<string, boolean>`). This is re-evaluated when:

- The catalog reloads.
- The `listenerEvmAddress` changes (wallet connect / disconnect).
- A payment completes successfully.
