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
2. The browser uploads the raw audio to the backend.
3. The backend derives the per-track key from `CONTENT_KEY_MASTER_SECRET`.
4. The backend encrypts the audio with AES-256-GCM and pins the encrypted bytes
   to Pinata.
5. A listener or room host receives a key only after a wallet-signed request and
   a server-side runtime access check.

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
POST /api/uploads/audio
        |
        v
Backend derives key:
HKDF-SHA256(CONTENT_KEY_MASTER_SECRET, "dotify-content-key-v1:<contentHash>")
        |
        v
Backend AES-256-GCM encrypts audio
        |
        v
Encrypted bytes pinned to Pinata
        |
        v
audioRef = "dotify:enc:ipfs://<CID>"
```

The same backend derivation is used when an authorized key request succeeds, so
the delivered per-track key decrypts bytes encrypted by the upload route.

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
- runtime access through `musicAccCanAccess`.

If access is allowed, the backend returns the per-track key. If access is
denied or ambiguous, it returns a denial reason and no key.

### Decryption pipeline

```txt
audioRef = "dotify:enc:ipfs://<CID>"
        |
        v
fetchIpfsCid(CID) with gateway fallback
        |
        v
authorized key available?
        |
        +-- yes --> decrypt full audio -> Blob URL -> <audio>
        |
        +-- no  --> show unlock/personhood CTA, no audio
```

The clear audio is not persisted. It exists as an in-memory Blob/Object URL and
is revoked during normal cleanup.

### Denied playback

Access model v2 retired the 42% preview path. Restricted tracks never use the
full encrypted audio to synthesize a teaser for denied users. Direct listeners
see the appropriate unlock/personhood CTA; unauthorized room hosts stream no
protected audio until they unlock, verify, or choose a playable track.

### Encrypted audio ref format

| Prefix                    | Meaning                                    |
| ------------------------- | ------------------------------------------ |
| `dotify:enc:ipfs://<CID>` | Encrypted audio on IPFS; fetch and decrypt |
| `ipfs://<CID>`            | Plain IPFS ref                             |
| `http[s]://...`           | Plain HTTP audio URL                       |
| `blob:...`                | Local Object URL                           |
| `dotify:local:<hash>`     | Local draft audio not yet uploaded         |
