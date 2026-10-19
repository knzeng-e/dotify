# Product 0.1.54 stability rollout - 2026-10-18

## Artifact identities

The owner authorized the complete deployment after #302 merged into `dev` at
`02bb83595754672870d136d743509e718117faa1`. Product was signed and published
from clean packaging commit `0d002e373f42c5a4a03100306a58efcc9156da2d`, with
executable `[0, 1, 54]`, existing `product-cdm` / `devnet` profile and a frozen
13-release catalog. Later documentation commits record this publication; they
do not change its signed source or CID.

- Product root and executable CID:
  `bafybeiepuhymockmxkkqkjtjqrgak4fhlxyxjep2k7aev7mt4h45nb5csa`.
- Product entry `assets/index-DgpxGwmI.js`, SHA-256
  `7955ac8db30b10b8bd9fa9c990deb96344594428d4a1605538f89f720ba5cbeb`;
  embedded build configuration digest
  `bae8d25f1aba21b01a11095c112e36adc590ef3143c117b665833b22e69fd678`.
  The exact packaging SHA and clean build flag were verified before publication.
- API Fly release **28**, one machine `802034f6565958` in `ams`, image
  `registry.fly.io/dotify-api@sha256:30ce5257e2da9548af8ed57f72be72b1092094a5bd5692806e4a9bff2ea114f6`;
  image-config digest
  `sha256:7a41b8487ee3dbf382aa6c333b9d02ee90ab013750b8cc117002f95bf40636db`.
  `/version` reports the full packaging SHA above.
- Signaling Fly release **35**, one machine `d8d5205f929e28` in `ams`, image
  `registry.fly.io/dotify-signal@sha256:60c0d01be7a491f240d519e917e782f85ce34f10735a45f68fa5d51291bcd88f`;
  image-config digest
  `sha256:c21d3a4bf53fffb1902f69ffa7169ac166d8b62326b46740705c7617116ff9f7`.
- Ordinary Web, observed at `2026-10-18T11:13:49Z`, independently serves the
  merged application SHA `02bb83595754672870d136d743509e718117faa1` from
  `https://muzinga.netlify.app/assets/index-D5ynstH2.js`, SHA-256
  `e6c87e0c09782936397ba484aa675ad2ca89276ce1cb7df4dce5c5b4ddada102`,
  build configuration digest
  `0d504400edfc50138a9d5f6df01a95bf42d6c6ca1160b52362afe6bc6b3193e9`.
  The existing Netlify embedded clean flag remains false; this verifies served
  identity/configuration, not a clean Netlify checkout. A later `dev` merge
  requires its own served-entry verification.

## Deployment order and persistence boundaries

The initial health check found one open room with no guests. The owner closed
it before any restart. Immediately before each runtime mutation, the deployment
command rechecked health and failed closed unless rooms, listeners and solo
listeners were all zero. The images were built first, then API was deployed and
its exact `/version` verified before signaling was deployed. The already-updated
Netlify client was checked independently. Product publication followed the
deployed-service checks and green exact-candidate CI.

Every API/signaling secret name/digest was unchanged across deployment, including
the stable API session epoch and content-key secrets. The API retained volume
`vol_42kj9wq1q97njm14` at `/data/contributions`, one writer and its snapshot.
The signaling service remains one worker, with Nearby enabled. No contract,
permission, origin, storage, scaling or paid-provider change was introduced.

The mnemonic was read from the owner-enabled local `launchctl` environment,
passed only to the local publication child environment and removed in `finally`.
An independent post-publication check confirmed that `MNEMONIC` was absent.
No seed or credential was placed in a file, command argument, GitHub, Fly or a
frontend artifact.

## Publication and independent read-back

The pinned deploy CLI 0.20.0 checked the Host-facing DotNS profile and live Product
Remote Config before and after publication. Incremental Bulletin publication
reused 14 stable chunks, uploaded seven changed stable chunks, then the changed
CAR header/manifest frames. All 24 stored chunks were confirmed at GRANDPA
finality before DotNS was changed.

- Bulletin stable section: block `1261779`, transaction
  `0x81748a42064d7af97ad86632dba4908e3b942aee964ff6b4f35f15dee50b83e5`.
- Bulletin root: block `1261782`, transaction
  `0x1b7540a88d93afdece1780f2ec68a8471a06997b303df9ee4234cbdde488fbe6`.
- Root content update: Asset Hub block `14597681`, transaction
  `0x7cc75f33dd74be6b9f8da9e948ca2524ac2b860fafee058d4ed218f906ae287a`.
- Atomic app content/executable update:
  `0x12903bb1ef649b94a5749a151bc5003ec9ceb21f6206f599ac4481c6338361d0`.

