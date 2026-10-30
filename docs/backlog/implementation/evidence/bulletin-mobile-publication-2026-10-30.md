# Bulletin mobile diagnostic publication, 2026-10-30

**Published: `dotify-bulletin-lab.dot`, Product `[0,1,0]`. The owner reports two complete native mobile listens and a completed bundled decoder control, all with sound heard. Cold-start and longer-listening acceptance remain open.**

The owner approved this independent diagnostic after #357 merged. Source is clean
`a9199f8d4ae960aa4bf154c9a624baddd7d83f89`. Refs #288 / #287; neither issue closes with a distribution check.
The [machine-readable record](bulletin-mobile-publication-2026-10-30.json) preserves the artifact, finalized storage
coordinates, resolver records and readback. The ordinary Dotify Product stays at
`dotify-test01.dot` / `[0,1,67]`; its root and executable records were checked unchanged.

## What is available

Open **`dotify-bulletin-lab.dot` in Polkadot app**, in a separate tab from Dotify.
The display name is **Dotify First note lab**. It plays only the existing generated
eight-second chord, using the native Bulletin reader first and an explicitly selected
bundled decoder control. Its intentionally public synthetic key unlocks that chord
only. No artist audio/key, wallet connection, payment, production API or storage
adapter is included. Reports stay on the device until manually copied.

