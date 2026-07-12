# Dotify Thresholds - product and implementation blueprint

Status: selected direction and functional-v1 blueprint.  
Last reviewed: 2026-07-11.

This document translates Dotify's product, technical, and philosophical north
stars into a coherent experience. It is intentionally broader than a visual
specification: interaction, language, domain boundaries, security, performance,
and delivery order are one product decision.

The non-negotiable outcome is simple:

> A person opens a link, hears a shared musical moment, perceives who is there,
> and only meets wallets or chain operations when they choose an action that
> needs them.

## 1. Three candidate concepts

### A. The Hearth

**Metaphor.** A work is a source of warmth. Solo listening is a quiet watch; a
room is the circle that forms around it.

**Entry.** A room link opens on the host, the work, and the real people already
present. `Enter and listen` is the only primary action.

**Room and presence.** The work sits at the center. One calm mark per real
participant occupies its perimeter; names and counts remain available as text.
Chat stays secondary to the music.

**Artist discovery.** `See where this work comes from` opens the artist's live
context, catalog, and terms.

**Support.** A plain receipt shows what opens, for how long, the amount, the
artist share, collaborators, and fees. The fire metaphor stops before payment.

**Strengths.** Warm, immediately social, excellent for small rooms, easy to
understand.

**Risks.** Fire imagery can become decorative or folkloric; a large catalog is
hard to express; solo listening can feel like an incomplete room.

**Difference.** The product is a circle of co-presence, not a catalog or feed.

### B. The Current

**Metaphor.** A work is a cultural current. People help it travel; a room is a
temporary confluence.

**Entry.** A guest joins the current at the exact moment heard by everyone else.

**Room and presence.** Human traces meet the playback line. A room shows source,
host, participants, and proposed next direction without turning into a graph
dashboard.

**Artist discovery.** A listener can move upstream to the artist or follow a
work introduced by another participant.

**Support.** Value visibly flows to artist and collaborators. Consent-based
provenance can later show how the work reached this moment.

**Strengths.** Best expression of cultural transmission, provenance, and value
splits.

**Risks.** It needs motion and data that do not exist yet; it can become an
infographic, surveillance map, or decorative shader.

**Difference.** Discovery is a human path rather than an algorithmic ranking.

### C. Thresholds - selected

**Metaphor.** A work opens a space. A room link is its threshold. The artist's
access policy describes how the durable listening door opens.

**Entry.** A shared link opens directly on: `Aicha welcomes you around Marée
basse - 5 people are here`. The next gesture starts or reconnects sound. No
account or wallet is required for room listening.

**Room and presence.** Solo and room listening share one spatial language.
`Open a space around this work` turns private listening into a shared moment
without changing mental model.

**Artist discovery.** The artist remains the source of the space. Their page
starts with what is alive around their work now, then catalog and terms.

**Support.** `Support and open this work` explains the right, duration, amount,
split, and fees before choosing a confirmation method.

**Strengths.** Best link-to-sound path, clean mapping to access policy, strong
solo-to-room transition, accessible and performant without invented data.

**Risks.** Literal doors or 3D rooms become kitsch. Poetic labels must always be
paired with literal actions and states.

**Difference.** Dotify is organized around transitions - enter, hear, open,
welcome, support, transmit - rather than inventory to consume.

### Decision matrix

| Criterion | Hearth | Current | Thresholds |
| --- | ---: | ---: | ---: |
| Link to first sound | Strong | Strong | Excellent |
| Room as product center | Excellent | Good | Excellent |
| Solo to shared transition | Good | Good | Excellent |
| Access policy clarity | Medium | Good | Excellent |
| Future provenance | Medium | Excellent | Good |
| Accessibility and performance | Good | Risky | Excellent |
| Progressive migration | Good | Difficult | Excellent |

Thresholds wins because it works before provenance, ambassadors, live Proof of
Personhood, or a Product SDK integration exist. It can be honest on day one.

## 2. Product invariants

1. A room guest hears the host stream without a wallet, signature, payment, or
   content-key request.
2. A room guest receives neither content keys nor protected source references.
3. Individual protected playback fails closed and names the real missing action.
4. A Free work plays without wallet friction after the backend verifies the
   current on-chain public policy.
5. The current artist-owned runtime is the durable source of truth for policy,
   price, and value split.
