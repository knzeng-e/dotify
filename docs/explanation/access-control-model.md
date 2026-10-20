# Access Control Model

> **Reading level:** Plain-language explanation first, then technical mechanics.

---

## What access control means in Dotify

When an artist registers a track, they choose who is allowed to hear the full
recording. This choice is not a setting on a platform - it is a rule written to
the artist runtime. The API checks the current contract rule rather than
trusting a client label. Runtime ownership and upgrade authority remain separate
from track ownership; these are explained below.

Access model v2 is binary: either the listener is authorized and Dotify requests
the content key, or Dotify shows the right gate and plays no protected audio.
The old 42% preview doctrine is retired.

There are three access modes:

---

### Free

> "Everyone can listen."

In Free mode, anyone can play the track without connecting a wallet. Dotify
still publishes the audio through the protected pipeline, and the backend still
checks the artist runtime before releasing the key. That keeps the storage model
stable if the artist later changes the policy.

Free is not cryptographic revocation. If a listener receives the key while the
track is Free, they may keep it. A later flip to Classic or Human free stops
future Dotify key requests; true revocation requires key rotation and a new CID.

**When to choose Free:**

- You want the track to be playable by anyone.
- You want no wallet prompt for listeners.
- You may still want the option to change future key-release policy later.

---

### Human free

> "This track is for people, not bots."

In Human free mode, a listener unlocks full playback by proving they are a real
human using **Polkadot Proof of Personhood (PoP)**. No payment is required. The
artist sets which personhood level they require: `DIM1` or `DIM2`.

- `DIM1` - basic proof of unique humanity
- `DIM2` - higher-confidence proof (stricter verification)

The current access pallet reads the Individuality precompile in Dotify’s
application context. The former manual registrar setter is retired and reverts.
The source implements the gate, but usable end-to-end verification still depends
on a supported chain/Host and the personhood proof it exposes. When that read is
unavailable or unverified, access fails closed; a local fixture is not a live
humanity proof.

**When to choose Human free:**

- You want your music heard by real people, not scrapers.
- You do not want to charge for access.
- You want to experiment with Polkadot's identity infrastructure.

---

### Classic

> "Support once, then Dotify opens the track when the runtime still confirms
> access for your wallet."

In Classic mode, a listener pays a fixed amount of the configured chain's
native token to unlock full playback. On the current Product DevNet/Paseo Asset
Hub runtime rail, that token is PAS; a DOT-backed Polkadot Hub EVM chain would
display DOT instead. The runtime settles the configured recipient shares in
the payment transaction. A recipient that cannot accept the transfer keeps a
claimable share; success does not prove every recipient was paid immediately.
See [royalty settlement](royalty-settlement.md).

Once a listener has paid for a track, their wallet is recorded on-chain as a
Classic paid-access account. That record has no fixed expiry in the current
runtime. It is not, however, a perpetual media availability guarantee:

- inactive releases do not open, even for the original artist, NFT owner, or a
  previously paid wallet;
- if the artist changes the release away from Classic, the paid record remains
  visible but playback follows the current policy;
- if the artist later reactivates the release or changes it back to Classic,
  Dotify can verify the existing paid record again instead of asking for a
  second payment.

**When to choose Classic:**

- You want to monetize your releases directly through the runtime-native token.
- You prefer familiar pay-to-play economics.

---

## What happens when a listener has no access

1. Dotify does not request or deliver a content key.
2. No protected audio plays.
3. An access gate is shown with the appropriate action:
   - **Signin gate** - listener has no wallet connected. They must connect first.
   - **Personhood gate** - wallet is connected but lacks the required PoP level.
   - **Payment gate** - wallet is connected; a runtime-native payment is required.

The listener can choose a Free track, join a room hosted by someone with access,
or satisfy the required gate.

---

## Technical mechanics

### On-chain access check

Access is resolved by calling `musicAccCanAccess(contentHash, listenerAddress)`
on the artist's SmartRuntime. The active flag is checked first. If the track is
inactive, access is denied for everyone. For an active track, the call returns
`true` if any of the following conditions holds:

