# Relational experiences: Rooms, Imprints, Gardens

Status: **concept and product-design direction**, recorded 2026-11-19. None of the new experiences below is implemented or authorized for release by this document. The live execution order remains the [selected production-readiness sequence](../backlog/implementation/listening-and-publication-readiness.md); the community-gated progression is in the [relational-experience roadmap](../backlog/relational-experience-roadmap.md).

## Why this exists

**Audience:** artists, listeners, designers, contributors and future cultural partners deciding what Dotify should become after its listening foundation proves reliable.

Dotify began as Muzinga: people near each other, often isolated by individual headphones, might find common ground through music. Its first promise is simple: open a room, share a link, listen together while the artist retains authority over access, rights and value flows. That remains the product's center, not a disposable first version.

The new question is: **What can people live together through Dotify that they would be unlikely to live otherwise?**

Our proposed answer unfolds along three connected dimensions:

| Dimension | Human gesture | Artistic meaning | Starting point |
| --- | --- | --- | --- |
| **Rooms — presence in the present** | Listen and respond together, now | A shared musical moment, not merely synchronized playback | Existing live rooms, chat, reactions, host queue and artist activity |
| **Imprints — presence across place and time** | Leave or discover an intentional musical trace somewhere | A place becomes a carrier of memory, invitation or encounter | Future spatial experiment, not an extension of live-room location sharing |
| **Resonance Gardens — encounters that transform art** | Care for an evolving, artist-authored work with others | A work carries the history of voluntary relationships | Long-range creative research, not a tokenomics requirement |

The progression is relational rather than additive: a room may yield an explicitly chosen shared memory; a memory may later be anchored to a place; voluntary encounters at that place may one day contribute to a living artwork. None of those transitions happens by default.

**Design maxim:** Less attention spent managing Dotify, more life shared through it.

## 1. Rooms: a grammar of encounter

Today, Dotify already supports wallet-free room guests, live host-led playback, chat, reactions, track suggestions, artist discovery and opted-in Nearby/Worldwide room listings. The proposal is to increase the quality and intelligibility of the moment before expanding its technical surface.

### Listening intentions and rituals

A host, artist or consenting participant could optionally open with a simple intention: a memory evoked by the track, a question, an invitation to listen quietly, or a brief post-listening reflection. A room must remain equally useful with no prompt at all. Silence is participation, not a low engagement score.

A low-risk first study can use the existing pinned-message and chat behaviors, without new payments, persistence, identity or playback rules. Observe whether people experience meaningful listening, unexpected artist discovery and a desire to meet again; do not infer emotion from clicks, biometrics or connected-session counts.

### Voluntary memories, not permanent surveillance

A room's ordinary chat is deliberately ephemeral; closing it clears its social history. Preserve that default.

An optional **musical postcard** could be deliberately assembled from a track reference, a newly written note and possibly a consented image or selected contribution. Every participant whose words or likeness are used must explicitly approve them; the absence of consent means the material is omitted. No automatic transcript archive, room recording, hidden social graph or persistent attendance history.

The postcard may later be private, shared by link, or — if every relevant permission is granted — published as an Imprint. The memory object, its audience, ownership, expiration and deletion policy require separate design before implementation.

### Shared agency

The host still owns playback authority and the protected content key; guests receive the stream. Optional formats may allow proposals, turns or host-approved choices. Collective participation must never create a path for guests to bypass host authorization, paid release access or artist policy. Keep the session easy to enter; a social ritual cannot require a wallet.

## 2. Imprints: leave music in the world

An **Imprint** is a user- or artist-authored, place-associated invitation containing a permitted music reference or licensed excerpt and optional words, poem or visual. It is *not* a piece of audio uploaded to an arbitrary wall, an automatic tracking device or a public claim over a real-world location.

### Place, placement and discovery

- **Remote placement:** a creator may select a point or area on a map from anywhere. They do not need to stand there to compose a trace.
- **Optional on-site discovery:** a person voluntarily explores a map and, if they grant location permission, unlocks a location-conditioned experience within a defined approximate area. Coordinate uncertainty must be explained and a non-location alternative considered.
- **No physical installation required:** a GPS anchor can exist entirely in the app. A physical QR code is an optional, partner-authorized entry point in a museum, festival or cultural venue, not the foundation of the system.
- **Augmented reality later:** a wall, mural or tree could eventually host a visual overlay, where lawful and appropriate. Do not make AR, camera access or hardware support necessary for the first experiment.

Potential modes: public discovery, a link-only gift, a specific recipient with actual server-enforced authorization, ephemeral or time-windowed traces, and artist- or venue-curated trails. A secret target name in client metadata is **not** access control; private content needs real authorization and protection. Not every tagged place should become visible to everyone.

**An access choice should be generous, not compulsory.** A listener unable to travel should still be able to experience a complete artistic work; journeys may add *supplementary* colors, remixes or stories rather than filling an artificial absence. A person present elsewhere could voluntarily share an experience, without pretending the recipient visited the place.

### Two initial art formats

