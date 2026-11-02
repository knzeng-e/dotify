# Product 0.1.69: scoped Bulletin artwork and release details

Deployment record, 2026-11-02. Refs #288/W33 and #287, which stay open.
Runtime source `84baeb490d64d1d1143b936386e463f477272f98` includes merged #374–#377 and the version
bump. [Exact-source CI](https://github.com/knzeng-e/dotify/actions/runs/41373492215)
is green. The [sanitized machine-readable record](product-0.1.69-rollout-2026-11-02.json) separates
verified deployment from the still-blocked audio publication.

## Delivered and verified

Web, both public API replicas and the existing private custody serve the same
source. Product is `[0,1,69]` on `dotify-test01.dot` and `app.dotify-test01.dot`.
Root branding/owner/resolver and lab 0.3.1 records are unchanged; finalized
DotNS readback is at Asset Hub block **15213181**.

The Product transport root is `bafybeialkhzoyxypvkua7p5lgjinaq754c5ynfgkl7jtshcentwp4zdfey`. Independent readback
verifies all **20 outer blocks**, reconstructs the **9,400,268-byte** CAR and
compares SHA-256 `bf8d05bd34cae81f05b636697967a66465f37ea58a30705876988e8394201a65` with the prepared artifact. The public
gateway serves HTTP 200 with those exact bytes. Offline verification authenticates
99 inner blocks and compares all 71 files. The previous 0.1.68 CAR was
12,857,032 bytes; this measures distribution size, not audible startup time.

Publication finalized **12 new stores / 3,544,427 bytes**, reused eight retained
blocks and used exactly two guarded DotNS signatures, inside the 20-store /
9,437,122-byte Product ceiling. The local signer was removed from launchctl
immediately after capture and its absence checked; no private key was reinstalled
or exported from custody. No artist audio, public release asset or renewal was
sent by this deployment.

Both API roles now report HTTP 200, `ready: true`, `status: ok`; the edge correctly
recognizes that Pinata credentials belong to custody, rather than degrading a
replica for missing credentials it should not hold. Netlify source identity and
its exact allowed CORS origin pass. This is source equality, not a claim that
Netlify's independently built entry bytes equal the local build.

## Activation boundary

The existing UID-1000 custody machine was briefly stopped under owner-approved
maintenance. No other account writer ran during Product publication. Snapshot
`vs_qZXaDBXZ2Aa5tzl0P9laZ` preceded rollout. The additive initializer acquired
its existing exclusive lock and bound one cover/metadata policy; comparison
confirmed the original profile, publisher, owner, audio inventory, queue and
permanent nonce ledger were unchanged. The initial automatic review refusal
was resolved by the owner's explicit downtime approval before maintenance ran.

Active custody settings:

```dotenv
STREAMING_AUDIO_STORAGE=bulletin
PUBLIC_ASSET_STORAGE=bulletin
BULLETIN_PUBLICATION_PROFILE=/data/contributions/config/bulletin-pilot.json
BULLETIN_PUBLIC_ASSET_POLICY=/data/contributions/config/bulletin-assets.json
STREAMING_STATE_PATH=/data/contributions/streaming-bulletin-pilot
```

The immutable asset policy matches the existing synthetic pilot scope and artist
`0x2f6bf01a6708c927b288a53b9fe3f9edc689ff56`. It admits one cover, at most
16 attempted stores / 512 KiB, and one metadata graph, at most four / 64 KiB.
The local repository-icon rehearsal uses eight blocks / 57,046 bytes; actual
asset publication remains an artist action. There is no Pinata fallback in
this selected path and no archive checkbox or extra storage signer in the studio.

No service, region, database, subscription, runtime or key authority was added.
The installed storage key still has the previously approved full DotNS account
authority. Profile caps limit the app; they do not restrict that key cryptographically.
Whole-volume Fly snapshots can contain it and are not an off-volume restore proof.

## Preserved blocker and next acceptance

The same audio job `c346a96f-d7f9-421b-b4f3-32923753e3b4` remains **failed,
attempts=3**, with **zero attempted stores/bytes, receipts and pending submissions**.
The service restart neither retries nor repairs it. The original 16-store / 1 MiB
allowance and encrypted preparation are preserved. A separately reviewed operator
reconciliation must authenticate/reuse that output, preserve attempts and identity,
and resume the same inventory. Do not delete/recreate the job or reset counters.

After that recovery: publish through the ordinary artist wallet, verify canonical
registration and artwork/metadata previews, then allowed/denied protected listening
on Web and physical Desktop/mobile. Configuration/readback alone proves none of
these user outcomes. Capacity stays deferred research.

After Product, **302 transactions**, **79,798,749 store bytes** and **106,084,254
renew bytes** remain authorized. Preflight reserved the previous 125 renewal slots
plus this complete Product graph, original audio and new asset obligations; no
renewal was sent. The earliest reused Product dependency expires at Bulletin
block **1477259**, observed at head **1466939**. Recheck chain
retention before delayed use; cached playback is not evidence of availability.
Conservation inventory, bounded durable renewal, representative costs and
separate encrypted-data/key restoration remain W33 gates.
