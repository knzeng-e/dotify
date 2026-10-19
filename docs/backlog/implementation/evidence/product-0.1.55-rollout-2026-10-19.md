# Product 0.1.55 live-presence rollout, 2026-10-19

The owner authorized deployment after #303/#304 merged into tested `dev`
`893418de06b9eda8379a350b3bca8912a8ebb4b8`. The exact clean packaging commit
`74effe95da53394dec9394666f30d4e14bac024c` was published with executable
`[0, 1, 55]`, `product-cdm` on `devnet`, and a paired frozen 13-release catalog.
Later documentation commits record the rollout; they do not republish Product.
Refs #88, #89, #274, #257 and #229. This is deployment evidence, not an accepted
physical Host or aggregate pilot record.

## Artifact identities

- Product root/app transport CID:
  `bafybeig5b2hue5db3oftgvjzlvb2wezslwdn7j5efj547225s4y4b5zwmy`.
- Product entry `assets/index-CFR9_Fww.js`, SHA-256
  `ce04205bbe3bbb8e561c4aac1103fcc6e62741a2d83fc64614a0fe81262375ce`.
- Signaling Fly release **36**, one machine `d8d5205f929e28` in `ams`, image
  `registry.fly.io/dotify-signal@sha256:f2f2927353b61beb050286507e5791bbd0b76069b8ec85afd2057813b8a2a931`.
  Its OCI revision is the full packaging SHA above.
- API stays on release **28**, machine `802034f6565958`, image
  `registry.fly.io/dotify-api@sha256:30ce5257e2da9548af8ed57f72be72b1092094a5bd5692806e4a9bff2ea114f6`.
  `/version` still identifies `0d002e373f42c5a4a03100306a58efcc9156da2d`.
  API source/configuration is identical between that release and this candidate;
  there was no API restart, credential, origin, volume or contract migration.
- Web deploy `6ad5f826644177044774248b` serves merged-dev SHA
  `893418de06b9eda8379a350b3bca8912a8ebb4b8`, independently of Product.
  Entry `https://muzinga.netlify.app/assets/index-C-gffatI.js`, SHA-256
  `e276bb33f62a38efd1790f4876865931586edc84243b302f6377be29bf1faae7`.

## Deployment and signer boundaries

The prebuilt signaling image was promoted only after a fresh in-process health
check showed zero rooms, listeners and solo sessions. Fly briefly reported
`replacing` immediately after accepting the rollout; a read-only follow-up
confirmed `started`, release 36 and the expected image. The deploy was not
repeated. One signaling worker and all signaling secret names/digests were
preserved. The API retains its existing writer and
`vol_42kj9wq1q97njm14` at `/data/contributions`.

Netlify's actual automatic production branch was `main`, although the served
artifact was a manually published `dev` build. For this rollout the branch was
temporarily set to `dev`, the tested commit was built and published, then the
original `main` setting was restored and read back. Branch deploys and PR previews
remain disabled. Future `dev` merges therefore need an explicit Web deployment;
do not assume the merge updates this site. The public SHA must be checked again
after any subsequent publication.

The owner enabled the local DotNS signer. It was passed only to the publication
child environment and removed in `finally`; an independent check confirmed
`MNEMONIC` was absent afterward. The seed was never written to a file, process
argument, frontend configuration, CI, hosted service or report. Browser-safe build
configuration already loads from `.env.product-devnet`; automatic signing is a
separate authority boundary.

## Finality and independent public read-back

- Bulletin stable section: block `1275605`, transaction
  `0x5bc78006835646f1270094b3f3518707b6190e7b4898add229b6b6b99f6b3cca`.
- Bulletin root: block `1275609`, transaction
  `0xff68ac5ab28ee516e2dc730dc517a1a0c66b1a467a595bd086e19144bd59b583`.
- The pinned CLI checked all 24 storage chunks at GRANDPA finality. One chunk
  remained missing after its bounded wait and was re-uploaded; all chunks and
  the root then verified before DotNS changed.
- Root content update: Asset Hub block `14639833`, transaction
  `0xd31836cce9cb46a4bd0b8c4c53dfffe089f7fca4b35558ec46bf56f533b3b327`.
- Atomic app content/executable update:
  `0x97e038817d6d4a48be1e22e720f2769a7364818c3ab86c0ee4a3c0c839d19237`.

An independent read at finalized Asset Hub block **14639899** verified root and
app contenthash against the exact expected transport CID and executable text
`{"$v":1,"kind":"app","appVersion":[0,1,55]}`.

The public gateway returned a **13,954,453-byte CAR**, SHA-256
`d75e547afed0e279a488db8b40fafc64c398a3febbc3289a4eab31fc42ff450f`.
All **125 block hashes** passed. Its inner UnixFS directory root
`bafybeicmjrcx3gojopgrup4unhhd4qtyk7bwl7be7gv7nyzpqdss5ahj6u` matched a fresh
local directory merkleization. This inner root differs by design from the
transport DAG that stores the chunked CAR. The extracted index and entry bundle
match the signed local files byte for byte, including the full packaging SHA.

## Validation and remaining gates

- [Merged-dev CI](https://github.com/knzeng-e/dotify/actions/runs/39236219354),
  [exact packaging CI](https://github.com/knzeng-e/dotify/actions/runs/39239259681)
  and [signer-free release validation](https://github.com/knzeng-e/dotify/actions/runs/39239598322)
  all passed. Local frozen build, 20 publication guards, six live DevNet endpoint
  checks and fresh Host Remote Config alignment passed. The ordinary bundle-size
  warning and unchanged dependency audit findings remain; this release does not
  claim a dependency/security-remediation change.
- Temporary live Socket.IO sessions proved private-by-default rooms, scoped v5
  appearance/profile/count updates, host-only profile editing, anonymous joining,
  held-area authenticated resume inside grace, Nearby-to-Worldwide withdrawal,
  opt-out and explicit closure. No device location was collected: the test used
  a synthetic ocean-area cell. Observed appearance was **292 ms**, closure
  **256 ms**; these samples are not latency SLOs or global measurements.
- Real Chromium checks at 1440x1000 and 390x844 verified the independently served
  Web SHA, a live Worldwide room, distinct host/current-track preview, reversible
  Hide, no page errors or horizontal overflow, and a 65,536-byte ciphertext
  HTTP 206 response through browser CORS. No content key or plaintext was read.
  Early smoke failures were harness issues (a missed connect event and a locator
  scoped to the sky rather than the complete radar region); the corrected smoke
  passed against the published app without any application change.
- All temporary test rooms were explicitly closed. A later unrelated room was
  observed and left untouched; no further server restart was performed.
- Reload installed Desktop/mobile and verify **0.1.55** before testing native
  location permission/fix/revocation, screen lock/app switching, prolonged
  multi-track audio and funded native receipts/chat. The pending tip supplied
  by the owner still needs its native block reference. No payment was resent.
  A missed transaction index is not evidence of failure. Physical OS behavior,
  actual positive artist announcement, universal artwork availability and the
  existing direct `#/rooms` browser-continuation gap remain live acceptance work.

## Rollback

Product client rollback is **0.1.54**, CID
`bafybeiepuhymockmxkkqkjtjqrgak4fhlxyxjep2k7aev7mt4h45nb5csa`.
Previous signaling image (release 35):
`registry.fly.io/dotify-signal@sha256:60c0d01be7a491f240d519e917e782f85ce34f10735a45f68fa5d51291bcd88f`.
Withdrawing the background-hold behavior requires a compatible client/signaling
pair. Recheck active sessions immediately before any restart, retain privacy-safe
discovery, and preserve API session epoch, content-key secrets and storage.
