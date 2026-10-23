# Product 0.1.58 streaming reset rollout

Status: deployed on 2026-10-22 (Europe/Paris). Real new-publication and physical
device acceptance remain open. Refs #317, #287 and #320.

## Release identities

| Surface | Verified identity |
| --- | --- |
| Application/server source | `142fc63260c0a8e390fa5da08dd03664c0d30752` (merged #321) |
| Product packaging source | `113aa9c568966f3ec271f0ee0af3526f1bcaea68` |
| Product version/profile | `[0,1,58]`, product-cdm/devnet, frozen empty catalog, unchanged permissions |
| Root/app transport CID | `bafybeiguwd2uaz7qv3l66rxpviw5aajmu6xka74vzqgd2regl2vnbh7x7y` |
| API | Fly release 29, runner `sha256:428a3a26f17f614ff44d87c4e34206cdbe2201b92d4b6aacc5e2ed8bc89b5783` |
| Signaling | Fly release 37, `sha256:a828bb3b4c6d49de066d49d7a0e3c98dc4a328e144fabdb345bf7d85f0b1d4b7` |
| Private encoder | Fly release 1, `sha256:f12d7ccc385d91e6fa72f9d6161688943e431fa82ef5a11c8ec485c4c0e1681b` |
| Factory / directory | `0x708d35eee7c1416f6d332344068be9d714aec24c` / `0x8e611ef60169f8ed93019de4a3034a504ae2ad29`, chain 420420417 |

The packaging commit changes the Product version and adds this record; it does
not change application logic relative to the tested source. Final source CI
39686042681 and exact packaging CI 39691616976 pass, including browser flows,
three-engine streaming, isolated encoder and non-root custody rehearsals.
The final browser job completed while publication was in progress; Web and
Product build checks and source CI had already passed before signing.

## Same-volume non-root maintenance

No rooms/listeners/solo sessions were active before signaling restart. The API
was stopped; its original Machine config was saved privately. The offline
maintenance image was
`sha256:bb2c8d1a003a1b9275bef04b36f3c7682397ec908b103b60eb6a92d69f9842a9`.
It inspected only the recognized catalog, receipts and revocation files.

A completed Fly snapshot `vs_Og56kLzbZRz8U2Y5k56qL48` at
2026-10-21T23:11:14Z precedes mutation, digest
`2bbc5bf3106aca52f841475e57bbe3bd3c501c762951d028587c4eb2dabfdb31`,
14-day retention. Same Machine and volume remained attached throughout.
Both one-shot inspect/apply exits were zero; content fingerprint remained
`7e4890aaab4e15c4906e8e081620ba1c5cf5bfa768ace94460efa48686b11409`.
Directory became UID/GID 1000, mode 0700; files 1000:1000, mode 0600, with
identical byte hashes. The maintenance image never served HTTP.

Fresh streaming custody was initialized exactly once as UID 1000 in
`/data/contributions/streaming`, with jobs/incoming/queue and permanent nonce
storage. Existing key master and session epoch digests are unchanged.
No old contracts, pins, contribution history, keys or revocations were deleted.
The old three-file maintenance utility must not be reapplied to the new subtree.

## Live service checks

- One API writer, 1 GiB RAM; startup `api:storage-ready` reports UID/GID 1000.
  Health/readiness return 200, `/version` matches the application SHA, new
  directory reports zero artists and `/api/catalog` is empty, healthy and indexed.
- One warm private encoder, 512 MiB, no public service/IP or volume. Only the
  new dedicated worker credential is installed there; no API/custody secret.
  From the API, a synthetic 3-second PCM signal returns a validated bundle with
  96/160/320 kbps AAC renditions (189,122 bytes); unauthenticated access returns 401.
  This checks the private encoder connection, not artist publication or Pinata.
- Live ephemeral unfunded identities proved active-session continuity across
  API restart and durable rejection of a logged-out session. Test sessions
  were signed out afterwards. No payment or content-key request was made.
- Signaling accepts Web/Product origins and rejects an unrelated Socket.IO
  origin. A temporary link-only host and wallet-free guest joined with exact
  presence, without leaking through public `/status`. It expired after disconnect.
  This proves signaling; no captured audio/WebRTC media was claimed.
- API CORS grants the configured Web and Product origins and grants no
  cross-origin access to the unrelated probe. Six read-only DevNet checks pass.

## Published client integrity

Web already serves the application source from
`https://muzinga.netlify.app/assets/index-BQohAFKj.js`, SHA-256
`ebe5c68b609c3cba240a738ef4613929c3382fa5e6393249259284cee9be6862`.
The entry contains the full merged SHA and new directory; no redundant Web
rebuild was needed. Netlify's open deploy page was stale; public bytes, rather
than that page, establish the served identity.

Product Host Remote Config matched the pinned CLI 0.20.0 profile before and
after publication. DotNS root transaction
`0xaac743770dcc57407174ae083b38d7af18b0b0fa5148bfcb171ba6d532f4b053`
and atomic app/executable transaction
`0xc3df430c4ae3dc671a1da76d6f7e546a95d0e16d3f395ba3eed348e046f2bc53`
finalized. Independent readback at finalized block 14743632 confirms identical
root/app CID and executable version 0.1.58. The local signer was removed and
its absence checked; no phrase was saved in files, command arguments or CI.

The public CAR is 13,935,309 bytes, SHA-256
`705e7f5fd3586409783befa7670cd1a5f7c78985c14075b381fffc0a0b612823`.
All 124 block hashes pass. Its logical directory root
`bafybeib34hbm2bbt6mwrdbykajxdac67ujlp7ovocw64c76bqwfqkazwry` matches
a fresh local merkleization; index and entry match the signed local bytes.
Entry `assets/index--bd3c-LE.js`, SHA-256
`7938b7f7dc5bcf035f95991298969014eb779ea3fbdeca6c394c64695acd780c`,
contains the exact packaging SHA. Retrieval succeeded without resume; this
is artifact integrity evidence, not an audio latency measurement.

## Bounded installed Desktop rendering

Polkadot Desktop Dev 0.1.3 opened `polkadot://app.dotify-test01.dot/` and
rendered the catalog empty state with Music/Rooms/You and Connect available.
Existing Host permissions were inspected only; no cache was cleared, permission
changed, account connected, location requested or payment submitted. The native
UI does not expose the loaded JavaScript SHA; this is rendering evidence only,
not installed-host audio, payment or location acceptance.

## Remaining gates and recovery

Create a fresh artist runtime and publish a new original through the ordinary
artist account/approval flow. Verify owned job recovery, Pinata readback, free
and Classic access, first sound/seek/interruption/reopen, host capture and
a wallet-free guest on Web and physical Product Desktop/mobile. No artist
transaction or funded payment was manufactured for deployment acceptance.
Native location and broader pilot/value-flow acceptance remain open.

Follow `docs/operations/streaming-publication.md` for recovery. Preserve the
latest volume, session/key custody and union of permanent nonce reservations.
Do not restore this pre-streaming backup over later publications/revocations.
Product 0.1.57 is a historical pre-reset artifact, not a compatible standalone
client rollback. Do not mix it with the fresh directory to claim working audio.
