# Content Protection

> **Reading level:** Plain-language explanation first, then technical mechanics.

---

## What content protection means for artists

When you upload an audio file to Dotify, it is encrypted in your browser before it is sent anywhere. The encrypted file is stored on IPFS — a public, decentralized network. Anyone can download it. But without the decryption key, it is unplayable noise.

The decryption key is never stored on IPFS, never sent to a server, and never leaves your configured environment. A listener can only decrypt and play the audio after their wallet passes the access check described in [access-control-model.md](./access-control-model.md).

This means:
- The IPFS URL of your audio file is not a secret.
- Even if someone finds it, they cannot play it.
- Dotify does not hold your keys — you do.

---

## What content protection is not

Dotify's current encryption is **demo-grade protection**, not production DRM. It uses a shared secret configured via an environment variable (`VITE_CONTENT_SECRET`). All tracks deployed with the same secret share the same key derivation input.

This is sufficient to:
- Prevent casual discovery of audio via IPFS URL.
- Demonstrate the encryption architecture end-to-end.

It is not sufficient to:
- Prevent a determined attacker from extracting the key from the browser bundle.
- Provide per-listener key delivery (which would require a trusted server or an on-chain key encapsulation mechanism).

Production-grade DRM is a planned improvement documented in the improvement backlog.

---

## Technical mechanics

### Content addressing

When an audio file is selected in the browser, `hashFileWithBytes()` computes a **blake2b-256** hash of the raw bytes. This hash becomes the **content identity** of the track — it is used as:

- The `contentHash` argument in `musicRegRegister()`.
- The key in `paidAccess[contentHash][listener]` on-chain.
- The input to AES key derivation.
- The canonical identifier everywhere in the system (IPFS, Bulletin, on-chain).

If the content changes, the hash changes. You cannot substitute a different audio file for a registered track.

### Encryption pipeline

```
Raw audio bytes (ArrayBuffer)
        │
        ▼
encryptTrackAudio(bytes, contentHash)
        │
        ├── key = await deriveKey(VITE_CONTENT_SECRET, contentHash)
        │       └── AES-256-GCM key via WebCrypto PBKDF2
        │
        ├── iv = random 12-byte nonce
        │
        └── ciphertext = AES-GCM.encrypt(key, iv, bytes)
                │
                ▼
        [iv (12 bytes)] + [ciphertext]   ← stored as .enc blob on IPFS
```

The encrypted file is uploaded to Pinata with the metadata tag `encrypted: 'true'`. The IPFS CID is stored in the on-chain track record as the `audioRef` field, prefixed with `dotify.enc://` to signal that decryption is required.

### Decryption pipeline

When a listener selects a track and passes the access check:

```
audioRef = "dotify.enc://<CID>"
        │
        ▼
fetchIpfsCid(CID)           ← with gateway fallback
        │
        ▼
decryptTrackAudio(bytes, contentHash)
        │
        ├── re-derive same key from VITE_CONTENT_SECRET + contentHash
        │
        └── AES-GCM.decrypt(key, iv, ciphertext)
                │
                ▼
        Clear audio bytes → Blob URL → <audio> element
```

The clear audio is never persisted — it exists only as an in-memory `Blob` and the associated Object URL, which is revoked when the component unmounts.

### Preview truncation

For restricted tracks in preview mode, decryption produces the full clear audio buffer. A Web Audio API pass then re-encodes only the first 42 % as a WAV file (`encodeAudioBufferPreviewAsWav`). The truncated WAV is played; the full clear bytes are discarded. This happens entirely in the browser — no server sees the clear audio.

### Encrypted audio ref format

| Prefix | Meaning |
|---|---|
| `dotify.enc://<CID>` | Encrypted audio on IPFS — fetch and decrypt |
| `ipfs://<CID>` | Plain audio on IPFS — fetch directly |
| `http[s]://...` | Plain audio at HTTP URL — fetch directly |
| `blob:...` | Local Object URL — use directly (upload in progress) |
| `dotify:local:<hash>` | Local draft — audio not yet uploaded |

### Key derivation

```typescript
// Pseudocode — actual implementation in utils/protectedAudio.ts
async function deriveKey(secret: string, contentHash: string): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey('raw', utf8(secret), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: hex(contentHash), iterations: 100_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}
```

The `contentHash` acts as a per-track salt, ensuring that different tracks produce different keys even from the same `VITE_CONTENT_SECRET`.