6. No visible presence, reaction, room, support, or provenance event is
   fabricated.
7. No public advertising profile is required. Display names may remain local or
   ephemeral.
8. Encryption protects key and source-file distribution; it is not described as
   DRM and cannot prevent recording after authorized listening.
9. The UI never asks the user to choose `Product` or `standalone` mode. The
   platform adapter is selected by capability.
10. Awards, transferable objects, and ambassador rewards remain after the
    production spine, real humanity checks, consent, and anti-abuse rules.

## 3. Information architecture

### Public listening space

- **Room threshold** - host, work, real presence, sound state, one entry action.
- **Now** - what is live, an invitation to open a room, and a finite set of
  available works.
- **Explore** - works and artists, with filters only when the catalog needs them.
- **Work** - listening space, access terms, artist, support, collaborators, and
  later consent-based circulation.
- **Artist** - live rooms first, works second, statement and verifiable details.

### Personal space

- **You** - display name, privacy, opened works, artists supported, wallet only
  as an enabling method.
- **Passages** - optional memories and consented transmissions, only after real
  data exists.

There is no generic public follower profile and no infinite feed.

### Artist studio

- **Overview** - works alive now, support received, runtime health.
- **Works** - drafts, published works, policy state.
- **Publish** - audio, identity, listening door, split, review.
- **Access** - Free, paid, human-free, and future community/time policies.
- **Value** - receipts, collaborators, fees, and verifiable proofs.
- **Circulation** - real rooms and consented discovery aggregates only.
- **Advanced** - runtime, transaction, wallet, and explorer details.

### Navigation

Mobile uses `Now`, `Explore`, `Rooms`, and `You`, plus the contextual `Open a
room` action. A room share link bypasses the general navigation and opens the
threshold. In a live room, global chrome recedes.

## 4. Core journeys

### 4.1 Guest - room link to first sound

1. Parse the canonical `#/rooms/<roomId>` link.
2. Connect to signaling and load public room metadata in parallel.
3. Show host, work, real count, and sound state before any identity request.
4. Ask for a local room name only when none is remembered.
5. `Enter and listen` joins and satisfies browser autoplay intent.
6. Negotiate WebRTC; never call upload, key, wallet, or chain APIs as a guest.
7. Show explicit `Start audio` only when the browser blocks autoplay.
8. Defer chat and track requests until the musical space is established.
9. Keep artist discovery, support, and share actions optional and non-blocking.

Primary metric: link open to first audible remote frame.

### 4.2 Solo listening to shared room

1. Opening a work immediately creates its listening space and loading state.
2. Free starts after server policy verification; protected work shows its door
   and no degraded preview.
3. `Open a room around this work` asks only for a room display name.
4. The host policy is checked; if denied, the room stays open with no protected
   stream and a host-facing action.
5. The share link and QR are ready as soon as room creation is acknowledged.
6. Guests receive only the ephemeral media stream.

### 4.3 Transparent support

1. `Support and open - 1.2 DOT` opens a summary sheet.
2. Show the right received, duration, artist, collaborators, network fee, and
   total before a wallet or Host confirmation.
3. Select the confirmation adapter only after the person confirms the summary.
4. Use human states: `Confirmation requested`, `Support being confirmed`,
   `Work opened`.
5. A refusal sends nothing and never ejects the person from a room.

### 4.4 Artist publication

1. Add audio and image.
2. Name and describe the work.
3. Choose the listening door with concrete examples.
4. Define a split that totals 100 percent.
5. Preview the guest, individual listener, and room-host outcomes.
6. Review storage, policy, price, and collaborators.
7. Confirm the resumable runtime/publication transaction sequence.
8. The published work appears in the artist space and can immediately host a
   room.

### 4.5 Consent-based transmission - later

1. After a meaningful listen, ask `Keep a trace of this passage?`.
2. State exactly what is stored, for how long, and who can see it.
3. Require explicit opt-in; refusal changes neither listening nor access.
4. Render only real, consented events and aggregate where individual detail is
   unnecessary.

### 4.6 Product Host and standalone browser

The result language stays identical. On a sensitive action:

- the Product adapter delegates account, signing, chain, storage, network, or
  personhood to the Host;
- the standalone adapter uses injected wallets, configured RPC, browser APIs,
  and backend services;
