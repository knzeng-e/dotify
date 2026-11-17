# Product 0.1.65 rollout, 2026-10-28

Refs #88 / [W08](../W08-first-sound.md). Packages merged #344/#345; release
[PR #346](https://github.com/knzeng-e/dotify/pull/346). Publication and byte
verification are complete; physical Product mobile listening remains open.

## Published identity

| Item | Verified value |
| --- | --- |
| Clean packaging source | `a553cc6a65a2f506ebcfaac2d66ce97451291d10` |
| Merged dev base | `bd813f7e49183900a5970f665e4f18e74abd674d` |
| Executable | `[0,1,65]`, `product-cdm`, `devnet` |
| Root and app CID | `bafybeicv4u5od4iqqhwoq5abhm3w3taof3di5euj3qvjo7ftkrldxnqu6y` |
| Entry | `assets/index-BS92g6Z8.js` |
| Entry SHA-256 | `04e6186c9a3949bb558ca1a39e3ed2c4f14124699737701f5645a0bd42dd3740` |
| Config digest | `4ef83a37426623fdf19c5544f30ab1d96baa190d483f6b8e6fd6896244b717ee` |
| Registry | `0xb052E5EfC5ADEff1f21d48DEfb5169Cb394A1a73` |
| Content resolver | `0x7e75491ecfb04900EB05ee63CABA2B33900aABB5` |

The version increment is the only executable packaging change above merged dev.
The following documentation commit is not the signed source. SDK 0.39.0,
Host SDK 0.28.0, TrUAPI 0.25.0, native permissions, CDM snapshots, account index
and catalog snapshot are retained. Live Product Remote Config was checked
before preparation and again during publication.

## Behavior included

The [managed AAC reader](managed-mobile-audio-2026-10-28.md) can start from early
authenticated segments when standard AAC MSE is unavailable. It honors native
demand, seeking and buffer eviction, stays at 96 kb/s, and disables URL-based
remote playback for its own sources. Standard desktop adaptation is unchanged.
The authoritative key service and manifest/segment authentication remain in
force; room guests still receive only WebRTC audio.

This also publishes #344's [Free first-sound correction](mobile-first-sound-audit-2026-10-28.md),
cached-media reauthorization and **You → About Dotify**. On a supporting mobile
engine, Technical details should identify `Progressive AAC (managed)`; the label
alone does not establish audible output. The official slogan remains
**Let the music connect the dots**.

## Publication and independent readback

Bulletin public pool account 1 was verified before the separate DotNS owner
signer was loaded: 954 transactions and approximately 1048.5 MB renew headroom
remained. Pool account 0 was unauthorized and was not used. Authorization and
quota must be checked again for any later release; no authorizer was guessed.

- Storage root was included at Bulletin block 1405188, transaction
  `0x18c2904b350d55600efc5594a591a9932b33bde7fb11f2c99f64f995f861dc7a`;
  the deploy tool verified all 18 storage chunks at finalized state.
- Root `dotify-test01.dot` update: transaction
  `0x016e77636462d33bd6fd4fe2c2ecc9528f4e6a286ee9c74b23614a81d9d1fbd3`,
  finalized at block 15029862.
- Atomic `app.dotify-test01.dot` contenthash/executable update: transaction
  `0x4aafdee41dd3b8870ba4fc621adcd82b1b147525eb188b3c3967d63c8660e0eb`.
- Independent finalized read at **2026-10-28T18:10:18.298Z**, block
  **15029892**: both names match the expected CID and executable
  `{"$v":1,"kind":"app","appVersion":[0,1,65]}`.
- Independent public CAR fetch at **2026-10-28T18:10:24.465Z**: HTTP 200,
  **13,573,056 bytes**, all **136 blocks** pass SHA-256.
  CAR SHA-256: `196d24b18d35f014d66cb2908054bbad3f0a4e4600989c422d50507a2f3f72f5`.
- The inner UnixFS root `bafybeiccncv4xo7mnqsmzob35fnict2uticndldwv6qqsbnuzwb5kkrsby` equals the freshly merkleized
  local directory. Index, entry and both lazy graphics chunks match the clean
  artifact byte-for-byte; the entry embeds the exact packaging SHA.
- Publication exited successfully and the local signer was removed and checked
  absent by the publication wrapper. No phrase or content key is recorded here.

## Web, services and rollback

Web already served merged `bd813f7e` at **2026-10-28T18:13:36.731Z**:
entry `./assets/index-D_lvQCRl.js`, SHA-256 `716da4dfc549e27f57eb8c19fd3549bcb404e992146276209b15ab59b8c2584a`,
config digest `0d504400edfc50138a9d5f6df01a95bf42d6c6ca1160b52362afe6bc6b3193e9`. Managed reader code and
mobile-width About access were verified. Later merge-triggered Web builds must
have their own served-identity check; these observations bind this artifact.

After publication, API readiness was HTTP 200/ready; the catalog was fresh with two releases;
signaling was healthy with zero rooms/listeners. All four tested ordinary Web,
Product HTTPS and native-scheme API origins returned exact allowed CORS headers.
The existing public-edge Pinata diagnostic remains degraded because private
custody owns that credential; this publication does not broaden that boundary.

No API, custody, encoder or signaling deployment/restart, database migration,
contract upgrade, permission change or infrastructure scaling occurred. Existing
W36 shared state, key/nonce custody, sessions, receipts and catalog are retained.
Services remain at the identities recorded in [0.1.63](product-0.1.63-rollout-2026-10-28.md).

Compatible client rollback: **Product 0.1.64**, clean source
`982d3da4b6fb92af706641dc2ff10589b6f5a73f`, root/app CID
`bafybeiaxw3ntf7ifsleeipvysih7qotm5lv6nl7ppiijca2bhzhqtzgpau`.
Restore the retained artifact and both DotNS records with owner authorization,
then verify finalized version and public bytes. Preserve current server state.
No rollback was performed.

## Validation and remaining gate

Merged dev passed [all Dev Quality Gates](https://github.com/knzeng-e/dotify/actions/runs/40726031903).
The exact clean packaging source passed [signer-free candidate CI](https://github.com/knzeng-e/dotify/actions/runs/40740360930)
(unit/static journey/production guards/frozen Product build), the local frozen
build and live Host checks. #345's implementation evidence records the 73 audio
browser cases, 1,039 unit cases and native local WebKit recovery. Its repaired
three-engine publication suite passed all 24 cases on Linux. These synthetic
checks do not establish physical Product mobile sound or first-sound latency.

Reopen Dotify in Product, confirm **0.1.65 / build a553cc6a**, then inspect the
reader in **You → About Dotify → Technical details**. Test cold/warm Free and
already-authorized paid playback, denial, seeking/repeat, cancellation/retry,
successive tracks, background/screen lock/resume and two-device room-host audio.
Record Host/OS/device/network and actual heard output. If compatibility is
selected, record that fact rather than claiming managed streaming is active.
No payment repetition, cost saving or public-pilot acceptance is claimed;
#88 stays open for candidate-bound physical measurements.