```txt
listenerAddress == original artist
OR
listenerAddress == current track NFT owner
OR
accessMode == Free
OR
accessMode == Classic AND paidAccess[contentHash][listenerAddress] == true
OR
accessMode == HumanFree AND verified Individuality level meets requiredPersonhood
```

Walletless guests probe with the zero address. That address is only granted when
the current mode is Free. Frontend access state helps present the right action;
it is not authority to deliver a key. The API verifies current access before
releasing protected material.

### Ownership and control words

Dotify keeps several facts separate:

- **Original artist**: the address stored on the track record at registration.
  In the current runtime, this address changes access mode, deactivates, and
  reactivates that release.
- **Runtime owner**: the account returned by `owner()` on the SmartRuntime. This
  owner controls pallet upgrades through `diamondCut`, but ownership transfer
  does not rewrite `ArtistDirectory.runtimeOf(originalArtist)`.
- **Track NFT owner**: the holder of the minted track NFT. The current NFT owner
  has playback access while the release is active, but NFT transfer does not by
  itself change the original artist field, runtime ownership, or stored royalty
  beneficiaries.
- **Royalty beneficiaries**: the recipients and basis-point shares stored when
  the release is registered. Classic payments use those stored splits; a payment
  receipt is evidence of settlement, not a guarantee that the media stays
  available forever.

### Payment flow (Classic mode)

```txt
listener calls musicRoyPayAccess(contentHash) with msg.value = stored track price
        |
        v
contract verifies the release exists, is active, is currently Classic, the wallet
has not already paid, and value >= price
        |
        v
records paid access and settles royalty shares, making failed recipient transfers claimable
        |
        v
refunds any overpayment
        |
        v
emits payment and per-recipient settlement events
```

The frontend watches for inclusion, then re-reads `musicAccHasPaid()` and
`musicAccCanAccess()` before presenting the track as open. If the payment was
included but playable access is not confirmed, Dotify keeps the protected audio
closed and shows the transaction hash as evidence to inspect.

### Personhood flow (Human free mode)

The current MusicAccessPallet reads personhood from the Individuality precompile,
not an artist-maintained address list. `musicAccSetPersonhoodLevel` is deprecated
and reverts. A Human free release needs the configured DIM1/DIM2 requirement to
be satisfied in the application's context; unavailable capability does not fall
back to manually declared personhood. Native Host and real-proof acceptance
remain explicit release gates.

### Denied playback and key delivery

The backend is the production key boundary. The browser asks the backend for a
content key only after the relevant access path succeeds, and for catalog-backed
encrypted tracks it includes the canonical release identity:

- `releaseId` (`runtimeAddress:contentHash`);
- artist runtime address;
- artist address;
- `audioRef`;
- content-key version.

The key service resolves that identity against the fresh confirmed catalog
snapshot, checks `ArtistDirectory.runtimeOf(artist)`, then re-reads the target
runtime's current `musicRegGetTrack(contentHash)` before deriving a key. It
does not trust frontend runtime allowlists or scan unrelated runtimes for modern
requests.

After canonical release resolution:

- Free tracks use the unauthenticated free-key route, and the backend
  re-checks that the runtime currently grants public access.
- Classic and Human free tracks use the signed session key route, and the
  backend re-checks access for the requesting wallet before returning a key.
- Room listeners never request keys. Only the host asks for a `room_host` key;
  listeners receive the WebRTC stream.

Legacy hash-only requests remain available only when the fresh catalog snapshot
contains exactly one encrypted release for the hash. If multiple runtimes claim
the same legacy v1 hash, Dotify refuses to deliver the key because v1 derivation
is content-hash based and cannot distinguish duplicate releases.

Audio is encrypted (see [content-protection.md](./content-protection.md)), so
the raw IPFS file cannot be played directly even if the URL is discovered.

### Access check caching

The frontend runs `checkTrackAccess()` for every track in the catalog on load
and whenever the connected wallet changes. Results are stored in
`catalogAccessByTrackId` (a `Record<string, boolean>`). This is re-evaluated
when:

- The catalog reloads.
- The `listenerEvmAddress` changes (wallet connect / disconnect).
- A payment completes successfully.
- A selected track is opened again after a policy change.