- missing capability gives a product-level alternative, never a raw TrUAPI,
  viem, RPC, or wallet-provider error.

## 5. Interaction and visual system

Thresholds is warm night architecture, not literal doors or rooms. Large matte
fields create calm. A cover behaves as an aperture: local work color can light
its immediate space, but never determine text contrast.

This direction deliberately moves away from the existing blue dashboard,
galaxy, console, and orbit metaphors. It retains deep blue as a trust color,
cyan for decisive action, and Polkadot pink only as a restrained infrastructure
accent.

```css
--threshold-canvas:       #f3efe5;
--threshold-ink:          #111d31;
--threshold-ink-muted:    #5e6674;
--threshold-night:        #101a2d;
--threshold-room:         #192640;
--threshold-paper:        #fffaf0;
--threshold-action:       #00b98e;
--threshold-action-hover: #008f70;
--threshold-warm:         #f2b35d;
--threshold-presence:     #55b8c6;
--threshold-polkadot:     #e6007a;
--threshold-success:      #257a57;
--threshold-danger:       #b42318;
--threshold-focus:        #0078d4;

--threshold-radius-control: 12px;
--threshold-radius-surface: 24px;
--threshold-radius-aperture: 52% 52% 22px 22px;

--threshold-motion-fast: 140ms;
--threshold-motion-state: 220ms;
--threshold-motion-enter: 460ms;
--threshold-ease: cubic-bezier(.22, 1, .36, 1);
```

Typography:

- editorial serif for work and artist titles, using a local/system fallback in
  functional v1 so no font blocks first paint;
- Hanken Grotesk for interface and explanatory copy;
- monospace only for room codes, hashes, addresses, and advanced evidence.

Motion maps to state only:

- aperture opens when playable audio becomes ready;
- one trace appears when a real participant joins;
- support confirmation crosses the threshold only after finality;
- all transforms stop under `prefers-reduced-motion`.

All touch targets are at least 44 by 44 CSS pixels. Focus never depends on work
color.

## 6. Wireframes

### 6.1 Public room threshold - mobile

```text
┌──────────────────────────────────┐
│ LIVE ROOM             Sound ready│
│                                  │
│ Aicha welcomes you               │
│ 5 people are here                │
│                                  │
│          ┌────────────┐          │
│          │   COVER    │          │
│          │  APERTURE  │          │
│          └────────────┘          │
│                                  │
│ Marée basse                      │
│ Lila Noor                        │
│                                  │
│ [       Enter and listen       ] │
│ No account. No wallet required.  │
│                                  │
│ Artist · How room listening works│
└──────────────────────────────────┘
```

### 6.2 Shared room

```text
┌──────────────────────────────────┐
│ ← Aicha's room     6 here   Share│
│                                  │
│          Aicha · host            │
│       Ines          you          │
│                                  │
│          ┌────────────┐          │
│          │   COVER    │          │
│          │   01:42    │          │
│          └────────────┘          │
│ Marée basse · Lila Noor          │
│ In sync with the host            │
│                                  │
│  heart  spark  wave  [React]     │
│ [Suggest a track] [Messages 3]   │
│                                  │
│ Support artist · View work       │
└──────────────────────────────────┘
```

Only the host receives full transport controls. Presence always has a literal
count and text list alongside visual traces.

### 6.3 Now

```text
┌──────────────────────────────────┐
│ Dotify                  Now      │
│                                  │
│ A LIVE MOMENT                    │
│ ┌──────────────────────────────┐ │
│ │ COVER  Marée basse           │ │
│ │ Aicha hosts · 6 here         │ │
│ │ [Enter]                      │ │
│ └──────────────────────────────┘ │
│                                  │
│ [ Open a room ]                  │
│                                  │
│ Other open thresholds            │
│ Nocturne · 3 here                │
│ Les manguiers · 8 here           │
│                                  │
│ Start with a work                │
│ [Search title or artist...]      │
│                                  │
│ Now      Explore   Rooms    You  │
└──────────────────────────────────┘
```

Empty state: `Nothing is open right now. Choose an available work and welcome
the first moment.`

### 6.4 Work and solo listening

