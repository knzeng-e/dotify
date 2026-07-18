# Dotify Audio V2 Container

`dotify.audio.v2` is the protected-audio container used by new production
uploads. The on-chain `audioRef` is:

```txt
dotify:enc:v2:ipfs://<CID>
```

The CID points to one IPFS object. That object contains a small `DAV2` header
followed by independently encrypted chunks of the original media bytes.

## Binary Layout

```txt
0..3    magic bytes: "DAV2"
4..7    uint32_be JSON header length
8..N    UTF-8 JSON header
N..end  encrypted chunks in header.chunks order
```

The JSON header has this shape:

```typescript
type AudioV2Header = {
  schema: 'dotify.audio.v2';
  version: 1;
  algorithm: 'AES-256-GCM';
  chunkSize: number;
  chunkCount: number;
  plaintextLength: number;
  mediaMime: string;
  contentHash: `0x${string}`;
  noncePrefix: string; // 8 random bytes, hex encoded
  chunks: Array<{
    index: number;
    plainLength: number;
    encryptedLength: number; // plainLength + 16-byte GCM tag
  }>;
};
```

Validation rejects unsupported versions, empty MIME values, malformed content
hashes, invalid nonce prefixes, non-monotonic chunk indexes, impossible chunk
lengths, and body-length mismatches.

## Encryption Contract

Each plaintext chunk is encrypted with AES-256-GCM:

```txt
nonce = noncePrefix(8 bytes) || uint32_be(chunk.index)
aad   = schema | version | contentHash | chunkSize | chunkCount |
        plaintextLength | mediaMime | chunk.index | chunk.plainLength
```

The resulting chunk bytes are:

```txt
ciphertext || gcmTag(16 bytes)
```

The `contentHash` is the blake2b-256 hash of the raw audio before encryption.
The content key is derived by the backend from `CONTENT_KEY_MASTER_SECRET` and
the same `contentHash`; key delivery uses the same derivation after access is
approved.

## Playback Contract

The web client resolves refs in this order:

1. Request the content key from the backend. Free tracks use the unauthenticated
   free-key path; gated tracks use the signed session path.
2. For v2 refs, try bounded Range requests against configured IPFS gateways.
   Header and first-chunk reads are hedged to a second gateway when the first
   one stalls, and the winning gateway is cached per CID for the browser
   session.
3. If the browser supports `MediaSource.isTypeSupported(header.mediaMime)`,
   decrypt chunks and append them to a `SourceBuffer`.
4. If Range or MSE is unavailable before streaming starts, or a recoverable
   gateway/MSE append error happens while streaming, fetch the full encrypted
   object, decrypt it, and play from a Blob URL.
5. If any chunk fails authentication, stop playback and surface a protected
   playback error.

Legacy refs with `dotify:enc:ipfs://<CID>` remain supported through the v1
full-file decrypt path.

## Startup Metrics

The DAV2 resolver emits a browser event for the pre-source startup path:

```typescript
window.addEventListener('dotify:dav2-startup', event => {
  console.log(event.detail);
});
```

Event phases are `key-authorized`, `gateway-selected`, `header-ready`,
`first-range-ready`, `first-chunk-decrypted`, `first-chunk-appended`,
`fallback`, and `error`. Details include the CID, selected gateway, range,
chunk index, elapsed milliseconds, whether a hedge was launched, and whether
the gateway came from the per-session winner cache.

The host playback layer also emits a browser event for media-element startup:

```typescript
window.addEventListener('dotify:host-audio-startup', event => {
  console.log(event.detail);
});
```

Host-audio phases are `source-selected`, `metadata-ready`, `first-audio`, and
`error`. `elapsedMs` is measured from the moment the selected track receives a
playable source. These events are intended for room/manual QA, Playwright
probes, and the #88 backend read-through decision; they are not persisted by
the backend yet.
