# Product 0.1.61 scoped 3D galaxy publication

Refs #317 and delivered #329/#330. Source: merged `dev`
`620f7c625fda6c838136adb63292336e7767ec13`, including the merged 0.1.60
publication record (#327). The executable version advances to `[0,1,61]` under
the existing `dotify-test01.dot` identity.

## Candidate and boundaries

This Product-only release restores the optional Radar / 3D / List choice on the
current scoped public room discovery. Radar remains the initial view; graphics
load only after choosing 3D and return to Radar on reduced motion or graphics
failure. The shared preview, own-room return and audio ownership remain intact.

Keep SDK 0.39 / TrUAPI 0.25, the native `product-cdm` / `devnet` profile, account
index, CDM snapshots, artist runtimes, permissions and committed catalog snapshot.
No API/signaling/encoder restart, contract deployment, cache-edge activation,
artist policy change or ordinary Web deployment is included. The owner handles
the independent Web publication.

## Publication status

Published on 2026-10-24 from clean packaging commit
`c294e21651ab007725d7fafa18be5c6de8e03419`. Merged-dev CI
[40131746854](https://github.com/knzeng-e/dotify/actions/runs/40131746854)
passes in full. The frozen Product build, all 25 deployment/profile/wire guard
tests and the six endpoint checks pass locally. Live Host Remote Config matched
the pinned deployment environment before and after signing. Existing large-chunk
warnings remain; graphics still use separate lazy scene/Three chunks.

Independent finalized readback at Asset Hub block **14867115** confirms both
`dotify-test01.dot` and `app.dotify-test01.dot` resolve to
`bafybeiavq23ghgrkkrq5frcwzy3zcnnq7tvp5umgixdz3exmllfxrd3wbi`, with executable
manifest `[0,1,61]`.

- Root contenthash transaction:
  `0x01cbdb0bb207f49efd69117897c0e6f59ad81b1e08a65653235ac6c7538bef68`.
- Executable contenthash/manifest transaction:
  `0x50cf4ef6df1f668757f9cbd5dc07a9d3b91dd3de00fda8f419a0b20e0d893abd`.
- All 18 transport chunks reached chain finality. Three initially missing chunks
  were automatically re-uploaded before final verification and DotNS activation.
- Public CAR returned HTTP 200, 13,540,382 bytes. All 135 SHA-256 block hashes
  verified; archive SHA-256
  `f6583ea115233cffd7ed8b0641945eed4c939bb1e2d7c51616287931d43b3a71`.
- Inner UnixFS directory
  `bafybeifetfct2qiic3er2khpy2shwnm4gfm5f5wa4invq53ifp42ypkqdm` matches fresh
  local merkleization. DotNS names the transport DAG, not that inner directory.
- Public index and entry bytes match the signed local build. Entry
  `assets/index-BREcQEez.js`, SHA-256
  `3fa39f0bba7553be72d1eecbd7c5c16287cc1249c8ef5ee8edc55550bc14fecc`, embeds
  the clean packaging SHA above. Public `RoomGalaxyScene-DOTO_8qd.js` and
  `three.module-iOYB3rD4.js` also match their local bytes exactly.
- API readiness and signaling health return HTTP 200; Nearby remains enabled.
  No service was restarted. The local signer was removed after publication and
  its absence was independently confirmed without displaying its value.

These checks prove publication and artifact identity. They do not prove that an
installed Host refreshed its cache or certify physical-device graphics/audio.
Later documentation commits do not change the signed executable identity above.

## Remaining acceptance and rollback

Reload Dotify in physical Desktop/mobile Product, confirm version 0.1.61 and the
same account, then choose 3D from the room view picker. Check room inspection,
own-room return, audio continuity and the reduced-motion fallback. Hardware
graphics/FPS/energy and native location remain unverified by browser fixtures.
No payment or artist write is part of this publication check.

Retain the compatible 0.1.60 artifact as client rollback:
`bafybeia2dhkny3yv4oy2dzubqa24qlt2kacnd64sy5mjf3qw47dhdveuum`.
Rollback must retain current custody, catalog, contracts and persisted services.
Existing #85/#88/#89/#158/#274/#317 acceptance gates remain open.