```text
┌───────────────────────────────────────────┐
│ ← Explore                      Share      │
│                                           │
│ [ large cover aperture ]  Marée basse    │
│                           Lila Noor       │
│                           [Play]          │
│                           ━━━━━ 01:42     │
│                           [Open a room]   │
│                                           │
│ The artist opens                          │
│ Free for everyone · Rooms allowed         │
│                                           │
│ Story · Collaborators · Circulation       │
│ Support the artist directly               │
└───────────────────────────────────────────┘
```

### 6.5 Support sheet

```text
┌──────────────────────────────────┐
│ Support and open                 │
│ Marée basse · Lila Noor          │
│                                  │
│ You receive                      │
│ Durable listening access         │
│                                  │
│ Amount                   1.20 DOT│
│ Artist                    0.84   │
│ Collaborators             0.30   │
│ Estimated network fee     0.06   │
│                                  │
│ [ Confirm 1.20 DOT ]              │
│ Verifiable details ▾             │
└──────────────────────────────────┘
```

### 6.6 Artist and studio

```text
Artist                                   Studio
┌───────────────────────────┐            ┌─────────────────────────────┐
│ Lila Noor                 │            │ Studio of Lila Noor · ready │
│ Statement                 │            │ Overview Works Publish Value│
│ [Listen] [Open a room]    │            ├─────────────────────────────┤
│                           │            │ PUBLISH A WORK              │
│ LIVE NOW                  │            │ 1 Audio ✓                   │
│ Marée basse · 6 here      │            │ 2 Identity ✓                │
│                           │            │ 3 Listening door            │
│ WORKS                     │            │ (•) Free for everyone       │
│ cover title access door   │            │ ( ) Direct support [1.2]    │
│ cover title access door   │            │ ( ) Verified human          │
│                           │            │ Preview: guest / solo / host│
│ How control works ▾       │            │ [Back] [Value split →]      │
└───────────────────────────┘            └─────────────────────────────┘
```

No follower counts are invented. Runtime, wallet, and explorer evidence lives
under `Verify`, not in the primary listening hierarchy.

## 7. Software architecture

Target dependency direction:

```text
React UI
  -> application use cases
      -> domain models and ports
          -> standalone adapters
          -> Polkadot Product Host adapters
          -> explicit development adapters
```

Proposed modules:

```text
web/src/domain/
  catalog.ts
  access.ts
  rooms.ts
  publishing.ts
  identity.ts
web/src/application/
  enterRoom.ts
  playTrack.ts
  publishTrack.ts
  supportTrack.ts
web/src/ports/
  AccountPort.ts
  ChainPort.ts
  CatalogPort.ts
  ContentPort.ts
  RoomPort.ts
  MediaPort.ts
  StoragePort.ts
  PersonhoodPort.ts
  TelemetryPort.ts
web/src/adapters/
  standalone/
  product/
  demo/
```

Functional v1 does not rewrite the existing hooks at once. `useCatalog`,
`useSession`, and providers remain façades while one use case at a time moves
behind a port. Development adapters are selected only by explicit dev/e2e
configuration, never as a silent production fallback.

### Domain interfaces

```ts
type AccessDecision =
  | { kind: 'allowed'; basis: 'free' | 'paid' | 'artist' | 'personhood' }
  | { kind: 'denied'; reason: 'sign-in' | 'payment' | 'personhood' }
  | { kind: 'unavailable'; reason: 'chain' | 'policy' | 'content' };

interface AccountPort {
  current(): Promise<{ address: string } | null>;
  signChallenge(challenge: string): Promise<{ address: string; signature: string }>;
  submit(operation: ChainOperation): Promise<SubmittedOperation>;
}

interface AccessPort {
  decide(workId: string, audience: 'individual' | 'room-host'): Promise<AccessDecision>;
  support(workId: string, quote: SupportQuote): Promise<SubmittedOperation>;
}

interface ContentPort {
  resolvePlayableSource(work: Work, grant: ContentGrant): Promise<PlayableSource>;
  publish(input: PublicationAssets, intent: PublishIntent): Promise<PublishedAssets>;
}

interface RoomPort {
  listOpen(): Promise<PublicRoomSummary[]>;
  enter(roomId: string, displayName: string): Promise<RoomMembership>;
  create(workId: string, displayName: string): Promise<HostedRoom>;
  leave(): Promise<void>;
}

interface PersonhoodPort {
  status(): Promise<'verified' | 'not-verified' | 'unavailable'>;
}
```

