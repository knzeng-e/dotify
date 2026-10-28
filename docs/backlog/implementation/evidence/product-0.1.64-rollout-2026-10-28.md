# Product 0.1.64 rollout, 2026-10-28

Refs #88 and [W08](../W08-first-sound.md). Packages merged #342; release record
[PR #343](https://github.com/knzeng-e/dotify/pull/343). This is a client publication,
not physical mobile acceptance or a completed public pilot.

## Published identity

| Item | Verified value |
| --- | --- |
| Packaging source | `982d3da4b6fb92af706641dc2ff10589b6f5a73f`, clean worktree |
| Merged dev base | `dd8e9cb56651d3cbb3c09d778491e442256fc395` |
| Executable | `[0,1,64]`, `product-cdm`, `devnet` |
| Root and app CID | `bafybeiaxw3ntf7ifsleeipvysih7qotm5lv6nl7ppiijca2bhzhqtzgpau` |
| Entry | `assets/index-P8m8O5-s.js` |
| Entry SHA-256 | `903049252355e58a0eff7c3cc27ef9771efb6c48d6548ff7017b64dddc262953` |
| Config digest | `c03708e26c8e24ac2b0c0f6cf0e5a465535b064ac5b939a1971a2bf3b408cb85` |
| Registry | `0xb052E5EfC5ADEff1f21d48DEfb5169Cb394A1a73` |
| Content resolver | `0x7e75491ecfb04900EB05ee63CABA2B33900aABB5` |

The version increment is the only executable packaging change above merged dev.
The later documentation commit is not the signed source. SDK 0.39.0, Host SDK
0.28.0 and TrUAPI 0.25.0/codec 3, permissions, account index and catalog snapshot
remain unchanged. The live Host profile was checked before and during deployment.

The [startup correction](mobile-host-audio-startup-2026-10-28.md) explicitly loads
fresh authorized native media, permits Play before metadata, preserves Play/Pause
intent during loading and ends stalled preparation with an in-place retry after
60 seconds. It does not bypass access checks, run that timeout during wallet
approval, or reload an already prepared successor.

## Publication and independent readback

The authorized publication completed successfully. Bulletin pool account 1 was
checked before loading the separate DotNS owner signer: 960 transactions and
1,037,781,093 bytes remained. This account choice is not a permanent guarantee
of future authorization. No owner-as-storage fallback was used.

- Root `dotify-test01.dot` update: transaction
  `0xbfaee9e9cd8bbad3c7c1b77df3837610bb4b397bdcf7a9a27e78b7ece12917e0`,
  finalized at block 15015647.
- Atomic `app.dotify-test01.dot` contenthash/executable update: transaction
  `0x4eaaaac2e3b5ce765181bcc373ae3a6248d2ae8abfa3269243f93c0578a6b831`.
- Independent finalized read at **2026-10-28T09:57:47.924Z**, block
  **15015696**: root and app point to the expected CID; executable
  text is `{"$v":1,"kind":"app","appVersion":[0,1,64]}`.
- Independent public CAR fetch at **2026-10-28T09:58:34.825Z** returned HTTP 200,
  **13,565,550 bytes**; all **136 blocks** passed their
  content hashes. CAR SHA-256: `0831185bd4fc8bc8145a0c80c69f6c5d6f20d3ad5b266e18834dcab55e6a277e`.
- The CAR's UnixFS root `bafybeie3qz442ythyrxkuhtdh4vl2czh7cjyppcvpisso6qhwx6iurkjbm` matches the locally merkleized
  directory; the outer deployment CID represents its packaged storage form.
  Index, entry and both lazy graphics chunks match the clean local artifact
  byte-for-byte. The entry embeds the packaging source SHA above.
- Local signer removal was independently confirmed after publication; no
  phrase, content key or private media was written to the release record.

## Services and rollback boundary

No API, private custody, signaling or encoder deployment, restart, contract
upgrade, permission change or database migration was performed. API release 34,
private custody release 3 and W36 shared PostgreSQL state remain as recorded in
[the 0.1.63 rollout](product-0.1.63-rollout-2026-10-28.md). Catalog content,
content keys, sessions, receipts and replay protection are retained. Web is not
published by this operation.

Before publication, API readiness returned HTTP 200/ready, the catalog was
fresh with two releases and signaling was healthy with no active room. At
10:00:46 UTC, post-publication readiness/catalog/signaling again returned HTTP
200; readiness remained true and signaling reported zero rooms/listeners. The
existing readiness diagnostic remains degraded because the public edge lacks
a local Pinata credential; private custody owns that credential. This client
release does not broaden that secret boundary.

Compatible client rollback: Product **0.1.63**, source
`5de94989f2e36e6ee8e9e871471233e07d9381f1`, root/app CID
`bafybeigxlqyghdtxrxvyce6e5axi3milqscwx2vvvgmfnh5ktuyp5juyy4`, executable
`[0,1,63]`. Restore the retained exact artifact and both root/app records with
owner authorization, then independently verify finalized version and public
bytes. Keep current shared server state. No rollback was performed here.

## Validation and remaining gate

The exact packaging SHA passed all 12 CI checks, including Product build,
three-engine adaptive streaming, core journeys, API/shared-state, signaling and
contract/ABI validation. [Candidate CI](https://github.com/knzeng-e/dotify/actions/runs/40664151021).
The clean local frozen Product build and live Host preflight also passed.
#342's focused Chromium/WebKit audio suite passed 56 cases, including the real
transport control before readiness; its evidence records the broader checks.

Reopen Dotify in the installed Product Host and verify loaded version 0.1.64.
Test cold Back to Kemet, an already-authorized protected track and room hosting;
confirm actual audible output. Also check Play/Pause before metadata, stalled
startup retry, track replacement and background/resume on exact mobile/Desktop
Host versions. Synthetic WebKit and public artifact checks do not prove physical
Host sound or cache refresh. #88 stays open pending its device/pilot criteria.
