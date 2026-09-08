# Content Protection

> **Reading level:** Plain-language explanation first, then technical mechanics.

---

## What content protection means for artists

When an artist publishes protected audio, Dotify stores encrypted bytes on IPFS.
The IPFS object is public and content-addressed, but it is not directly playable
without the per-track content key.

In the production path, Dotify keeps the upload credential and master key
material in the backend API:

1. The browser computes the audio content hash.
2. The artist signs in with the connected EIP-191 or Product sr25519 identity.
3. The backend verifies that identity owns a SmartRuntime, then issues a
   single-use audio capability with a short expiry and byte budget.
4. The browser uploads the raw audio with that capability.
5. The backend validates the received media bytes and content hash, then
   derives the per-release key from `CONTENT_KEY_MASTER_SECRET`, the configured
   chain ID, the artist runtime, and the content hash.
6. The backend encrypts the audio with AES-256-GCM. New uploads use the
   chunked `dotify.audio.v2` container; older v1 encrypted blobs remain
   playable.
7. The backend pins the encrypted bytes to Pinata.
8. A Free listener receives a key only after the backend re-verifies public
   runtime access. Gated listeners and room hosts receive a key only after a
   signed session/key request and a server-side runtime access check.

Room guests never receive content keys. They receive only the ephemeral WebRTC
stream from the host.

---

## What content protection is not

Dotify protects distribution access to full source files and content keys. It is
not absolute DRM.

This means Dotify can prevent an unauthorized user from directly fetching and
decrypting the full IPFS audio through the app. It cannot prevent recording
after someone is authorized to hear a track or a room stream.

The browser-only fallback using `VITE_CONTENT_SECRET` is demo-grade protection.
That secret is bundled into the frontend, so it must not be treated as a
production key boundary.

---

## Technical mechanics

### Content addressing

When an audio file is selected, `hashFileWithBytes()` computes a blake2b-256
hash of the raw bytes. This hash becomes the content identity of the track. It
is used as:

- the `contentHash` argument in `musicRegRegister()`;
- the key in access checks on the artist runtime;
- the key-derivation input;
- the canonical identifier for IPFS metadata, Bulletin archival, and room
  metadata.

If the content changes, the hash changes. You cannot substitute a different
audio file for a registered track without creating a different content hash.

### Production encryption pipeline

```txt
Raw audio bytes
        |
        v
Browser computes contentHash
        |
        v
Signed session -> artist runtime check -> one-use audio capability
        |
        v
POST /api/uploads/audio
        |
        v
Backend derives key:
HKDF-SHA256(
  CONTENT_KEY_MASTER_SECRET,
  "dotify-content-key-v2:<chainId>:<runtimeAddress>:<contentHash>"
)
        |
        v
Backend AES-256-GCM encrypts audio as a DAV2 chunked container
        |
        v
Encrypted bytes pinned to Pinata
        |
        v
audioRef = "dotify:enc:v2:key-v2:ipfs://<CID>"
uploadRuntime = runtimeAddress used by the backend derivation
```

The same backend derivation is used when an authorized key request succeeds, so
the delivered per-release key decrypts bytes encrypted by the upload route.
The audio upload response includes the runtime address used for that derivation;
before registering a release, the artist console compares it with the current
publication runtime and retries or rejects the prepared upload if the artist
account/runtime changed.
During MSE playback, the browser imports that temporary key once and prepares a
bounded two-chunk look-ahead while appending clear chunks in order. This changes
startup latency, not authorization: room guests still receive only the host's
ephemeral WebRTC stream and never receive the key or source bytes.
The exact `DAV2` binary layout and browser playback contract are documented in
[audio-v2-container.md](../reference/audio-v2-container.md).

Audio, cover, and metadata capabilities are separate. A cover capability cannot
upload audio, and a completed capability cannot be replayed. Reserved and
completed bytes count against rolling per-artist and global quotas. File type is
derived from the received container bytes rather than the browser's MIME label;
an image renamed as audio is rejected before encryption or pinning. Failed and
interrupted storage requests release their quota reservation.

### Demo/local encryption pipeline

When `VITE_DOTIFY_API_URL` is unset, the browser can still run in demo mode:

```txt
Raw audio bytes
        |
        v
Browser derives key from VITE_CONTENT_SECRET + contentHash
        |
        v
Browser AES-256-GCM encrypts audio
        |
        v
Browser pins directly to Pinata with VITE_PINATA_JWT
```

This is useful for local demos only. Both `VITE_CONTENT_SECRET` and
`VITE_PINATA_JWT` are browser-exposed.

### Key request pipeline

For full protected playback, the browser requests a nonce, signs a content-key
challenge with the connected wallet, and sends:

```txt
POST /api/tracks/:contentHash/key-request
purpose = "individual" | "room_host"
```

The backend verifies:

- signature validity;
- nonce and expiry;
- chain ID;
- requester address;
- request purpose;
- canonical release identity against the fresh catalog read model;
- `ArtistDirectory.runtimeOf(artist)`;
- current target-runtime `musicRegGetTrack(contentHash)` state;
- runtime access through `musicAccCanAccess`.

If access is allowed, the backend returns the applicable content key. If access is
denied or ambiguous, it returns a denial reason and no key.

### Decryption pipeline

```txt
audioRef = "dotify:enc:v2:key-v2:ipfs://<CID>" # new backend uploads
audioRef = "dotify:enc:v2:ipfs://<CID>"        # legacy DAV2, v1 key scope
audioRef = "dotify:enc:ipfs://<CID>"           # legacy v1 uploads
        |
        v
fetch IPFS bytes with gateway fallback
        |
        v
authorized key available?
        |
        +-- yes --> v2: Range fetch + decrypt chunks + MSE where supported
        |           fallback: decrypt full audio -> Blob URL -> <audio>
        |
        +-- no  --> show unlock/personhood CTA, no audio
```

The clear audio is not persisted. It exists as an in-memory Blob/Object URL and
is revoked during normal cleanup.

For room and host QA, the browser emits `dotify:host-audio-startup` events when
the selected source is assigned, metadata becomes available, first audio starts,
or startup fails. The important product metric is the `first-audio` elapsed
time.

### Denied playback

Access model v2 retired the 42% preview path. Restricted tracks never use the
full encrypted audio to synthesize a teaser for denied users. Direct listeners
see the appropriate unlock/personhood CTA; unauthorized room hosts stream no
protected audio until they unlock, verify, or choose a playable track.

### Encrypted audio ref format

| Prefix                              | Meaning                                                  |
| ----------------------------------- | -------------------------------------------------------- |
| `dotify:enc:v2:key-v2:ipfs://<CID>` | New DAV2 audio encrypted with release-bound v2 key scope |
| `dotify:enc:v2:ipfs://<CID>`        | Legacy DAV2 audio using contentHash-derived v1 keys      |
| `dotify:enc:ipfs://<CID>`           | Legacy v1 encrypted audio on IPFS; fetch and decrypt     |
| `ipfs://<CID>`                      | Plain IPFS ref                                           |
| `http[s]://...`                     | Plain HTTP audio URL                                     |
| `blob:...`                          | Local Object URL                                         |
| `dotify:local:<hash>`               | Local draft audio not yet uploaded                       |