Adapters return product results. The Product adapter never returns a private key
or constructs a client-side wallet from key material.

## 8. Data model

```text
Artist
  id, runtimeAddress, displayName, statement, verification

Work
  id/contentHash, artistId, title, description, imageRef, encryptedAudioRef,
  metadataRef, policy, royaltySplit, active, registeredAt

AccessPolicy
  kind = free | paid | human-free | future-community | future-window
  price, requiredPersonhood, duration, communityRef, startsAt, endsAt

Room
  id, hostLease, hostDisplayName, workSnapshot, createdAt, expiresAt, state

RoomPresence
  participantId, roomId, displayName, role, connectedAt, lastSeenAt

SupportReceipt
  workId, supporterAddress, amount, split, fee, operationRef, confirmedAt

TransmissionConsent - later
  subjectPseudonym, workId, sourceContext, destinationContext, scope, expiresAt
```

Storage placement:

- chain: artist runtime identity, work registry, active policy, durable rights,
  price, economic split, and confirmed settlement;
- backend/indexer: catalog projection, short-lived auth, revocation, publish
  intents, TURN grants, operational metrics;
- signaling/realtime: presence, player clock, reactions, chat, and requests;
- browser/Host local storage: preferences and optional local display name;
- never on-chain by default: heartbeats, reactions, messages, seconds listened,
  civil identity, or raw social graph.

## 9. Contracts and APIs

### Existing contracts to preserve and harden

- `ArtistRuntimeFactory` and `ArtistDirectory`;
- artist-owned runtime registry, access, royalties, NFT ownership, and upgrade
  pallets;
- generated frontend bindings from Hardhat artifacts.

Immediate source invariant: only the runtime owner may register a work in that
runtime. The configured Paseo deployment predates this check. Claiming the
invariant on testnet therefore requires both owner-led selector-upgrade evidence
for every existing runtime and deployment evidence for a corrected
factory/directory generation that protects future runtimes.

Future policies should be new explicit facet versions, not overloaded UI labels.
Community/time access waits for contract, backend, privacy, and test designs.

### Backend surface

```text
GET  /health
GET  /health/ready
GET  /version
GET  /api/catalog?cursor=&limit=
GET  /api/rooms/:roomId/public
POST /api/auth/nonce
POST /api/auth/session
POST /api/auth/logout
POST /api/publishing/intents
POST /api/uploads/audio
POST /api/uploads/cover
POST /api/uploads/metadata
POST /api/tracks/:contentHash/free-key
POST /api/tracks/:contentHash/key-request
POST /api/turn/grants
```

Upload routes must recalculate the content hash, require a scoped publication
intent for production, validate ownership, limit size and MIME, and never log
raw media, signatures, bearer tokens, or keys.

Room public DTOs omit content keys, encrypted source references, wallet
addresses, and private social history.

## 10. Security plan

### Immediate

1. Enforce runtime-owner-only registration and test outsider rejection.
2. Recalculate BLAKE2b-256 server-side before deriving a key or pinning audio.
3. Bind nonce/session verification to the configured chain ID.
4. Require authenticated, scoped publish intents for production uploads.
5. Restrict WebRTC offer, answer, ICE, and peer confirmation to a verified
   host-listener pair in the same room.
6. Remove protected source refs and declarative wallet addresses from public
   room payloads.
7. Align deployment addresses across generated frontend config, API runtime,
   health output, and operational docs.

Deployment gate: do not mark the first item live merely because source tests
pass. Verify the corrected pallet configured in the future factory, the
`musicRegRegister` loupe route on every existing runtime after its owner-led
selector upgrade, and outsider-call rejection on both the canary and every
existing runtime. Existing-runtime upgrades and the future factory/directory
generation are complementary gates, not alternatives; preserve the current
catalog during cutover. The guard does not repair any historical injected
records. The canonical operator path is
[`docs/operations/registry-facet-remediation.md`](../operations/registry-facet-remediation.md).

### Operational

- persist session revocation and nonce state or run an explicitly single,
  non-autostopping API instance;
- use short-lived TURN credentials rather than static Vite secrets;
- validate and byte-cap SDP/ICE payloads, then rate-limit relays per participant;
- rate-limit room creation and cap total in-memory rooms;
- keep signaling single-instance until room state has a shared adapter;
- rotate the master secret only with a re-encryption/versioning plan;
- use structured redacted logs and request IDs;
- document that authorized audio can be recorded.

