# A room you can stay in

Implementation pass against `dev` at `f6e6ee78645080cded22eafc1e45075cc9027016`, on `feat/killer-dapp-experience`.

## What the audit found

Current Shared Score / Living Light already provides a coherent musical identity, artist access gates, a persistent audio owner, server-authoritative chat/reactions/requests, a Three.js discovery renderer, and the W18 nearby privacy contract. The listening/community philosophy in the README, specification, context memories, presentation material, and public project page remains the foundation. Replacing these systems would add risk without improving first sound.

The initial 390 × 844 room had a 2,574px document, with its composer around 1,985px down. At 1440 × 1000 it was below the first screen too. Repeated room codes, access chips, roster, QR and track metadata competed with the conversation. Social sends cleared drafts even if signaling silently rejected them. The connection affordance was as visually prominent as starting music.

## Shippable experience

- A smaller editorial landing hierarchy, softer teal actions, more legible muted text, quieter connection control, and direct human copy. Existing artwork and track-driven light remain.
- Mobile rooms use a compact player, a readable presence line, and Chat / Requests / People views. The active view scrolls internally; playback and the composer remain in view. Drafts survive view changes and temporary disconnection, but are not persisted or transferred to another room.
- Desktop pairs playback and room controls with a bounded conversation pane. QR and participant details scroll independently. Requests are intentional suggestions, never described as automatically queued playback.
- The same persistent audio elements remain mounted across room views and navigation. No new key delivery, wallet requirement, contract write, or audio capture path.
- Text is cleared only after signaling acknowledges acceptance. Rejection or uncertain delivery keeps the draft, with no automatic retry. Old signaling versions can echo without acknowledging; the UI asks users to check before resending. An acknowledgement confirms server acceptance, not that everyone read the message.
- Reactions remain real server events. There are no fabricated listeners, sound energy measurements, or community activity.

## Bounded experiments

`VITE_DOTIFY_HOST_LINEUP=on` exposes a host-only local plan of up to 12 catalog tracks. It is deliberately labeled Preview, is neither saved nor shared, and clears when the player unmounts or the room changes. The host can order/remove items and open the next selection through the existing access gate. It has no autoplay, guest promise, synchronization, or bypass. This is a scaffold to test curation needs before changing the room protocol.

A shared queue needs a separate implementation: host-authorized mutations, room revision numbers, bounded entries by stable catalog identity, reconnect snapshots, idempotency, stale-track removal, and explicit `planned → opening → playing / blocked` states. Publish only safe title/artist/identity metadata; never source references or keys. The host must resolve access on every selection; a blocked entry must not interrupt the room or claim it is playing. Participant requests stay separate until explicitly accepted. Test ordering conflicts, denied tracks, host resume, late join and room deletion before rollout.

`VITE_DOTIFY_ROOM_GALAXY=on` enables the existing 3D renderer selector. Off is the shipping default. Real Socket.IO room data drives both modes. The 2D sky/list remains complete, including mobile, reduced motion, WebGL failure and context loss. Three.js loads only for the opted-in renderer on the ordinary web build. The current Product DevNet profile also emits separate chunks; the legacy Bulletin single-file profile can inline dependencies and needs its own measurement. Positions have no relationship to geography; visual movement is not a sound-energy claim.

## Nearby: keep the research boundary

Use the existing [W18 privacy contract](dotify-nearby-discovery-privacy.md) and typed protocol proposal. This pass collects no location and exposes no live nearby toggle.

The first UX should present two independent decisions: a host chooses “Appear nearby for this room”; a listener chooses “Find rooms in an approximate area.” Before any browser permission, explain what the operator receives and the limits of coarse location. Offer “Choose an area” and a venue QR at the same level. Denial returns to normal rooms without a repeated prompt.

Host confirmation must name the current approximate area and expiry, and offer “Stop appearing.” Listener results should say “Around this area,” never exact distances. Empty/sparse results expand the area only with clear explanation; no inferred friends, wallet names, or persistent presence history. Stop, permission revocation, expiry and room closure erase the ephemeral record. IDs rotate on new room, cell change, revocation and the W18 interval. Coordinates stay device-side; cells and room metadata still carry correlation risk. Do not claim anonymity.

Before enabling a prototype: validate allowlisted payloads, authenticated host ownership, expiry, revocation, rate limits, sparse-area behavior and moderation. Test no location data in logs, analytics, local storage, chain or public beacons. Keep the W18 manual-area / external-browser fallback where Product host location capability is unproven. The existing privacy simulation remains synthetic evidence, not a live privacy audit.

## Direct support, clearly explained

Use the existing artist profile and support receipt as the value-flow destination. In-room artist entry can say “Artist & support”; choosing it is distinct from making a payment. Keep amounts, asset symbols, recipient shares, confirmation state and access limits visible at the actual decision. “Proof of support” must link to a real receipt. Pending payment is never confirmed support; deferred royalties are not paid-out revenue. Do not introduce gifts or a host fee without an implemented settlement policy.

## Recurring listening circles: next product experiment

Start with a named ritual and a reusable invitation, not a social graph. A host may explicitly save a circle name, intention and next session time; participants choose whether to keep the invitation. Join remains possible without an account. Recurrence creates fresh ephemeral rooms and fresh presence. Canceling a circle revokes future invitations without erasing someone else’s independent notes.

A shared moment can be saved only after a separate prompt naming exactly what will be kept: track reference, optional host-written note and session date. Default to no attendee list, no chat transcript, no location and no listening history. Every contributor approves attributed text. Show who can see it, a clear deletion control, and an expiry before saving. Deletion must remove the server object and stop future sharing; downloaded copies cannot be recalled. Avoid immutable storage for personal memory. Notifications and artist-hosted session reminders need their own opt-in and easy cancellation.

Validate with a few facilitated sessions: can guests join and hear, send a message without losing the player, explain where support goes, and choose to leave without data obligations? Only voluntary, clearly disclosed feedback should inform this test. Nearby and memory are not prerequisites for a useful room.

## Proposed PR boundaries after this pass

1. Visual tokens, landing hierarchy, responsive/readability polish, public page alignment.
2. Active-room viewport, compact persistent playback, conversation panels, composer and draft behavior. Include text acknowledgements and their server tests here because reliable composing depends on them.
3. Host lineup scaffold and existing request curation polish; default-off flag. Shared queue protocol stays a follow-up.
4. Default-off gate around the existing galaxy and its regression evidence. Do not claim the existing renderer as newly implemented.
5. Nearby/circles UX and architecture documentation, referencing W18 rather than rebuilding it. No geolocation runtime.

Keep these as one reviewable working branch until the pass is accepted. Do not open five speculative PRs or claim unrelated readiness gates are complete.
