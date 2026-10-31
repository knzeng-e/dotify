# Bulletin lab 0.3.0 publication, 2026-10-31

**Available: `dotify-bulletin-lab.dot`, Product `[0,3,0]`, generated 64-second clip.** Refs #288 / #287. The [reviewed finalization comparison](bulletin-finalization-control-2026-10-31.md) is now published from clean merged `dev` `20ff46df0d5a7c5716dc77afd14d06b4a223ff31`. This is a diagnostic, not a confirmed fix for the [paired cuts near 46 seconds](bulletin-continuity-publication-2026-10-31.md#native-acceptance-and-next-test).

## Verified release

The exact source passed [all dev quality gates](https://github.com/knzeng-e/dotify/actions/runs/41197218263) before signing.

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

Storage root: `bafybeigzctcqwwfcv7vm2psyuml2dpsbdobknbzx7tqj23ztfgppaty5ja`.

CAR SHA-256: `4c1d135bb97aa2d5fb4409f56701dbaedfda9b23249ae8bb205df0b29807f1d0`.

Audio root remains `bafykbzacecj2qvfpqevlm6pqkm24fjcmszi6qd5r3ywikxfxx5yhjqsyorot4`. No re-encryption or audio upload occurred. Read-only audit verified all 66 retained raw audio blocks (including archive dependencies); a separate traversal authenticated/decrypted 51 playback objects without fetching the archival master. Five retained Product blocks were also checked before reuse. The [machine-readable evidence](bulletin-finalization-publication-2026-10-31.json) preserves exact storage positions, quotas and before/after records.

Only the diagnostic root/app records changed; root display metadata is unchanged. Ordinary `dotify-test01.dot` root/app records remain identical to their before snapshots. No service restart, new domain, subscription, artist publication or production storage setting was involved. The local signer was removed and its empty state checked without saving/displaying a value.

## Retention and recovery

The reused icon is the earliest-expiring dependency: observed expiry block 1477259. Recheck all retained dependencies before delayed tests. Keep the 82 audio and nine Product renewal transactions reserved; no renewal was sent or scheduled. Preserve the permanent generated-fixture nonce ledger and all publication intents. A late/uncertain failure must reconcile CID/nonce/record state before any retry; a missing reused dependency requires a new reviewed plan, not an implicit upload. A reviewed lab-only rollback must also check retained bytes and Host version behavior. Stopping use of the lab does not change ordinary Dotify.

## Physical iPhone handoff

1. Copy important old reports before reopening the Product. Verify footer **Bulletin lab 0.3.0**, duration **01:04**, and **Stream finish experiment**.
2. Select **Bundled decoder control (not Bulletin)** and **After final append (baseline)**. Keep the same phone/volume/foreground conditions, listen through 64 seconds, use **I heard a cut** after any gap, check heard-audio if appropriate and copy the notebook report.
3. Repeat with **Near playback end (experiment)**. Both reports must have `finalizationExperimentApplied: true`; a standard/Blob reader cannot validate this managed control. Compare actual end-of-stream call positions and subjective cut timing, not only `playing`/`ended` events. Human markers include reaction delay.
4. If timing implicates finalization, repeat native Bulletin before proposing a production change. The [first physical baseline](bulletin-finalization-mobile-2026-10-31.md) now has two human cut markers; the near-end comparison is pending. Cold audible startup, background/network recovery, artist access and recurring retention remain separate gates. The adjacent publication JSON remains the snapshot taken before this physical report.