### Threat-driven tests

- outsider publication;
- hash substitution and duplicate/mismatched content;
- wrong-chain and replayed challenges;
- expired/revoked sessions;
- ambiguous runtime resolution;
- cross-room SDP/ICE injection;
- listener attempting listener-to-listener relay;
- guest key-route calls;
- public DTO source/key/address leakage;
- upload quota abuse and malformed media.

## 11. Accessibility plan

- WCAG 2.2 AA target.
- One `h1` per surface and stable heading order.
- Every visual metaphor has literal text: counts, names, role, sound state,
  access state, and action.
- Native buttons, links, labels, fieldsets, and dialogs before ARIA.
- Dialog focus is trapped and restored; the background is truly removed from
  the accessibility tree while modal.
- Keyboard entry, playback, room actions, chat, queue, and support are complete.
- Focus remains high-contrast and independent of work aura.
- Presence is a count and list, never color/orbit alone.
- Reactions animate as decorative echoes but are announced in a throttled polite
  live region.
- Track changes do not steal focus.
- Errors attach to the relevant field/action and use `role=alert` only when
  interruption is necessary.
- `prefers-reduced-motion` disables aperture, trace, and scene transitions.
- No public identity is required; pseudonym and privacy controls are explicit.
- Automated axe checks complement keyboard, VoiceOver, and zoom/reflow QA.

## 12. Performance plan

Budgets:

- useful cached content under 800 ms;
- Free first sound under 1.5 s p75;
- already-authorized protected sound under 2 s p75;
- preloaded track transition under 700 ms;
- room metadata to remote first sound under 1.5 s p75;
- INP under 200 ms and CLS under 0.1.

Measures:

- fetch room metadata and connect signaling as soon as a room link is parsed;
- serve a paginated, cacheable catalog projection instead of browser-wide RPC
  enumeration;
- reserve cover dimensions and provide responsive AVIF/WebP where possible;
- race configured IPFS gateways with bounded timeouts;
- cache immutable CIDs aggressively;
- preload audio metadata on intent, not every catalog card;
- decrypt/append DAV2 chunks off the interaction path and validate supported
  browser/container combinations honestly;
- lazy-load artist studio, chain tooling, chat, queue, QR, and advanced evidence;
- avoid WebGL on the first-sound path;
- record phase timings: metadata, access, key, gateway, decrypt, append, play,
  WebRTC connected, and first audio.

## 13. Explicit failure states

| State | Product language | Action |
| --- | --- | --- |
| No live rooms | Nothing is open right now. | Choose a work and open the first moment. |
| Empty catalog | No work is available yet. | Artist studio or retry. |
| Slow gateway | The work is arriving from another source. | Try another source. |
| RPC unavailable | Rights cannot be verified right now, so this work stays closed. | Retry without bypass. |
| Indexer behind | Updating from the source of truth. | Show last known timestamp. |
| No wallet | Choose a way to confirm only when you support or open protected listening. | Open confirmation methods. |
| Host capability absent | This Host cannot perform that action yet. | Open standalone mode if safe. |
| Unauthorized | This work needs support or a verified-human pass. | Show the exact door. |
| Signature refused | Nothing was sent. You can keep listening to the room. | Close or retry. |
| Transaction pending | Your support is being confirmed. | Keep audio/UI responsive. |
| Transaction failed | The work was not opened and no success is claimed. | Explain/retry. |
| Key unavailable | Your right is recognized, but the sound is unavailable. | Retry key delivery. |
| MSE unsupported | This browser needs the compatible full-file path. | Use safe fallback or supported browser. |
| WebRTC degraded | The sound is looking for a better path. | Reconnect without leaving room. |
| Host disconnected | Waiting briefly for the host to return. | Countdown then end state. |
| Room ended | This moment has ended. | View work or open another room. |
| Content withdrawn | This work is no longer available. | Keep only permitted metadata. |

## 14. Test plan

### Unit

- domain access decisions and user-facing copy;
- URL/room parsing and public DTO normalization;
- platform capability selection;
- policy encoding, royalty math, form validation;
- audio container parsing and fallbacks;
- reduced-motion and focus-state helpers where pure.

