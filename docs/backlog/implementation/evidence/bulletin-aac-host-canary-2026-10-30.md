# Bulletin real-AAC reader canary, 2026-10-30

**Outcome: real AAC storage/readback works; native SHA-256 CID retrieval is
blocked on the tested Desktop path.** Pinata and the deployed app are unchanged.
Refs #288 / #287; base `5b6ddec51ba4dfdc2383d7afbaf17996dfdda1a6` (merged #353/#354).
[Public receipts, quotas and exported Host reports](bulletin-aac-host-canary-2026-10-30.json)
contain no content key or signer. This research does not close W32/W33 or pilot acceptance.

## What was tested

A quiet, reproducible eight-second chord goes through the existing production
encoder: loudness measurement, FFmpeg AAC-LC at 96/160/320 kb/s, permanent nonce
reservation and authenticated v3 encryption. A fresh private key/graph is kept
separate from the previous canary. No artist recording or protected entitlement
is used. The directory has 16 blocks / 713,199 stored bytes, root
`bafybeia7ddqnsd3kuq7gigaqoppzu7pyjxcib5ijrh6n6pnwlfwrrks3pu`.

The test page injects only a ciphertext reader into Dotify's existing player.
It retains manifest/AEAD checks, standard/managed MSE and bounded Blob selection.
The same Uint8Array directory reader runs in Node and browsers, preserving CID,
byte/read/depth bounds. Three explicitly selected transports cannot fall back
to one another: local control, native preimage API, and native chain RPC.

| Check | Observed result | What it does not prove |
| --- | --- | --- |
| Real encoder/decrypt/decode | All three rates decode at least 7.8 seconds of non-silent PCM, across segment boundaries | Physical audibility |
| Live publication | 16 finalized stores, no reused blocks; about 543 seconds sequentially | Production throughput |
| Signer-free node readback | Nine init/media objects authenticated/decrypted; no archival master fetched | Host API compatibility |
| Node startup objects | 8 raw reads / 52,281 bytes / 570 ms | Cold or audible first sound |
| Chromium local control | Ends, stops cleanly, exports reports without keys; both native modes refuse fallback outside a Host | Native mobile playback |
| Installed Desktop preimage | Host detected; zero blocks returned at 10 s and 30 s; final error `CloudStorageLookupTimeoutError` | A working arbitrary-CID reader |
| Installed Desktop chain RPC | Correct genesis verified; `bitswap_v1_get` rejected as unsupported | A content-read path through this adapter |

The Desktop was Polkadot Desktop Dev **0.1.4-rc.3**, on macOS **27.0.1**,
Electron **44.4.3** / Chromium **152.0.7977.130**. It opened the loopback harness
in a separate local tab; no DotNS record was changed. The default network was
not throttled or characterized; Host cache state is unknown. The principal native observations use
clean source `be81733e38a7eccf73465caaf8b6a5b608844e4f` and
`5e3e9137f14e4cd4d6d831051d682e567352c3d5`. A preliminary RPC probe used a legacy
genesis method rejected by the adapter; the final probe uses supported
`chainSpec_v1_genesisHash` and reaches the content-method refusal. All four
exported native reports are retained. A Desktop local decoder control also
finished the clip; its unretained timing is not counted as network evidence.
No audible-start timing or physical mobile result is asserted.

Publication used source `f26a42ed`; signer-free readback used `2288ac1`. Exactly
16 transactions were attempted. The remaining transaction quota was **46**;
store/renew counters and finalized receipt coordinates are in the JSON.
Preflight reserved a further 16 transactions and a renewal-byte cycle, but no
new renewal was executed for this reader experiment. The local signer was
removed and checked absent. Private ciphertext/key/nonce state is retained for
recovery; it must never be committed or uploaded as an application bundle.

Final local verification: **31** codec/directory/recovery/quota/RPC tests and
**3** browser/server checks. The browser check covers both unavailable native
transports with no fallback, actual AAC completion/stop and secret-free export.
No live write or signer is used in CI.

## Why the native result changes the plan

The pinned Product SDK 0.39.0 / cloud-storage 0.13.3 accepts a SHA-256 CID in
`cidToPreimageKey`, then sends only its 32-byte digest to the preimage API. The
pinned host 0.28.0 adapter sends `lookupSubscribe({ request: { key } })`, without
hash-algorithm or CID-codec information. The
[upstream core snapshot](https://github.com/paritytech/trinity-user-agents/blob/ef52f3b8756046f8353cd9b910bdab95f2c358a9/rust/crates/truapi/src/runtime/capabilities/preimage.rs#L119)
expects a BLAKE2b-256 preimage and verifies returned bytes with that hash. This
is a concrete compatibility concern, consistent with the timeout; it is **not**
proof that the installed binary contains exactly that upstream revision, nor a
successful BLAKE2b media test.

The pinned SDK's `papi-provider.ts` also enumerates supported chain methods and
rejects unknown ones. The proper chainSpec probe confirms the network but the
raw content RPC remains unavailable through that provider. A node's
`bitswap_v1_get` success cannot be advertised as native support. The original
mock established only the `fetchBytes` call shape; this experiment exposes the
missing delivery guarantee rather than hiding it behind an HTTP fallback.

## Boundaries and next decision

The server binds 127.0.0.1:5278, rejects foreign Host/origin/cross-site/write
requests, loads no deployment environment and serves only the private generated
fixture. Its synthetic key is local and omitted from reports. Stop/ended/error
release audio resources, URLs and any RPC client. Source SHA/dirty state is read
for every attempt. Native save dialogs keep the report Blob alive for a minute;
the initial immediate revoke was corrected and actual Desktop exports succeeded.

There is no unattended writer, recurring renewal scheduler, production storage
adapter, access-policy change, public preview or mobile distribution. The local
test tab/server were closed after exporting the native reports. Production keys,
contracts, artist data, Host permissions and origins are unchanged.

The next narrow proof should compare a **new, small BLAKE2b-addressed fixture**
with the current SHA-256 control, checking directory resolution and IPFS
interoperability explicitly. A Host CID-aware API that preserves hash/codec
information is the other route for unchanged SHA-256 addresses. Neither is
implemented or authorized to replace storage by this PR. Do not rewrite the
existing canary, republish it blindly, increase timeouts as a performance fix,
or expose the local key endpoint to get a mobile preview.

Only after a native delivery path works should we compare audible first sound,
continuity and longer clips on the same devices/networks, then test mobile and
retention-window/scheduled renewal. Sequential storage still needs a separate
throughput design. The remaining W32/W33 acceptance gates stay open.
