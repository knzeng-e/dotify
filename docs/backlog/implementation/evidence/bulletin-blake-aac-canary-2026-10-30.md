# Bulletin native BLAKE2b AAC canary, 2026-10-30

**Outcome: the installed Desktop plays the generated AAC clip to its end
using native Bulletin preimage reads.** First `playing` event: **2,052 ms**;
end event: 8.00 seconds of media. No `waiting` event after playback starts,
`stalled` event or media error was recorded in this one eight-second attempt.
Physical audibility, cold first sound and mobile behavior remain unverified.
The deployed storage path is unchanged.

## Why this follows the marker

The [controlled marker](bulletin-addressing-canary-2026-10-30.md) established
that the installed Host reads BLAKE2b-256 CIDs while identical SHA-256 bytes
time out. The [earlier real-AAC fixture](bulletin-aac-host-canary-2026-10-30.md)
was already valid on Bulletin through Node RPC, but unavailable through the
native preimage path. This test changes addressing alone.

`readdress-aac.mjs` takes the existing **generated eight-second chord** and
rewrites its graph children first: unchanged raw ciphertext gets a BLAKE2b-256
CID; each DAG-PB node gets rewritten child CIDs and cumulative DAG link sizes.
The manifest, encrypted object bytes, generated key, scope and expected plaintext
hashes are unchanged. All nine audio objects are authenticated before creating
the new target. No encryption is repeated, no nonce ledger is copied or reset,
and the original private fixture/ledger remains intact. This research tool is
not a production migration.

## Live writes and readback

Code revision: **`69768b88601442a78894a179305211c49b28392e`**, clean tree.
[Public receipts and exported reports](bulletin-blake-aac-canary-2026-10-30.json)
contain exact roots, finalized coordinates, source identity and observations;
no key or signer material is included.

- Root: `bafykbzacecbgxu5coifnfzajpkwzuaxv36snvjfd4zqsbvpgfk4mx7mhzhtj4`.
- **16 finalized stores / 713,229 bytes**, zero reused blocks. BLAKE2b's longer
  links add 30 bytes compared with the original SHA-256 graph.
- Quota: 43 → **27 remaining transactions**. A full 16-renewal reserve was
  checked, but no renewal was performed. The local signer was removed and its
  absence checked after publication.
- Node RPC authenticated all nine audio objects at 96/160/320 kb/s without
  fetching the archival master: 29 raw reads / 460,656 bytes. Its first
  authenticated objects took 2,967 ms; this is not a player/audible measurement.
- Writes remain sequential and took roughly nine minutes for this small
  fixture. Native delivery success does not solve publication throughput.

## Installed Desktop playback

Polkadot Desktop Dev **0.1.4-rc.3**, macOS **27.0.1**, Electron **44.4.3** /
Chromium **152.0.7977.130**. Same generated fixture, local test page and existing
production streaming player. The page serves only the generated content key
from loopback; encrypted blocks in native mode come through Product SDK
`queryBytes`, `noReassemble: true`. There is no local/gateway/API fallback.
Every block CID is recomputed, then the production manifest/object verifier
checks authenticated encryption before appending media. The master is refused.

| Observation | Local decoder control | Native Bulletin preimage reader |
| --- | --- | --- |
| First `playing` event | 678 ms | **2,052 ms** |
| Media reaches end | 8.00 s | **8.00 s** |
| Progressive playback | Yes | Yes |
| Raw blocks | 6 | 6 |
| Raw encrypted/directory bytes | 99,997 | 99,997 |
| Selected rendition | 96 kb/s | 96 kb/s |
| Stall/error events | None | None |
| Operator hearing confirmed | No | No |

Native reads include the root, manifest, rendition directory, init and two
media segments. An initial `waiting` event before first playback is expected;
there is no recorded rebuffer after `playing`. The report's existing
`gateway-selected` observer phase is a generic production-player label: this
injected native reader does not call an HTTP gateway.

The reports remain in Downloads as `bulletin-audio-1793364710805.json` (local)
and `bulletin-audio-1793364899507.json` (native), and are committed in the linked
JSON. The test tab and loopback server were closed afterwards; the original
Dotify tab was preserved.

## What this proves and what it does not

**38 Node tests** cover the real encoder, authenticated audio, SHA/BLAKE CID
verification, immutable readdressing, file/DAG sizes, recovery, quota and
cancellation. **Six harness checks** cover Chromium playback for both hashes,
stop/export, five marker cases, native refusal without fallback, and local
server boundaries. Network writes are never part of CI.

This is one native Desktop clip, not a latency distribution. The page starts
with an empty application cache, but Host/peer cache state is unknown. Node
readback preceded playback. First `playing` is not measured audible first
sound; the operator-heard flag remains false. We have not tested mobile native
retrieval, prolonged listening, real artist access policy/key delivery,
full retention-window renewal, scalable publication, or a Web delivery route
for the BLAKE2b graph.

Next, distribute a generated-only mobile diagnostic through a reviewed route,
measure audible start and continuity on the actual mobile Host, and compare
with the current delivery path on the same device/network. Only then consider
an app integration proposal. Keep production Pinata and access rules unchanged;
Refs #288 / #287 remain open.
