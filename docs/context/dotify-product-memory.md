# Dotify product memory

## Protected account interruption published, 2026-11-05

[Web and Product 0.1.73](../backlog/implementation/evidence/product-0.1.73-rollout-2026-11-05.md) deliver merged #386 from exact tested
source `560e7332`. Disconnect/account/network changes retire the old protected
source and producer; reopening requires explicit normal authorization checks.
Free/profile-only playback is preserved. Independent Web/CAR/DotNS readback passes;
12 app stores / 3,557,988 bytes, eight reuses and two signing requests stay within
the approved cap. The local signer is removed; API/custody, media, admission and
keys are unchanged. The public Free route rejects Classic with NOT_FREE and no
key; this is not a signed unentitled-listener test. The owner confirms sound
stops on disconnect and explicit recovery works on Web, Desktop and mobile.
Account switching, signed denial and room-guest silence remain unverified.
Reserve 291 renewals / 84,178,313 bytes; no renewal is
submitted and earliest reused expiry remains block 1,532,185. W33 stays open for
physical access/interruption, conservation and coherent off-volume recovery.

Next iteration: [#388 listening controls and discovery](../backlog/listening-controls-and-discovery.md) records the
owner's mobile Player disconnect, room track-details and lock-screen artwork/
previous-next requests. The [client implementation candidate](../backlog/implementation/evidence/listening-controls-and-discovery-2026-11-05.md) reuses the existing account sheet,
current room identity and shared playback ownership. Public artwork is resolved
for Media Session and relative-seek actions are cleared. Local automated checks
pass; review, matching delivery and physical lock-screen evidence remain open.
No service/storage policy or deployed version changes.

## Registered Bulletin playback published, 2026-11-04

[Web and Product 0.1.72](../backlog/implementation/evidence/product-0.1.72-rollout-2026-11-04.md) publish merged #385 from exact tested source
`018011d4`. Independent block/CAR/DotNS/Web readback passes; 12 app stores /
3,557,283 bytes, eight reused blocks and two signing requests stay within the
owner-approved cap. The local signer is removed. The fresh eight-second release
is already registered as **Thot Nzeng**, at block 15,321,680 / 1.42 PAS; this
client-only rollout preserves its audio, metadata and access checks. API/custody
remain source `e2dd6148`, with no restart or policy change. The owner confirms hearing all eight seconds on Web, Desktop and mobile.
Next: protected denial/interruption, dependency conservation and coherent
off-volume recovery. W33/#288 remains open.
Older dated checkpoints below describe their state at that time.

## Product 0.1.70 and exact repair admission, 2026-11-03

The [verified rollout](../backlog/implementation/evidence/product-0.1.70-rollout-2026-11-03.md) deploys the required artist-name checks and admits
one exact **Thot Nzeng** metadata repair for the preserved synthetic pilot.
Audio, cover, old metadata, receipts and original allowances remain intact;
no re-encoding or attempt reset occurs. The permit itself sends no metadata and
registers no release. Next: resume the saved draft through normal artist upload
and wallet approval, then verify protected Web/physical Host allowed and denied
listening. Conservation/renewals and off-volume restore remain W33 gates.
Older dated checkpoints below retain their historical meaning.

## Product 0.1.69 deployment, 2026-11-02

The [verified rollout](../backlog/implementation/evidence/product-0.1.69-rollout-2026-11-02.md) updates Web, Product and the existing API/custody
services, and activates one bounded Bulletin cover/metadata policy without Pinata
fallback. The artist no longer chooses an optional archive. At this rollout, the
synthetic audio job still needed controlled recovery with its three attempts
preserved. [The subsequent recovery record](https://github.com/knzeng-e/dotify/pull/380)
confirms ready audio; merged #382 prepares the remaining name-only metadata repair,
without activating it. Registration and protected physical-device acceptance remain
open. No allowance/counter reset, new service or key installation occurred.
Conservation monitoring/renewal and off-volume restore remain open; Capacity stays
deferred research. Older checkpoints below retain their dated meaning.


> 2026-10-28 owner decision: retire the optional 3D renderer and Three.js.
> Radar and List remain the supported discovery views. Historical 3D delivery
> notes below are evidence, not a request to restore it. Immersive metaverse
> exploration is deferred, with no implementation commitment.


## Delivery checkpoint, 2026-10-26

Use the [current backlog reconciliation](../backlog/implementation/evidence/backlog-reconciliation-2026-10-26.md)
and [candidate plan](../operations/pilot-release-plan.md) before acting on older
snapshots below. They distinguish delivered work, Product 0.1.62 publication,
pending client corrections and the remaining physical/pilot acceptance gates.

## Product identity

Dotify is a decentralized cultural social hub for real-time shared listening.

It combines:

- familiar music discovery;
- ephemeral listening rooms;
- artist-owned smart runtimes;
- rights-aware access policies;
- protected audio delivery;
- social propagation through listeners and ambassadors.

Dotify is not a Spotify clone. It should borrow the best UX lessons from Spotify Jam, Jukebox Duo, Stationhead, Audius, Funkwhale, and other references, but its center is different: music as shared presence and artist sovereignty.

## Core promise

Artists can publish tracks while retaining control over catalog, rights, royalties, and access policy.

Listeners can discover and listen through a familiar player experience.

Hosts can open real-time rooms and let others enter the same listening moment.

The app should transform isolated music consumption into human connection.

Product Desktop/mobile must offer Dotify's supported application features by
default, with the same product scope as Web. Platform adapters handle actual
capabilities; user consent and operational rollback remain separate controls.
Nearby follows this rule: availability is default, location and room visibility
start only through explicit user actions, and missing Host support is explained.

## User roles

### Listener

A listener browses tracks, listens to previews, unlocks access for individual full playback, joins rooms, and discovers artists through other humans.

The listener experience must remain simple. Wallets and access policies should not become the first thing the listener feels.

As a room guest, the listener should be able to join and listen without wallet/signature friction. Room guests receive only the ephemeral WebRTC stream, never protected source files or content keys.

### Host

A host turns listening into a social event.

The host creates a room, plays a track, and shares a link/code. The room is the social heart of Dotify.

For protected room playback, access is checked against the host. If the host is authorized, the host may receive the temporary content key and stream full audio. If the host is unauthorized, Dotify should keep the room alive, show a discreet host-facing CTA, stream no protected audio, and let the host switch to a playable track.

### Artist

An artist publishes music through an artist-owned SmartRuntime.

The artist should feel that they are not merely uploading content into a platform, but defining how their music circulates, who can access it, and how value flows back to contributors.

### Ambassador

An ambassador is a listener who helps music travel.

The ambassador model should reward meaningful cultural propagation, not empty referral spam.

## Differentiation

Dotify must not compete by saying “we also stream music.” That fight is lost before it begins.

Dotify competes by combining:

1. real-time shared listening;
2. artist-owned rights/access logic;
3. protected audio delivery;
4. Web3 transparency without Web3 friction;
5. human-centered discovery;
6. future ambassador mechanics around cultural transmission.

## Competitor lessons

### Spotify Jam

Lesson: room UX must be frictionless.

Take inspiration from simple invitation, shared queue, and low-friction joining.

Do not copy Spotify's platform dependency or individual-consumption logic.

### Jukebox Duo

Lesson: browser-based synchronized listening can feel lightweight and immediate.

Take inspiration from link-based room joining, collaborative queue, focus mode, and simple distance listening.

Dotify must go further by adding artist sovereignty and protected rights.

### Stationhead

Lesson: fan communities around live listening are powerful.

Take inspiration from social energy, live presence, and fan participation.

Dotify should preserve a stronger artist-owned infrastructure layer.

### Audius

Lesson: decentralized music infrastructure matters, but the social listening room is Dotify's sharper wedge.

Take inspiration from artist empowerment, but do not become a generic Web3 music catalog.

### Funkwhale / Navidrome / Spotube

Lesson: open-source music software can inform catalog, streaming, self-hosting, and user control.

Take inspiration selectively. Do not let self-hosting complexity dominate the mainstream listener experience.

## UX principle

The product should feel like:

```txt
create a room -> share a link -> listen together
```

not like:

```txt
connect wallet -> understand runtime -> understand IPFS -> understand access mode -> debug RPC -> maybe listen
```

Blockchain should be felt as trust, not as bureaucracy.

## Access doctrine

Dotify distinguishes direct file access from room presence.

- Individual playback: the listener must satisfy the access policy before receiving a temporary content key.
- Room playback: the host must satisfy the access policy before receiving a temporary content key.
- Room guests receive WebRTC media only.
- Room guests must not be forced to connect a wallet or sign merely to listen.
- If the host lacks access to a protected track, the room should stay open with a host-facing unlock/personhood CTA and no protected audio stream.

This is the compromise: protect the artist's source-file distribution without killing the social flow.

## Product priorities

September 2026 execution clarification: Product DevNet is a first-class
destination alongside ordinary mobile/desktop web, with acceptance based on
real host capabilities. A coherent responsive identity and an optional 3D
room galaxy express the shared-presence purpose; sound activity must use real
data, and discovery must retain an accessible 2D/list path. Nearby discovery
is the next owner-prioritized expansion as of 2026-10-14, with separate host
visibility/listener search and approximate km radii. It never publishes precise
host coordinates. Stablecoin feasibility is Later; artist features and key
portability are scoped Next follow-ups after the first Nearby slice. This is
planning, not a claim that location collection is enabled. Follow `docs/backlog/implementation/README.md` for the current
sequencing, pilot gates, and agent prompts. The earlier lists below remain
historical context where their priorities differ.

### Music / now

- protected Classic unlock;
- artist publish flow;
- additional rights-holder royalty splits during publish;
- public hosted rooms;
- simple join link;
- host-based room access;
- production key delivery;
- tests for core flows.

### Next

- standalone production operation: public API/signaling evidence, DAV2
  validation, frontend health, and deployment smoke checks;
- Product SDK / Playground feasibility as progressive enhancement, not a
  blocker for first sound;
- Human free access through real Humanity / Individuality after a
  privacy-preserving source and address-binding design is proven;
- room resilience, provenance, and consented social memory;
- artist profile pages;
- ambassador event model.

### Later

- transparent vote-based awards;
- NFT or memory-object rewards for top ambassadors;
- statement-store signaling exploration;
- mobile app;
- richer community governance.

## Product danger zones

- Becoming “Spotify with blockchain.”
- Becoming an NFT marketplace with music attached.
- Adding tokenomics before trust and usability.
- Making wallet friction the first experience.
- Requiring room guests to authenticate before feeling the room.
- Overpromising DRM.
- Treating the artist portal like a cold admin dashboard.
- Treating rooms as secondary when they are the social core.

## Product mantra
**Let the music connect the dots**

This is Dotify's official slogan. Keep its wording in the app's About view,
brand assets, README and public project presentation. Supporting copy must not
replace it with a new slogan unless the owner explicitly changes the direction.

Make music social again without dispossessing the artist.

## Prepared Bulletin recovery, 2026-11-02

[Maintenance-only recovery](../operations/bulletin-prepared-job-recovery.md)
authenticates existing output and binds an operator continuation to an inspected
plan. Three preparation attempts, storage caps, account cursors and nonce history
are preserved. There is no new artist action or public route. This implementation
is not live recovery; artist approval and protected Web/physical Host acceptance
remain open, followed by retention/restore work.

## Synthetic pilot recovery completed, 2026-11-02 21:49 UTC

The [approved API-only intervention](../backlog/implementation/evidence/bulletin-prepared-recovery-rollout-2026-11-02.md)
made the original job ready through 16 verified stores / 712,737 bytes. Attempts
remain three; custody and public readiness are restored. Product/Web stay 0.1.69.
The subsequent artist-name rejection is addressed by merged #381/#382, awaiting
client rollout and separately authorized metadata repair. Then the artist can
resume the preserved draft and approve registration.
Protected physical/Web acceptance, conservation/renewal and off-volume restore
remain gates; no broader artist allowance or automatic renewal is enabled.


## Prepared-release recovery published, 2026-11-04

[Product 0.1.71, Web and existing services](../backlog/implementation/evidence/product-0.1.71-rollout-2026-11-04.md)
now let the artist preview and explicitly restore the original prepared details,
price and artwork before ordinary Publish. Ready audio and the exact name-only
permit remain intact. The rollout itself publishes only the app; the artist still
submits corrected metadata and approves registry publication. Protected Web and
physical Host acceptance, conservation/renewals and off-volume recovery remain gates.


## Clean publication trial replaces draft repair, 2026-11-04

The owner could not find an unpublished release to resume. A retained audio job
is not a recoverable studio draft, and the next cover refusal precedes the new
metadata recovery offer. The [fresh trial](../backlog/implementation/evidence/bulletin-fresh-pilot-activation-2026-11-04.md)
now admits one normal New release independently of the abandoned graph. Old state
is preserved and inactive; the artist selects the generated eight-second fixture,
chooses details/cover, then signs ordinary publication. This is a bounded test,
not successful registration or general multi-release readiness. Prioritize a
successful end-to-end flow; ordinary draft editing and usage-based admission must
remove the need for operator intervention on routine artist choices.