A subname below Dotify was rejected as an isolation choice: the official Host
[ProductId model](https://github.com/paritytech/host-rust-core/blob/main/rust/crates/truapi/src/product_id.rs)
uses the label immediately above the TLD for product context. This is a distinct
Product with no cross-product grants, rather than another Dotify executable.
This current-source inspection is not a claim about an installed Host commit.

## Publication and verification

- CAR: **1,033,527 bytes**, SHA-256
  `6fcabc44e5e93efce476e700dfde8d64012c975d6cd58cfb4c56844ca740fa5a`.
- Storage root: `bafybeihjexkdlvkggoswpskkgcxxxeqphtlwid25ghqzv4doi72toazybi`.
- The approved ceiling was five stores / 1,069,630 bytes. **Four new stores /
  1,033,681 bytes** were finalized; the existing icon was reused. No renewal,
  allowance increase, paid service or production-domain update was performed.
- DotNS quoted 10 PAS of test-network value; the registration call used the
  approved 11-PAS buffered value. Network fees and contract storage deposits
  are additional; these values are not a total-cost claim.
- Nine DotNS signature requests include two resolver nonce-contention retries.
  They are not nine confirmed transactions. Registration finalized at AH block
  15112708; the final root/app record readback used block 15112785.
- The root `manifest`, `app` executable, ownership, resolver and content hashes
  were read back. Both root/app Dotify records were compared unchanged.
- All five raw stored blocks were reread by CID and cryptographically verified.
  The public gateway returned HTTP 200 with the **exact candidate CAR hash**.
  The friendly Web URL returns a Polkadot gateway shell; that response is not
  proof of Host loading or playback.
- The owner account retains **23 transactions / 7,154,766 bytes** at Bulletin
  block 1433454, covering the previously reserved 16 renewals /
  713,229 bytes for the original audio fixture. The signer was removed.

| CID | Bytes | Finalized block / storage index | Outcome |
| --- | ---: | --- | --- |
| `bafkreicgfuydfn3uhfojnsxgytol7bgx6swdkjuqzfcyu6pqtn3oxvszty` | 2,670 | 1433348 / 0 | New store |
| `bafkreiffkwh4fyrbwyqndw4ehsp3eeukok3gulylqcyi2fsowt4om7ymxa` | 1,025,499 | 1433355 / 0 | New store |
| `bafkreib7ivmzxtgh2fjtctishv5yahxn6k7ofzupxmc33pbfrfpdrvlxzi` | 5,358 | 1433361 / 0 | New store |
| `bafybeihjexkdlvkggoswpskkgcxxxeqphtlwid25ghqzv4doi72toazybi` | 154 | 1433368 / 0 | New store |
| `bafk2bzacebh4rknk6x7zl4pul7t3ff7y2pglpk5x4q2k3nxnql5ebizvgluxk` | 35,949 | 1275659 / 0 | Existing icon |

The reused icon has an earlier expiry (Bulletin block 1477259) than the new CAR
blocks (1634948 through 1634968). This is a short-lived diagnostic. Recheck retention
before a delayed test; no automatic renewal is configured or authorized.

## Deployment compatibility and failures

The live Host Remote Config matched the pinned Paseo registry/content resolver.
New-name registration required its actual protocol registry
`0xdDF3D3838Ff056F15602fC5a65927f185679C36F`, rather than the newer registrar
bundled with the deploy CLI. The controller, registrar and pricing rules were read
from that protocol registry and checked for coherence. DotNS declares 1.0.0,
above the CLI's fully verified 0.8.0 ceiling; the compatible six-field commitment
and every actual write dry-run/readback were checked. This is evidence for these
operations, not a blanket compatibility certification.

The initial local submission adapter mixed PAPI 3.3.0's transaction-creator API
with a PAPI 2 signer object. It failed **before signing or broadcasting**, leaving
quota unchanged. The operator switched to the deploy tool's existing PAPI 2.2.2,
exercised transaction preparation with a signer that refuses signing, then used
`signSubmitAndWatch` and explicit nonces for the four actual stores. Submission
intents were recorded before signing, uncertain outcomes were not retried, and
only the approved bytes/destinations were admitted. No production source changed.
The separate research pipeline still needs a matching PAPI 3 integration check
before any live throughput claim or next network run.

All twelve merged-source CI checks passed. The standalone 390-pixel Chromium
scenario passed again: native failure does not load the decoder control; the
control plays, pauses/seeks/stops and preserves reports across reload. Automated
browser evidence does not verify this deployed Product in a physical Host.
Desktop UI automation was inconclusive; no new Desktop playback result is claimed.

## Owner-reported mobile result and decoder control

Three reports supplied after publication match the exact clean source and audio
root above. Two select `native-preimage` and report running inside the Host;
the third selects `bundled-decoder-control`. All use the managed progressive
reader and reach eight seconds / `ended`, with the owner explicitly marking
audio heard.

| Attempt | Delivery | First `playing` event | Playback outcome | Playback-object reads |
| --- | --- | ---: | --- | --- |
| 1 | Native Bulletin | 1,195 ms | 8 seconds completed, sound heard | 6 / 99,997 bytes |
| 2 | Native Bulletin | 117 ms | 8 seconds completed, sound heard | 6 / 99,997 bytes |
| Control | Bundled decoder control | 112 ms | 8 seconds completed, sound heard | 6 / 99,997 bytes |

The owner supplies **Polkadot app 0.10.0(18), Wi-Fi** alongside the control.
The forms' environment/network fields are empty, so the context is an owner
note, not an automatically captured or independently controlled condition.
No raw report IDs, exact wall-clock timestamps or user agent are retained.

None contains a further `waiting` event after playback starts. The `pause`
event occurs at the eight-second endpoint immediately before `ended`; it does
not establish a manual pause or an interruption. The control's successful
playback supports decoder/managed-reader compatibility on this mobile setup.
Its object reads come from the bundle and **do not measure network delivery**.

The native repeat and control show similar `playing` times in these samples;
a five-millisecond difference is not a demonstrated performance advantage or
statistical equivalence. The first native run is slower, but these observations
cannot isolate network cost from Host caching, initialization or decoding.
The timer is the browser's first `playing` event, **not measured audible first
sound or Product download time**. The page cache is empty for each attempt;
the Host cache remains unknown and was not cleared. This is a functional native
and decoder-control result, not a verified cold/warm or API/Pinata benchmark.

Seek/stop, background/screen lock, long playback, production access and scalable
publication remain unverified. No additional Bulletin write or Product
publication was needed to collect this control.

## Physical mobile test

1. Open `dotify-bulletin-lab.dot` in the mobile Polkadot app. In **Test conditions**,
   note device, OS, Host version and Wi-Fi/mobile data if known.
2. Keep **Bulletin through Polkadot app** selected and press **Start listening**.
   If sound is heard, mark **I heard the chord on this device**. Keep a failed
   attempt too; native mode never silently falls back to HTTP or the control.
3. Copy the report under **Your test notebook**, using **Select report text**.
   Then choose **Bundled decoder control (not Bulletin)** and repeat. This isolates
   decoding; it is not a current API/Pinata performance comparison.
4. Check pause, seek, stop and a brief background/screen-lock return. Keep both
   reports before clearing data; only five attempts / 256 KiB are retained.

The eight-second chord cannot establish long listening, cold audible-start
performance, renewal automation or scalable publication. Cache state remains
unknown. W32/W33 and pilot acceptance stay open. Rollback is to stop using this
separate Product; do not alter Dotify or its storage path.
