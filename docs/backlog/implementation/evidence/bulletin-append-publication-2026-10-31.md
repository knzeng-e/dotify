# Bulletin lab 0.3.1 publication, 2026-10-31

**Available: `dotify-bulletin-lab.dot`, Product `[0,3,1]`, generated 64-second clip.** Refs #288 / #287. The [reviewed append correction](managed-audio-append-commit-2026-10-31.md) is now published from clean merged `dev` `1e286e5c266765427a758fd119f270361acb0375`. The [paired pre-correction iPhone controls](bulletin-finalization-mobile-2026-10-31.md) retained two marked cuts despite delayed finalization. The bookkeeping regression is corrected. The [corrected physical iPhone listens](bulletin-append-mobile-2026-10-31.md) each show 16 unique appends, with owner-confirmed uninterrupted embedded control, native Wi-Fi playback, native playback during a reported Wi-Fi-to-5G switch and a complete native 5G listen. Unknown cache state limits network-performance and recovery claims.

## Verified release

The exact source passed [all dev quality gates](https://github.com/knzeng-e/dotify/actions/runs/41209440539) before signing.

| Item | Result |
| --- | --- |
| New Product stores | 4 / 392,466 bytes, within approved 4 / 392,466 |
| Reused Product / audio blocks | 5 / 66 |
| Product CAR | 5,275,932 bytes; all 31 inner blocks / seven files match |
| Independent outer readback | All nine blocks reconstruct the exact CAR |
| HTTP gateway | 200; exact CAR bytes and SHA-256 |
| DotNS signing requests | 2; not a separate confirmed-transaction count |
| Renewals submitted | 0 |
| Renewal transactions reserved | 91: existing audio 82 + Product 9 |

Storage root: `bafybeicdd55mqsdpl2nx6v3y4wgwlwveqxx7rpnpe37y3apqq2wiuvt6fi`.

CAR SHA-256: `5065b569778416e9a693851d919398d8d180637dc9f8f57b075b2b05926cc01c`.

Audio root remains `bafykbzacecj2qvfpqevlm6pqkm24fjcmszi6qd5r3ywikxfxx5yhjqsyorot4`. No re-encryption or audio upload occurred. Read-only audit verified all 66 retained raw audio blocks (including archive dependencies); a separate traversal authenticated/decrypted 51 playback objects without fetching the archival master. Five retained Product blocks were also checked before reuse. The [machine-readable evidence](bulletin-append-publication-2026-10-31.json) preserves exact storage positions, quotas and before/after records.

Only the diagnostic root/app records changed; root display metadata is unchanged. Ordinary `dotify-test01.dot` root/app records remain identical to their before snapshots. No service restart, new domain, subscription, artist publication or production storage setting was involved. The local signer was removed and its empty state checked without saving/displaying a value.

## Retention and recovery

The reused icon is the earliest-expiring dependency: observed expiry block 1477259. Recheck all retained dependencies before delayed tests. Keep the 82 audio and nine Product renewal transactions reserved; no renewal was sent or scheduled. Preserve the permanent generated-fixture nonce ledger and all publication intents. A late/uncertain failure must reconcile CID/nonce/record state before any retry; a missing reused dependency requires a new reviewed plan, not an implicit upload. A reviewed lab-only rollback must also check retained bytes and Host version behavior. Stopping use of the lab does not change ordinary Dotify.

## Physical iPhone handoff

1. Copy important old reports before reopening the Product. Verify footer **Bulletin lab 0.3.1**, duration **01:04** and default **After final append (baseline)**.
2. First select **Bundled decoder control (not Bulletin)** on the same iPhone/volume/foreground conditions, listen through 1 min 04 without pausing, mark each heard cut once, check heard-audio if appropriate and copy the report. Compare completed append counts and human cut markers with the paired 0.3.0 observations.
3. Then repeat with **Bulletin through Polkadot app**, keeping baseline finish timing. This verifies the actual retained audio delivery after the shared-reader correction. Host cache remains unknown unless independently controlled. Human markers include reaction delay; `playing` is not measured first sound.
4. The adjacent publication JSON is the snapshot taken before the physical follow-up. The [corrected physical listens](bulletin-append-mobile-2026-10-31.md) are now recorded separately, including explicit uninterrupted-listening confirmations and the raw network-switch and 5G reports. Cold audible startup, background interruption, uncached network recovery, artist access and recurring retention remain separate gates.
