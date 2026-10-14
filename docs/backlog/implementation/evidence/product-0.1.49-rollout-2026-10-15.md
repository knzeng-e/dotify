# Product 0.1.49 Nearby test rollout — 2026-10-15

## Published identity

- Merged application base: #279, `6de81d1f2fc967462bce2a9326c984a6a4612c9a`.
- Release/source: `b709ffabb1980b852ecf70367792e973b3e290d3`,
  [#280](https://github.com/knzeng-e/dotify/pull/280).
- Product executable: `[0, 1, 49]`, `product-cdm` on `devnet`.
- Executable/root CID:
  `bafybeigm4ndvikxjf5w44clzy4mkizmsbploxrrqswftumqxieyxhqmicq`.
- Public Web: `https://muzinga.netlify.app`, served merged application base
  `6de81d1` after the owner triggered its Netlify build.
- Product: `dotify-test01.dot`, public viewer `https://dotify-test01.dev-dot.li`.

This is the owner-authorized release for installed-device Nearby testing.
No real positions, funded tips, runtime upgrades or participant contact were
part of the automated rollout. Availability is default; location/search and
host visibility still require user action. Publication is not evidence that an
installed Host provides a working Geolocation/Permissions bridge.

## Packaging correction and checks

Pre-deploy inspection found that `Dockerfile.signal` omitted `shared`, while
Nearby imports its geometry module. The release adds that directory and a
regression smoke that boots the runtime directories declared by Docker COPY.

- Merged dev quality gates passed in
  [run 38649429391](https://github.com/knzeng-e/dotify/actions/runs/38649429391).
- Local signaling tests: 94/94 passed; deploy/Host wire/runtime guards: 20/20
  passed. Production environment smoke, Product frozen build/typecheck,
  targeted ESLint/Prettier, offline backlog and diff checks passed.
- Live Product Remote Config matched CLI 0.20.0 and the Host-facing DotNS
  override before and after publication.
- Local Docker Desktop was unavailable; the remote Fly build and the actual
  deployed process passed health checks after the image correction.

## Deployed verification

- Signal: one active machine `d8d5205f929e28`, release 30; image
  `registry.fly.io/dotify-signal@sha256:2b9378ae8de991102a9586707be320348e5d5053b8954d1f1cf3bfb0226396dd`.
  Machine source metadata matches `b709ffa`; `/health` reports healthy,
  `nearbyEnabled: true`. No active rooms existed before restart.
- HTTPS Netlify origin was accepted and a foreign origin rejected. A temporary
  room/guest smoke passed without wallet access requirements and was cleaned up.
- A native-Product-origin test host published a synthetic area; a separate
  Netlify-origin client found it and joined wallet-free. Opt-out removed it from
  subsequent results. Replies contained no cell, precise fix, wallet or source
  reference. This tests server discovery, not physical positioning or speakers.
- Netlify entry `assets/index-GYAKyvWX.js` contains `6de81d1` and Nearby.
  Fresh headless Chromium at 390×844 and 1440×1000 rendered Nearby with direct
  Join/Open controls inside the initial viewport and no uncaught JS errors.
  No browser geolocation was requested.
- Independent Product gateway read returned HTTP 200 and 14,664,558 CAR bytes
  containing the release source SHA and `assets/index-CxVmjOk9.js`.
- Finalized Asset Hub read-back at block `14448165` matched the CID on both
  `dotify-test01.dot` and `app.dotify-test01.dot`; executable text returned
  `{"$v":1,"kind":"app","appVersion":[0,1,49]}`.
- The local DotNS signer was removed from `launchd` and its absence verified.
  The phrase was passed only in the child environment, never printed or stored.

The API has no source change relative to the 0.1.48 rollout and retains that
deployment. No API/contract/key/storage/origin migration was performed.

## Transactions and rollback references

- Bulletin stable upload: block `1212226`, transaction
  `0xd23f387edf3ab4ca6a86745f1a42181b28ce065930686066d6f25039b99ab938`.
- Bulletin root upload: block `1212229`, transaction
  `0xe566a6b22474e5d6451fe7199a941104bafa1e8d7de0233db663982c4320d155`.
  All 26 content nodes reached GRANDPA finality; P2P retrieval passed in 54 ms.
- Root content link: block `14448104`, transaction
  `0xe53468f8563deb098b4dbd8f692bbab51655346b965d9ceafe1e5893cefbe274`.
- Atomic executable content/manifest update:
  `0x7a5b1411094ff2e9ad7a027c009babd5319533c8b7e53c2115444d4c25778f09`.
- Previous Product 0.1.48:
  `bafybeicqj4ekyiz7pmbt7ry2ixpwvpa24v5liialmhe3zwonjslt47wvna`.
- Previous signaling image:
  `registry.fly.io/dotify-signal@sha256:be762e73faa46a0d6d762db3e78ba459f5b96adbb26bf09d77364ac3f8348ce3`.
  Restart/rollback clears ephemeral rooms/chat/discovery; no valid payment should
  be repeated to repair a room announcement.

## Installed-device tests still required

Record the loaded SHA/version/CID and exact Desktop/mobile Host and OS versions.

1. Reopen Dotify and confirm Nearby appears; no location prompt before an action.
2. Find rooms near me: allow, deny and cancel/timeout; verify clear states and
   no automatic city fallback. Never capture precise positions in artifacts.
3. Open a room and enable visibility at 5/10/25 km. A second client finds and
   joins it without wallet friction; verify real audio and independent radii.
4. Turn visibility off, background/disconnect and revoke permission. Confirm
   bounded expiry and explicit renewal of Product snapshots, without auto-resume.
5. Check Artist entry/chat and native tipping separately as regression flows;
   automated publication tests do not claim real payment or Host signing evidence.

Merge #280 to preserve the image correction and executable version in `dev`
before another deployment. Applicable W13/#89 device/room gates remain open.
