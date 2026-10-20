# Product 0.1.50 radar/audio rollout — 2026-10-15

## Published identity

- Tested application base: `99658622d120c043854a75c071de6e790623ad47`, merged
  #280/#281. Published release source: `e4ce5a14587956dd16b66326e7c78459193c5ae4`.
- Release preparation and record: [#282](https://github.com/knzeng-e/dotify/pull/282).
- Product executable `[0, 1, 50]`, `product-cdm` on `devnet`.
- Domain: `dotify-test01.dot`; public viewer:
  `https://dotify-test01.dev-dot.li`.
- Executable/root CID:
  `bafybeie3r7hmzucvqhmkv5prgt3tguyq2m3fictwgdm7uelm3ssmo6b72m`.
- Netlify still serves application base `9965862` in
  `assets/index-BPJAwUtc.js`, containing #281's behavior. The 0.1.50-only catalog
  snapshot and executable identity belong to the published Product candidate.
  The tracked Netlify fallback cleanup in #282 awaits its merge/build.

The owner authorized continuation by activating the local DotNS signer after
reviewing the exact candidate. No real position, funded tip, participant contact,
contract upgrade or account-permission migration was used for rollout checks.

## Validation and deployment

- Application-base quality gates passed in
  [run 38729444931](https://github.com/knzeng-e/dotify/actions/runs/38729444931).
- Exact release-candidate quality gates passed in
  [run 38731775672](https://github.com/knzeng-e/dotify/actions/runs/38731775672).
- Signer-free Product release-profile validation passed in
  [run 38731713905](https://github.com/knzeng-e/dotify/actions/runs/38731713905).
- Local preparation passed 934 unit tests, 20 Product guard tests, Web and frozen
  Product builds, production environment smoke, deterministic catalog generation,
  formatting/lint, backlog and diff checks. See the [candidate record](product-0.1.50-candidate-2026-10-15.md).
- Fly signaling was deployed first, with zero active rooms/listeners before
  restart: release 31, one machine `d8d5205f929e28`, source `e4ce5a1`, image
  `registry.fly.io/dotify-signal@sha256:c4fa0a5f982a7f2146a9e55fb8ab6f29d3c1c76d9b4de5b82f75c1e861cf3c4f`.
- Deployed health reports healthy with Nearby enabled. Netlify origin was
  accepted and a foreign origin rejected, including its Socket.IO handshake.
  A temporary code-based guest join passed without wallet access requirements.
- Separate synthetic Product-origin host and Netlify-origin guest verified
  default privacy, explicit Nearby publication/discovery, invitation join and
  opt-out removal. `/status.rooms` and `rooms:list` stayed empty while that room
  was active and visible nearby. No exact location, source audio or wallet
  reference appeared in discovery replies. Test clients were cleaned up;
  subsequent health reported zero rooms/listeners.
- Product Remote Config matched the pinned CLI 0.20.0 and tracked Host-facing
  DotNS generation before and after publication. All 25 content nodes passed
  GRANDPA-finalized verification; P2P retrieval succeeded in 49 ms.
- Independent public gateway read returned HTTP 200 and 13,902,756 CAR bytes
  containing the exact release SHA, Product `[0, 1, 50]` identity and
  `assets/index-DhGyUIYg.js` entry.
- Independent finalized Asset Hub read at block `14472530` matched that CID on
  both `dotify-test01.dot` and `app.dotify-test01.dot`. The executable text record
  was `{"$v":1,"kind":"app","appVersion":[0,1,50]}`.
- The local signer was passed only to the deployment child environment, then
  removed from `launchd`; its absence was verified. The phrase was never printed
  or stored in a file.

The unchanged API remains healthy on source
`fc7faf5a49e6d5b3392285bab2ee957d325b4cb6`. No API, contract, content-key,
origin, persistent-storage or signing-policy migration was performed.

## Transaction references

- Bulletin stable upload: block `1220376`, transaction
  `0x0a4ec6d3dccb690550fa6afa406a438664c74de81aaa91626717471cceff2320`.
- Bulletin root upload: block `1220379`, transaction
  `0x53203f227f7ad79e1842bcc8f858f551d748f4979f4483d1209ebf37a1610c05`.
- Root content update: Asset Hub block `14472483`, transaction
  `0x07f605823259115c041e6d65aad3841942aa45f3eb813b79c8a5a44b9977215c`.
- Atomic app content/executable update:
  `0x41eb9f468e9899271db23b1dbab7f7cf65a2d421c4251f62a9da18526cda9124`.

## Rollback and remaining physical acceptance

Product 0.1.49 remains the prior client artifact:
`bafybeigm4ndvikxjf5w44clzy4mkizmsbploxrrqswftumqxieyxhqmicq`.
The prior signaling image is
`registry.fly.io/dotify-signal@sha256:2b9378ae8de991102a9586707be320348e5d5053b8954d1f1cf3bfb0226396dd`.
That old server restores global room enumeration, so do not use it while
promising private/radius-limited discovery. Retain fixed signaling if rolling
back a client; restart clears ephemeral rooms/chat/discovery. Keep experimental
Celerity observation off in public builds.

Publication does not prove an installed Host refreshed its cache, exposes working
location/WebRTC permissions or recovers every audio interruption. Reopen actual
Desktop/mobile Hosts, record loaded SHA/version/CID and verify: room private by
default; visibility switch and both radii; revocation/background/reconnect;
code and artist invitation; multi-track audio and interruption recovery.
Native tips are a separate physical regression check; no payment was sent here.
The unavailable original “Le Singe Fou” cover still needs storage repair.

Refs #274, #88 and #89 remain open for those applicable acceptance gates.
Merge #282 to retain executable 0.1.50, the frozen catalog and this rollout record
in `dev`, then record device results against this exact published identity.
