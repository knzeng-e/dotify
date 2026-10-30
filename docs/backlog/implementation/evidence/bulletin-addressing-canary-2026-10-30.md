# Bulletin native addressing comparison, 2026-10-30

**Outcome: the installed Desktop reads BLAKE2b-256 blocks and named paths;
the identical SHA-256 payload times out.** This narrows the earlier
[AAC delivery blocker](bulletin-aac-host-canary-2026-10-30.md) to an observed
hash-addressing incompatibility on this Host path. It does not establish audio
playback, cold startup, mobile support or production storage readiness.

## Controlled experiment

Code revision: `19f71ab9cdaddacf8d59b3514ef0d17999d1248d`, clean tree.
The [public report and receipts](bulletin-addressing-canary-2026-10-30.json)
retain exact CIDs, finalized coordinates, quota observations, raw reads and errors.

The same public 135-byte marker was stored twice: SHA-256/raw and
BLAKE2b-256/raw. A 117-byte BLAKE2b-256 UnixFS directory links both names.
There is no audio, content key or artist data in this fixture. Three finalized
stores consumed **387 bytes and three transactions**, leaving 43 transactions.
No renewal was performed; its three-transaction budget was reserved only.
The local signing variable was removed and its absence checked afterwards.

Node RPC resolved both named paths and verified the original marker through
CID recomputation. Four reads / 504 bytes completed without a signer. This
establishes that the SHA-256 control is present on Bulletin, rather than missing
from publication.

## Installed Host result

Polkadot Desktop Dev **0.1.4-rc.3**, macOS **27.0.1**, Electron **44.4.3** /
Chromium **152.0.7977.130**. SDK pins are unchanged. Native `queryBytes` uses
`noReassemble: true`, a ten-second lookup bound and no gateway/local fallback.
The exported report is also retained in the operator's Downloads as
`bulletin-addressing-1793363773539.json`.

| Case | Native result | Observed duration |
| --- | --- | --- |
| SHA-256 raw | `CloudStorageLookupTimeoutError`, zero blocks | 10,008 ms |
| BLAKE2b-256 raw, identical payload | Verified 135 bytes | 160 ms total; raw read 158 ms |
| BLAKE2b-256 directory | Verified 117 bytes | 171 ms |
| BLAKE2b directory → BLAKE2b leaf | Verified exact marker | 32 ms |
| BLAKE2b directory → SHA-256 leaf | Directory read, leaf times out | 10,011 ms |

These are one installed-Desktop run and small-block retrieval durations. Host
cache state is unknown; the later named-path cases can be warm. They are not
cold network, mobile, media throughput or audible-start measurements. The
result agrees with the inspected upstream BLAKE2b preimage verification; it
still does not identify the installed core's exact source revision.

## Boundaries and review path

1. `hashes.mjs` / `reader.mjs`: only SHA-256 and BLAKE2b-256, exactly 32-byte
   digests; recompute every block CID, preserve codec and existing size bounds.
2. `addressing.mjs` / `canary.mjs`: exact deterministic public fixture,
   2-KiB/six-transaction store-plus-renewal ceiling, durable receipts and
   root-last publication. Uncertain submissions still require reconciliation.
3. `addressing-reader.mjs` / `host/addressing.ts`: five explicit cases,
   per-block/per-case deadlines, typed failures, no fallback. Local control
   verifies the harness only. The server's marker session contains no key and
   the audio session endpoint returns 404 for this fixture.

The [follow-up native AAC proof](bulletin-blake-aac-canary-2026-10-30.md) now
plays the generated clip to its end in Desktop. That isolated step readdresses the previously generated AAC ciphertext and
UnixFS links in BLAKE2b. It authenticates all nine audio objects unchanged
before upload, preserves the original nonce ledger, and uses the real player
in the installed Host. It is a fresh experiment with its own write budget;
marker success must not enable production media delivery.

Refs #288 / #287. Neither W32/W33 nor the public-pilot acceptance gates close.
