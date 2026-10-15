# W19 — consented radar and audio recovery follow-up

## Identity

- Date: 2026-10-15.
- Starting tested dev: `6de81d1f2fc967462bce2a9326c984a6a4612c9a`.
- Branch: `fix/radar-consent-and-audio`.
- Scope: owner-reported accidental room discovery, dense Nearby controls and
  interrupted Host audio. Refs #274, #88 and #89; physical-device gates remain.
- Tested application implementation: `bbc3f4916bc91fa09186c45163d1e4ad6dd96dc6`;
  the final PR head also carries the private-entry fixture corrections below.
- PR: [#281](https://github.com/knzeng-e/dotify/pull/281); the PR checks record
  the exact final tested head and CI result.
- Dependencies: [W19](W19.md), [Product location](W19-product-location.md),
  [Product 0.1.49 packaging PR](https://github.com/knzeng-e/dotify/pull/280).
- Release readiness: not deployed by this follow-up.

## Result and decisions

Rooms now start accessible by invitation only. The compatibility endpoints
`/status.rooms`, `rooms:list` and `rooms:updated` return empty lists even when a
host opts into Nearby. Global listing cannot express a host's radius; hiding
cards in the UI alone would leave the same information publicly enumerable.
Nearby remains the bounded discovery API, with explicit publication and both
participants' approximate radii enforced. Shared codes still allow remote
entry: radius is a discovery preference, not an admission fence.

Room creation offers a default-off **Visible nearby** switch and a native
5 / 10 / 25 km range control. Selecting the switch does not request location.
An acknowledged creation consumes that choice once for that room. A cancellable
creation identity spans audio preparation, transport permission and the server
acknowledgement; a superseded attempt cannot open or advertise an obsolete room.
The host can stop visibility without ending audio. Listener discovery uses one
primary action and the same range control, with manual-city exploration and
privacy explanations collapsed. Decorative radar rings do not imply exact
positions or invent nearby listeners.

Automatic Statement Store beacon publication/discovery is disconnected. The
artist dashboard consequently cannot enumerate private listening rooms. Its
explicit invitation entry preserves visits and the choice to announce an
artist identity, with the existing server-side account/network/release checks.
Automatic artist discovery across private rooms needs a separate consent
design; absence from the dashboard is not a zero-listening claim.

For audio, HTTP headers previously won the full-file gateway race before the
body had finished. A stalled or truncated winner could silence recovery without
trying an available reader. A full-audio attempt now wins only after HTTP 200,
bounded complete-body reading and, for DAV2, container validation. At most two
bodies run concurrently, with a 20-second header timeout, 15-second inactivity
timeout and 64 MiB per-body limit. Range reads remain on Pinata readers; full
recovery can use configured public IPFS readers. AES-GCM authentication stays
outside retries and fails closed. Recovery preserves playback position and
pause state. Retired DNS hosts are omitted without changing content IDs.

Artwork uses the bundled placeholder immediately instead of requesting an
additional missing remote placeholder. This does not repair an unavailable
original cover or pin.

## Verification

Tests use synthetic coordinates, fixtures and local signaling. No real location
was published and no wallet payment was sent.

| Scenario | Environment | Observed result |
| --- | --- | --- |
| Default-off publication, bounded search, join by code, resume and host/session isolation | Node 22 local signaling | 96 tests passed |
| Nearby search → independent guest → decoded room audio | Chromium, local Socket.IO and WebRTC | Passed |
| Creation switch, keyboard range, manual city, denial and native snapshot | Chromium Web and Product bridge fixtures | Four Nearby scenarios passed |
| `npm --prefix web run test:nearby` | Chromium, separate real servers for Web and Product fixtures | Web 2/2 and Product 2/2 passed. CI originally caught seven searches sharing one localhost six-search/minute budget; independent fixtures now restart the server without weakening production limits or adding sleeps |
| Operational Nearby disable | Chromium | No controls, location requests or Nearby packets; passed |
| Room entry, continuity and responsive radar | Chromium | 18 scoped scenarios passed |
| Full core regression | Chromium | 232/239 passed initially; seven old global-discovery/entry assertions corrected in two fixture files, then all 14 cases in those files passed. All 239 scenarios have passing evidence |
| Obsolete creation ACK and invited artist visit | Chromium, real Socket.IO | Seven room creation/life scenarios passed; the stale room is retired, the replacement stays private |
| Audio recovery, cancellation, access failures and transport continuity | Chromium and WebKit with real decoded fixture audio | 13 cases in each engine passed; 10 affected cases passed again after final reader changes |
| Accessibility | Chromium/Axe and keyboard checks | No Axe violations in tested Nearby surface; native slider/switch and touch targets checked |
| Unit suite | Node 22 / Vitest | 120 files, 934 tests passed, including five creation lifetime regressions |
| Lint, formatting, Web build, frozen Product build, production-env smoke and offline backlog check | Node 22 | Passed; two existing App.tsx Hook warnings and existing >500 kB chunk warnings remain |

Screenshots were reviewed at desktop and mobile sizes. Local artifacts:
`/private/tmp/dotify-radar-ui-evidence/nearby-final/` and
`/private/tmp/dotify-radar-ui-evidence/nearby/` (creation controls).
The [mobile radar](../../../design/assets/nearby-radar/mobile.png) and
[host visibility control](../../../design/assets/nearby-radar/host-visibility.png)
are retained in the repository for review; both use synthetic fixture rooms.

Live read-only diagnostics found the reported retired gateway hosts unavailable
in DNS. Pinata returned successful headers and byte-range support for the
checked “Mon cerveau” ciphertext. The checked “Le Singe Fou” cover variant
returned 404; alternate directory reads did not establish a working original.
These observations do not prove the exact cause of every physical Host audio
interruption. Missing cover storage remains an operational follow-up.

## Design skill check

The local `frontend-design` skill was compared with the current
[official upstream](https://github.com/anthropics/skills/tree/main/skills/frontend-design)
on 2026-10-15. It predates upstream changes; Dotify-specific guidance remains
applicable. Current restraint, plain-copy and screenshot-review guidance was
applied, with the official
[Vercel interface guidelines](https://github.com/vercel-labs/web-interface-guidelines)
for native controls, focus, touch and reduced motion. No global skill overwrite,
installation or runtime dependency was required.

## Operations and remaining gates

Deploy the signaling privacy change before the frontend; an old server still
publishes its global directory. Retain PR #280's `shared` package in the
signaling image before the next deployment. This branch does not change the
Product app version, publish a bundle or migrate contracts/storage. Keep the
experimental Celerity observation setting `VITE_DOTIFY_ROOM_REALTIME` **off** in
public builds: its separately authorized measurement mode publishes public
presence and is outside this private-room rollout.

No new location permission, location persistence or gateway credentials are
introduced. Nearby retains its existing short-lived coarse area, limits,
revocation and expiry. The operator can still observe requests and approximate
areas; this is not anonymity. Reverting the signaling privacy change restores
global enumeration and must not be presented as a privacy-preserving rollback.

Before #274 and the applicable reliability gates close, test the exact deployed
Product desktop/mobile versions: open a private room; discover only after
explicit activation; change radius; revoke/background/reconnect; join through
an invitation and an artist invitation; play through several tracks and an
interruption. The native screenshot's exact failure has not been reproduced on
the physical device. Restore or repin the unavailable original cover separately.

Next action: review and merge this fix with its packaging prerequisite, then
deploy signaling and both clients and record those physical acceptance results.