**Music treasure hunt.** An artist associates an album's tracks or sanctioned excerpts with several places. Each encounter offers a satisfying experience in its own right; visiting more places enriches a personal composition or collection. Sequence-dependent variations are an optional artist-authored experiment, not a default obstacle. A collectible may certify discovery, but a track's release NFT and the copyright/master are not interchangeable and should not be automatically fragmented or transferred.

**Collective revelation.** An artist may set an explicit condition, for example three consenting people arriving during the same short window. On verified fulfillment, the work can be revealed only to that group, or released for later visitors. The second choice is a contribution to a shared cultural commons. A check-in, geofence or QR scan is only an imperfect signal of presence; anti-spoofing is proportional to the value at risk. Do not claim these signals prove unique consciousnesses.

Both formats must respect artist licensing and runtime access controls, including Free, Classic and future privacy-reviewed Human free. A location or collection token cannot silently grant a protected content key.

### Imprint ecology and safety

A map is not an unlimited public wall. Before open creation, specify reporting and takedown, opt-in discovery, quotas and expiration, venue-owner sensitivity, rights clearance, prohibited targeting/harassment, abuse prevention and accessible alternatives. Avoid precise public histories of visitors or creators. The [Nearby room privacy contract](dotify-nearby-discovery-privacy.md) protects *live room hosts* with approximate areas; it must not be repurposed as a durable map of people or treated as implementation of Imprints.

## 3. Resonance Gardens: compose the conditions of transformation

A **Resonance Garden** is a speculative living artwork: an artist, or a group of collaborating artists, creates a recognizable musical identity with motifs, timbres, harmonies and rules for their transformation. The community contributes through voluntary encounters and creative gestures; an authored engine determines how the piece appears, changes, rests and renews itself.

A possible prototype is a musical seed placed at an authorized site. Co-presence may unlock a harmony; distinct community contributions might invite new arrangement branches. Over weeks, the garden could enter dormancy, not death. Its winter version should be compositionally meaningful, never a guilt-inducing "please feed me" alarm. A quiet work can remain artistically rich. **Vitality and aesthetics are different variables**; popularity is not the objective measure of value.

### Coherence across space and time

Distinguish an artwork's persistent **identity** (artistic rules and lineage) from its **manifestations** in Toulouse, Libreville or other places. A shared musical "genome" can preserve identity while local manifestations evolve differently.

- **Resonance:** existing manifestations of the same work influence each other without becoming identical.
- **Hybridization:** two distinct works, with their artists' consent, give rise to a third work with a traceable genealogy.
- **Temporal correspondence:** someone may hear in November an authorized motif formed during a July encounter elsewhere; people who never met can contribute to one evolving artistic history.

An artist defines the permissible transformation space, collaboration and attribution rules. Proposed persistent tokens or dynamic NFTs may represent identity, authorized lineage or rare milestones, not hourly attention extraction. No promise of financial yield, resale, or universal measurement of consciousness is implied. Capture only meaningful, consented state transitions; do not write every visit, chat or GPS coordinate on-chain.

**Cultural hypothesis, not accepted behavior:** these gardens might encourage people to care for works, and works to care for relationships. That hypothesis must be tested with artists and communities, not assumed.

## Cross-cutting principles

1. **Each experience is complete in itself.** The next encounter brings a *supplement*, not a missing mandatory piece.
2. **The relation comes first.** Do not trade human presence for manufactured engagement or artificial scarcity.
3. **Artists remain sovereign.** Track rights, royalties, licensing, contributions, access conditions and upgrades retain the artist's authority; a visitor is not free to republish another artist's master or monetize it merely because they can listen.
4. **Privacy by absence.** Do not collect history unless it is necessary, intentional, bounded and explainable. Use real server policy for private gifts, not hidden buttons or opaque NFT metadata.
5. **Human participation is voluntary.** Listening alone, without geolocation or token ownership, remains a first-class experience; provide an accessible non-travel route to additional cultural meaning where possible.
6. **Cultural evaluation before economic incentives.** No rewards for GPS streaks, raw connection counts, attention minutes or repeated check-ins.
7. **Aesthetic restraint.** The map, QR code, visual galaxy and AR are doors to listening and people, not the subject of the experience.
8. **Proofs are scoped.** A room session is not a unique person; a geofence is not proof of physical authenticity; a token is not copyright; a test build is not a verified pilot.

## Existing seams, not a new application

- Rooms and ephemeral social messages: [listening rooms](../explanation/listening-rooms.md) and [room social layer](../backlog/20-room-social-layer.md).
- Artist-run policy and future opt-in modules: [artist-runtime features](../backlog/artist-runtime-features.md).
- Rights, protected media and service ownership: [architecture](../explanation/architecture-overview.md).
- Exact implementation order and evidence: [production-readiness sequence](../backlog/implementation/listening-and-publication-readiness.md).
- Proposed phases, experiments and community checkpoints: [relational-experience roadmap](../backlog/relational-experience-roadmap.md).

This document is a design memory, not an implementation ticket, contract specification, pricing decision, feature flag, roadmap approval or release declaration.