At finalized Asset Hub block **14597736**, an independent resolver read verified
both root and app contenthash bytes against the exact expected CID, and executable
text `{"$v":1,"kind":"app","appVersion":[0,1,54]}`. The public DevNet gateway
returned HTTP 200 with a **13,943,193-byte CAR**, SHA-256
`45b9ce60895224a6b92b5eb25d707170a60788d7dd8517abbab22638680b762c`.
All 125 CAR block hashes were verified. Its `index.html` and entry JS were
byte-for-byte identical to the local signed build, including its full source SHA.
This proves published bytes and resolution, not an installed Host cache refresh.

## Validation

- [Merged dev CI](https://github.com/knzeng-e/dotify/actions/runs/39120855365)
  and [exact packaging CI](https://github.com/knzeng-e/dotify/actions/runs/39121608479)
  passed all configured Web, Product, API, signaling, contracts, repository and
  Playwright jobs. The [signer-free release validation](https://github.com/knzeng-e/dotify/actions/runs/39121746286)
  passed separately. An earlier validation dispatch supplied a short expected
  SHA and was refused by the exact-SHA guard; no signing or publication was
  possible in that workflow. The corrected full-SHA run is authoritative.
- Local checks passed the frozen Product build, 20 deployment guards, six live
  DevNet endpoint checks and fresh Host Remote Config alignment. The existing
  frontend bundle-size warning remains; this rollout does not complete W31's
  performance work. The API image build also reported four high-severity npm
  audit findings in the unchanged dependency set; no dependency update is
  claimed by this release.
- Deployed API: a registered DAV2 release returned HTTP 206 with a bounded
  65,536-byte range, exposed range headers and allowed Web/Product origins.
  A warm read returned identical ciphertext; a complete 5,112,155-byte response
  matched the range prefix. Unknown CIDs, query-based proxy attempts, unbounded,
  suffix, multi-range and oversized ranges were refused. The sample took about
  4.5 seconds cold, 0.7 seconds warm and 5.1 seconds for the complete object;
  these are observations, not first-sound or regional latency guarantees. No
  content key or plaintext was requested by this smoke. Cancellation/coalescing
  and overload invariants are covered by the exact-candidate automated tests;
  no production overload test is claimed.
- Deployed signaling: temporary sessions proved private-by-default creation,
  explicit Nearby publication with synthetic ocean-area coordinates, exact v4
  listener counts, preserved v3 shape, anonymous Web/Product-origin joining,
  chat, explicit Worldwide publication, empty legacy enumeration and immediate
  opt-out. Same-track metadata/null/recovery produced no duplicate track
  announcement; A-to-B-to-A selections produced two announcements with simple
  punctuation. An unlisted origin was refused. Test rooms were explicitly closed.
  Final health had zero rooms/guests and one unrelated solo listener; no further
  restart was performed and that listener was not modified.
- Live Web Chromium checks at desktop 1440x1000 and mobile 390x844 navigated
  through Rooms, rendered the galaxy without page errors or horizontal overflow,
  loaded the merged source and fetched the encrypted range through real browser
  CORS. Synthetic browser coordinates were not needed for this render check;
  it does not prove native location or audible physical-device playback.

## Remaining acceptance and rollback

Reload installed Product Desktop/mobile and verify **0.1.54** before physical
acceptance. Check native location permission/fix/revocation, foreground recovery,
Nearby/Worldwide/Link only preference persistence, cover availability, exact
presence-driven planet growth/light, own-room identity, artist aggregates, tips
and prolonged multi-track audio across independent networks. Native Host location
remains a Host capability gate. No room guest receives a content key/source file.

A fresh-profile deployed Web check found that direct `#/rooms` opens Music,
while clicking Rooms works on both tested widths. The navigation provider only
recognizes a room code for initial room routing; the Product browser-recovery
helper emits the code-free discovery route. Track this W19 follow-up under #274:
honor the discovery route without autojoining a remembered room, and add a real
destination-navigation test. The current release does not claim this continuation
path is repaired.

Client rollback: Product **0.1.53**, CID
`bafybeihj6vrdu3dqnaqfofw4l3qiysc4by4rau3mldmlom637waemgmqr4`.
Previous API image:
`registry.fly.io/dotify-api:release-0.1.52-0cd1e4b` (manifest
`sha256:cfb1b91fdc1f01df91d3a4cff7764b910d21438df2a5a3dcbf7b71536316013a`).
Previous privacy-safe v4 signaling image:
`registry.fly.io/dotify-signal:release-0.1.53-726310b` (manifest
`sha256:1c43ec9ad8a1c1ca3962364c969e5ce75f7a9e47aa917f51b8c19e198cc64fd0`).
Recheck active sessions before any rollback restart. Preserve the stable session
epoch, volume and content-key secret versions. Do not restore an older globally
enumerating signaling service. Paid tips must never be repeated to repair chat.