### Integration

- backend auth, publish intent, upload/hash, access, key, and revocation;
- signaling membership, room privacy, reconnect, rate limits, chat, reactions,
  and request queue;
- contracts: runtime ownership, registration, policy changes, support split,
  personhood, deactivation, upgrade isolation.

### Browser/e2e

1. Room link -> named guest -> remote audio, no wallet/key request.
2. Free work -> first sound without wallet.
3. Paid work -> locked with no preview -> transparent receipt -> unlock.
4. Artist runtime bootstrap resumes after interruption.
5. Artist publish success plus upload and transaction failures.
6. Authorized host streams; unauthorized host sends no protected audio.
7. Link, QR, keyboard, autoplay-blocked, room ended, and network reconnect.
8. Desktop Chrome/Firefox/Safari plus one mobile autoplay-constrained listener.

### Release evidence

- lint, typecheck, unit, signaling, API, contract, and deterministic e2e suites;
- production and single-file builds;
- two-device WebRTC and DAV2 gateway matrix;
- keyboard, zoom/reflow, reduced-motion, VoiceOver, and axe smoke;
- bundle and first-sound phase report.

## 15. Prioritized implementation backlog

The sequence is mandatory. Later work does not pull earlier invariants forward by
copy alone.

### 1. Enter and hear - P0

- Dedicated room-link threshold with real metadata and one entry action.
- Automatically discover live rooms on `Now`.
- Correct Free/paid/human-free language; remove every 42-percent preview claim.
- First-sound telemetry and gateway/audio error states.
- Public room DTO privacy.

### 2. Create and join a room - P0

- Preserve one-link/QR join and host-only access.
- Same-room WebRTC relay authorization.
- SDP/ICE body validation and rate limits, host reconnect grace, room creation
  limits, and ephemeral TURN grants.
- Validate on two real devices before release.

### 3. Publish a work - P0

- Runtime-owner-only registration.
- Server hash verification and production publish intent.
- Resumable runtime bootstrap and deterministic publication tests.
- Artist preview of guest/solo/host policy outcomes.

### 4. Apply access policies - P0

- Free, paid, and human-free stay explicit and fail closed.
- Bind auth to chain ID and persist revocation.
- Integrate real Proof of Personhood before claiming verified-human access.
- Design community/time policies as new contract/API versions.

### 5. Support an artist - P1

- One transparent quote/receipt sheet.
- Exact split, fees, finality, failure, and refund evidence.
- No wallet language before the person chooses support.

### 6. Polkadot Product compatibility - P1

- Host capability matrix.
- Domain ports and explicit adapter selection.
- Host-mediated account, signing, transaction, chain, storage, network, and
  personhood paths; no private key in Product code.

### 7. Enrich social presence - P1

- Lazy social drawer using existing attributed reactions, chat, and requests.
- Reconnect/handoff semantics, moderation baseline, and accessibility live
  regions.

### 8. Cultural provenance - P2

- Consent model, data minimization, retention, aggregation, dispute flow.
- Real event schema before any visible path or filament.

### 9. Ambassador experiments - P3

- Artist-defined rules, anti-Sybil source, windows, caps, self-referral defense,
  privacy, and appeals.
- Evaluate recognition/access before economic reward.

### 10. Memories and awards - P4

- Optional, understandable, non-financialized memories only after evidence that
  they strengthen relation.
- No Dotify token without a concrete unmet product need.

## 16. Functional v1 slice in this repository

The first Thresholds slice deliberately reuses the proven domain and transport:

- `ListenerShell` loads open rooms on entry and resolves the target room for a
  share-link threshold;
- `JoinRoomModal` becomes the public threshold when real room metadata exists;
- `ListenView`, `RoomsView`, `PlayerView`, artist, and studio retain their
  behavior while receiving a new warm, editorial visual hierarchy;
- the persistent player calls a locked track `Listening closed` / `Open` rather
  than claiming a retired 42-percent preview;
- security fixes protect runtime registration, audio identity, chain-bound
  authorization, public room privacy, and realtime peer routing;
- existing deterministic selectors and critical flows remain intact.

This slice is not presented as complete Product SDK, live Proof of Personhood,
SFU, provenance, ambassador, or awards support. Those capabilities remain
explicit backlog work until their guarantees are real.
