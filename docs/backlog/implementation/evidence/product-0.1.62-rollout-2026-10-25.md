# W34 rollout: API/Web and Product 0.1.62 published

Refs #289 and #317. W34 merged in #333 at tested `dev`
`c71947a294907bdaf0a92ea0c544876fa39309d4`. Merged-dev quality gates
[40147843391](https://github.com/knzeng-e/dotify/actions/runs/40147843391)
pass in full. Clean packaging commit
`781f1c598885714288bdec02df488fd03d7f2602` changes only the Product executable
version to `[0,1,62]`. The signing worktree stays detached at that SHA;
subsequent documentation commits do not change the signed executable.

## API publication and observed interruption

API release **32** runs image
`registry.fly.io/dotify-api@sha256:8ee63c7ded1357acc2c454effea7645e2360838a14a359c1a8cd0e19c51c632f`.
`GET /version` reports the packaging SHA above. One machine
`802034f6565958` retains volume `vol_42kj9wq1q97njm14`, UID/GID 1000,
1 GiB memory and all existing secret names, origins and persistence paths.
The API deployment performed no data reset, custody initialization, secret
rotation or core-contract write.
Signaling and the encoder were not restarted. Signaling reported zero rooms
and zero listeners before the API deployment.

The initial release 30 passed readiness but one real public Free-key request
returned `RPC_UNAVAILABLE`. The operator immediately restored the prior API 29
image as release 31, preserving the current volume; the public Free request
then passed. The failure could not be reproduced by the actual access service
locally or by concurrent exact-block reads from Fly. The identical W34 image
was reapplied as release 32, without code or authorization-policy changes.
Eight consecutive Free requests then passed across seven observed block heads.
This records an unclassified transient chain-read failure, not a diagnosed or
fixed RPC defect; an unavailable chain still correctly receives no cached key.

At 2026-10-25T03:40Z, readiness passed, the catalog was fresh with one release,
an invalid batch body returned 400, an invalid session returned 401, and key
responses were `Cache-Control: no-store`. The real Free request returned an
allowed key, never printed or persisted by the smoke script. The canonical
ciphertext manifest returned HTTP 200 / 17,035 bytes. Signed-in batch success,
revocation during live preparation and audible Next still require user/device
acceptance; deterministic CI covers their state and authority invariants.

## Web publication

Netlify deploy `6add7a9dc6222369213efa6d` publishes `dev` at `c71947a`:
<https://app.netlify.com/projects/muzinga/deploys/6add7a9dc6222369213efa6d>.
The production branch was temporarily changed from `main` to `dev` for this
manual build and restored to `main` after successful publication. The public
site continues serving that dev artifact; later pushes to dev do not implicitly
publish it while the production branch remains main.

Public readback at 2026-10-25T03:46:04Z verified:

- URL: <https://muzinga.netlify.app/>.
- Entry: `assets/index-C6wsXGAj.js`, embedded SHA `c71947a294907bdaf0a92ea0c544876fa39309d4`.
- Entry SHA-256: `a19b741f67acb8089ee1a10d5387c98a96dc877a06dbaaaf0e653ad8ac0dd26c`.
- Config digest: `0d504400edfc50138a9d5f6df01a95bf42d6c6ca1160b52362afe6bc6b3193e9`.
- W34 batch path present in `assets/CoverImage-DnrwppOb.js`, SHA-256
  `b471f0820c1e8a2a64372bbe07f34ad8958cbbb329673309ce1135e8745119ce`.
- Embedded `buildClean=false`, as in the previous Netlify artifact. This
  publication is not a controlled clean-build first-sound evidence candidate.
  Do not infer source-byte equivalence or measured latency from the SHA alone.

## Product publication and independent readback

Local frozen build, all 25 deployment/profile/wire guards, production-environment
smoke and six endpoint checks pass. The live Host Remote Config matches the
pinned deployment environment. Signer-free candidate validation
[40158574358](https://github.com/knzeng-e/dotify/actions/runs/40158574358)
passes for the exact clean packaging SHA and release profile.

Product retains SDK 0.39 / TrUAPI 0.25, `product-cdm` / `devnet`, account index,
permissions, CDM, artist runtimes and committed bootstrap. Publication completed
successfully from the detached clean packaging SHA. Live Host configuration
matched before and after publication; the local signer was removed in the
publication wrapper's cleanup and its absence was independently confirmed.

At 2026-10-25T22:49:50Z, independent readback at finalized block **14912028**
confirmed both `dotify-test01.dot` and `app.dotify-test01.dot` resolve to
`bafybeiaxgf3x4s6c6cwmxd3wm4gsllwl6gxuedqrejb3gmepo62ux2dto4`, with exact
executable manifest `{ $v: 1, kind: 'app', appVersion: [0,1,62] }`.

- Root contenthash transaction:
  `0x83f7811be610ffc60a7e5a278f55bf0005dd0057e2223bcb706da7755ce4f1b4`
  (CLI finalized at block 14907164).
- Atomic app contenthash/executable transaction:
  `0xbb0026ecb30179bc48b99ff2e3d312fe357adb5858d1b1ac3ddc118583644c3b`.
- All 18 transport chunks reached chain finality; four chunks were uploaded
  incrementally while existing content was reused.
- Public CAR returned HTTP 200 / **13,544,401 bytes**. All **135** SHA-256 block
  hashes verified; archive SHA-256
  `288b93ac3a811ad5648c29f2c05da6f6882b858cb8da870d3085a38034e7163d`.
- Inner UnixFS root `bafybeiblicoijobmnunigapnesvrs4rphsyjjaiftcvqw4ykc7xtsvbq2y`
  matches fresh local directory merkleization. DotNS names the transport DAG,
  not this inner directory.
- Public index and `assets/index-Bf8rJDIx.js` match local bytes exactly. Entry
  SHA-256: `ed53f82929dfcb6f3752b41793d3301a074548af82cb1313b4a132534307f948`.
  Both lazy graphics chunks also match local bytes exactly.
- Embedded build identity is the packaging SHA, `buildClean=true`, version
  `[0,1,62]`, config digest
  `8aa511300acefb763e8e2cdefbddec4c13e0b7a917ff02ee901433fb7c9d8f9d`.
- At 2026-10-25T22:51Z, the public API Free-key/no-store and invalid batch/session
  checks passed again, and the ciphertext manifest remained retrievable.

Publication/readback prove the released artifact, not that an installed Host
refreshed its cache or that real-device audio/signing acceptance passed.
An uncertain post-publication failure requires readback before retrying writes.

## Acceptance and rollback

Reload physical Desktop/mobile and confirm 0.1.62,
the same account, signed-in warm Next, expired/denied fallback, sign-out,
account/network changes, Free/protected playback and walletless room guests.
Actual first sound and native signing remain W13/#88/#287/#317 gates.

Client rollback remains Product 0.1.61 at
`bafybeiavq23ghgrkkrq5frcwzy3zcnnq7tvp5umgixdz3exmllfxrd3wbi` and Netlify deploy
`6add1decfe11278180a5b8b5`. Roll clients back before API when withdrawing W34.
The compatible API 29 image remains
`registry.fly.io/dotify-api@sha256:428a3a26f17f614ff44d87c4e34206cdbe2201b92d4b6aacc5e2ed8bc89b5783`;
preserve the latest volume, nonce/key custody, revocations, receipts and catalog.
No Redis/shared trust state or dedicated media-edge activation is included.
