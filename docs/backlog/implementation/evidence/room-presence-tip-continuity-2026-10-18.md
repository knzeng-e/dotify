# Room presence and tip continuity, 2026-10-18

Candidate based on tested `dev` at `02bb83595754672870d136d743509e718117faa1`.
Refs #274, #257 and #229. This record is local implementation evidence, not a
deployment or physical Product acceptance record.

## Intended behavior

An opted-in room appears or disappears on the next scoped discovery update,
without waiting for another location scan. An explicitly closed room is removed;
a host who backgrounds the app stays visible at the last consented area while
the connection lives. A detected disconnect shows Reconnecting for up to eight
seconds. A short authenticated resumption can preserve that invitation. Once
expired, an invitation needs fresh publication. The host's visibility choice is
never silently rewritten to Link only.

Rooms may have an optional stable name and short invitation. The compact radar
keeps artwork and listener orbits. A pink verified seal is visible without hover
only while the current track's server-verified artist is connected and has
explicitly announced their presence. The preview separates the room name, host,
invitation, current song, artist and connected count.

Hide is reversible in Hidden rooms during the current discovery visit. Show
again can only restore a currently valid invitation in the current search.
Report still records an aggregate safety count and hides the room locally; it
does not contact a moderator. The UI now states that limitation.

A tip/gift interrupted by wallet connection preserves the amount and open form.
After connection, Dotify prepares a fresh quote for the connected payer. The user
must still confirm payment. Existing pending attempts take precedence over a new
quote. Wallet approval and network confirmation have distinct messages; a return
from the wallet triggers an immediate pending receipt check.

## Design and review map

1. `web/server/nearby.mjs`, `room-profile.mjs`, `signaling.mjs`: v5 search registers
   a bounded per-socket watch over the existing authorized search area. Public
   changes are coalesced for 200 ms. There are no global discovery broadcasts;
   private and out-of-scope changes produce neither frames nor sequence gaps.
   One watch per mode, 45-second expiry, at most 2,000 watched sockets and one
   in-flight snapshot per watch bound the pilot implementation. Old schemas keep
   their response shapes. Profile writes are host-only and bounded. Artist
   presence derives from existing verified room membership, never caller flags.
2. `nearbySession.ts`, `useNearby.ts`, `useRoomDiscovery.ts`: random watch IDs,
   increasing sequences and conservative relative deadlines reject stale updates.
   Pushes cannot extend the last acknowledged query lease. Stop/unwatch,
   permission denial, page lifecycle and room closure own cleanup. A live host
   can hold its last area; transport pongs renew only an existing held lease.
   A reconnect does not send a spurious opt-out. A restored hidden card retains
   its original expiry and expiry timer.
3. `RoomRadar.tsx`, `DiscoveryRoomList.tsx`, `NearbyControls.tsx`,
   `RoomProfileFields.tsx`, `ArtistPresenceBadge.tsx`: compact public identity,
   optional profile editing, persistent artist seal, reconnect state and a
   reversible local exclusion. Late profile replies cannot apply settings to a
   dismissed/unmounted panel. Reconnecting rooms cannot be joined from discovery.
4. `ArtistDonationButton.tsx`, `contributionFlow.ts`,
   `contributionReconciliation.ts`, `productCdmRuntimeAdapter.ts`: only the
   non-financial draft survives account connection. Quotes, receipt monitoring
   and payment scope remain account/network/runtime/work specific. Native
   broadcast references enter the existing journal before finality completes.
   An uncertain result never triggers a resend; success still requires a
   matching finalized receipt. Confirmation delays retain bounded backoff.

Keeping poll renewal alongside push preserves expiry and old-server fallback.
Faster polling alone would add location work and request pressure without
providing room-change notifications. Holding the last consented area preserves
connected background sessions without collecting background movement. The
tradeoff is that the displayed area may be stale until foreground return.

## Local validation

- Full frontend unit suite: 998 tests in 125 files passed. Two subsequent
  lifecycle regressions were added; the complete affected `nearbySession` suite
  passed all 43 tests. It covers background timing, no opt-out during reconnect,
  ordered pushes, permission revocation, expiry and reversible Hide.
- Full signaling suite: 121 tests passed. Live room-life tests cover scoped publication,
  explicit opt-out, query expiry, the eight-second reconnect grace, host-only
  profile writes and artist arrival/departure/discreet entry. The server package
  boot test uses the runtime directories copied by the signaling Dockerfile.
- Ordinary Web Nearby: seven browser tests passed, including publication and
  closure within a three-second test deadline, stable room identity and
  Hide/Show again. This is a deterministic local threshold, not a latency SLA.
- Product Nearby bridge fixtures: three browser tests passed. These prove
  application/bridge contracts, not actual OS permission or background behavior.
- Tip/gift browser suite: 25 tests passed, including disconnected gift/track-tip
  continuation, preserved amount, payer requote, native deferred confirmation,
  receipt recovery and no duplicate submission. Tests use wallet/chain fixtures;
  no funded transaction was sent.
- The visual fixture renders the actual radar and preview at desktop and
  390-pixel mobile widths. The seal is visible before hover; the mobile preview
  separates identities and passes its axe accessibility check. Screenshots are
  reproducible from `web/e2e/room-presence-visual.spec.ts`.
- Web and frozen Product builds passed. Lint has zero errors and two existing
  `App.tsx` hook warnings. Formatting and whitespace checks passed.

Commands from `web`, using Node 22:

```sh
npm run test:unit
npm run test:signal
npm run test:nearby
npm exec -- playwright test e2e/artist-gift.spec.ts e2e/room-presence-visual.spec.ts
npm run lint
npm run fmt:check
npm run build
npm run build:product-devnet:frozen
```

## Remaining acceptance and operating boundaries

Deploy signaling before the matching clients. There are no new secrets, flags,
storage mounts, CORS origins or contracts. See the
[deployment runbook](../../../operations/deployment-configuration.md#live-room-invitations-and-contribution-continuity-2026-10-18)
and [privacy amendment](../../../design/dotify-nearby-discovery-privacy.md#live-invitations-and-background-continuity-2026-10-18).

- This candidate has not been deployed. Physical Product Desktop/mobile checks
  remain for lock/unlock, app switching, permission revocation, network loss,
  authenticated reconnect and audio continuity. Native hosts without a silent
  permission observer can only recheck OS revocation on return to the app.
- Network-failure detection depends on transport timeouts. The eight-second
  discovery grace starts after disconnection is detected. OS suspension may
  still stop the connection or audio; this patch does not promise background
  execution the host OS cannot provide.
- The reported live pending tip has no transaction reference in the supplied
  evidence and has not been reconciled independently. Native funded payment,
  finalized receipt and room-chat acceptance remain open.
- Signaling is single-process and memory-only. There is no cross-replica watch
  coherence, durable room profile, staffed moderation inbox or new performance
  guarantee. Load acceptance and the existing public-pilot gates remain open.
