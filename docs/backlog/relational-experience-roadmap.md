# Relational experience roadmap: community-gated horizons

**Status:** proposed strategy and research gates; recorded 2026-11-19. Not an active delivery sprint, a reordered Project 5 board, or a public pilot acceptance. The canonical execution schedule and issue statuses remain in the [selected production-readiness sequence](implementation/listening-and-publication-readiness.md) and [GitHub Project 5](https://github.com/users/knzeng-e/projects/5).

**Readers:** product owner, engineering team, artists, listener-community facilitators and future venue partners. **Purpose:** decide *when* to expand Dotify's relational experience without discarding production readiness, artist sovereignty, existing contribution/ambassador work or native-host requirements.

For the *why and experience definitions*, see the [Relational experiences concept](../design/relational-experiences.md). For the philosophical invariants, see the [north star](../context/dotify-philosophical-north-star.md).

## Decision in one view

**Production reliability -> intentional shared listening -> opt-in collective memory -> small geographic encounters -> richer Imprints -> artist-authored living works.**

These are sequential **community and technical checkpoints**, not promises that every phase will ship. Artist creation, rights, support, onboarding and community care run *through all phases*, not as a side project postponed until the end.

| Horizon | Status/priority | Smallest useful outcome | Community checkpoint |
| --- | --- | --- | --- |
| **0. Protect the living foundation** | **Now: existing selected backlog only** | A reliable, consented listener/artist pilot across the intended Web/Product routes | Artists and guests can complete and *understand* real listening and support journeys |
| **1. Give Rooms a deeper social grammar** | **Next experiment, after Horizon 0 gates** | Optional intention/ritual using existing pinned message and chat, followed by interviews | Participants describe a meaningful moment or discovery, without being prompted to praise the app |
| **2. Offer consensual memory** | **Next, only after Horizon 1 evidence** | Opt-in musical postcard/collective memento, not automatic archived chat | Participants independently want to preserve or share a memory and control what is remembered |
| **3. Explore place minimally** | **Later, after privacy/rights and community gate** | One artist-curated three-stop, three-track city trail and a separate remotely placed Imprint prototype, without AR | People choose to discover/leave cultural traces and artists/venues want to continue |
| **4. Open Imprints carefully** | **Later, contingent** | Public/private/recipient experiences, collective unlocking and partner QR entries where appropriate | Trust, moderation, accessibility, rights and sustained community use survive a bounded pilot |
| **5. Research Resonance Gardens** | **Long-range / research** | One artist-authored generative artwork with meaningful bloom/dormancy and optional cross-place resonance | Creators and communities value the relationship and artistic transformations without artificial attention loops |

No duration, release date, adoption percentage or generic vanity target is implied. The owner and consenting participants should set the sample and success criteria **before** each trial, and retain negative evidence.

## Horizon 0 — do not trade trust for novelty

The November 18 smart-runtime audit put payment/whole-contract corrections before further CASH research and selected a **future complete fresh testnet generation after remaining audit fixes**. No new generation or deployment is implied by this roadmap. The existing pilot remains open.

Finish or explicitly resolve the selected technical gates before a feature rollout: secure artist payment/entitlement/royalty behavior; matched Web/Product, API and Host evidence; bounded Bulletin publication and reliable sound/Room continuity; access denial and rollback; privacy and consented pilot evaluation. Use current source and deployment evidence, not past screenshots, draft PRs or successful local mocks as proof of physical-host behavior.

Related existing work, not new tasks or changed priorities:

- [#158 first coherent pilot](https://github.com/knzeng-e/dotify/issues/158), [pilot plan](../operations/pilot-release-plan.md) and [selected sequence](implementation/listening-and-publication-readiness.md).
- [#407 publication](https://github.com/knzeng-e/dotify/issues/407), [#395 mobile room startup](https://github.com/knzeng-e/dotify/issues/395), [#388 system artwork](https://github.com/knzeng-e/dotify/issues/388) and [#85 Product SDK/Host](https://github.com/knzeng-e/dotify/issues/85).
- [#274 native Nearby acceptance](https://github.com/knzeng-e/dotify/issues/274). The current room galaxy is **not** a map of pinned artworks, and Nearby permission does not certify GPS proximity.
- [#275 artist-controlled runtime evolution](https://github.com/knzeng-e/dotify/issues/275), [#229 contributions and earnings](https://github.com/knzeng-e/dotify/issues/229) and [#13 ambassador model](https://github.com/knzeng-e/dotify/issues/13). Preserve their rights, provenance and economics boundaries; no reward mechanics are activated here.
- [#406 CASH tips](https://github.com/knzeng-e/dotify/issues/406) and [#408 CASH access](https://github.com/knzeng-e/dotify/issues/408) remain their own Host/payment research, **not** dependencies that force tokenomics into the cultural experiments.

**Technical exit gate:** an explicitly identified, reviewed, deployed and supported pilot candidate passes its defined Web and physical-Host journeys. **Human exit gate:** a small consenting artist/listener group successfully listens and understands invitations, support and privacy boundaries; interview findings are recorded, including discomfort and unmet expectations.

If Horizon 0 fails, fix it first. A promising future feature cannot compensate for unreliable first sound or ambiguous payments.

## Horizon 1 — the smallest relational experiment

Use current Room primitives rather than create another service. A host can pin an optional invitation such as "What memory does this song carry for you?" or "Listen together quietly; talk after the ending." Three or four consenting people and one artist-authorized track are enough for an exploratory session; that small sample is **not** a population-level proof.

**Build requirement:** none for the initial facilitated test. Host and chat capabilities exist; the proposed ritual protocol and evaluation are new. Keep normal, spontaneous Rooms as the default; don't require prompt responses, wallet, identity proofs or a minimum speaking time.

**Observe with permission:** Did people discover something unexpected? Did they feel welcomed? Could they remain silent? Would they want to listen together again? Did an artist perceive genuine connection, not only publicity? Compare with a normal unguided Room when possible.

**Gate:** participating listeners and an artist affirm that the invitation adds value, and the experiment exposes no unacceptable friction, pressure or privacy cost. Reject or adjust the ritual if it feels artificial. Only after this evidence consider a dedicated lightweight intention UI.

## Horizon 2 — a memory chosen by people

Concept: a post-Room **musical postcard** composed from a track reference and **new** voluntary writing or expressly approved excerpts. No automatic recording, persistent group chat, involuntary participant tagging or immutable personal-data NFT.

**Prototype:** let a host propose one postcard at the end of a Room; explicitly collect contribution consent and intended audience, allow preview/edit/withdrawal before publication, permit expiration or deletion according to a defined retention contract. A mock or local-only artifact can test meaning before real persistence.

**Gate:** participants *choose* to keep or share it, understand who may see it, and can decline without social penalty. Artists approve any use of their music. Document data ownership, deletion, moderation, revocation limits, accessible alternatives and recovery before server storage.

**Connection:** a user-approved postcard could later be placed somewhere as an Imprint. Room data must never be migrated into permanent content automatically.

## Horizon 3 — the first physical-world experiment

**Do not begin with a world map, AR layer or new NFT marketplace.**

Try two independent narrow prototypes:

1. **Artist treasure hunt:** one collaborating artist, one permitted album/release, three tracks or licensed excerpts, and three intentionally chosen places. Each stop gives a complete listening experience; collecting several may reveal richer, *supplementary* colors, a remix or the artist's story. Nobody must visit all stops to hear a satisfying work. Artist decides whether a discoverable item is a playable work, preview or certificate; the runtime remains authoritative for protected access.
2. **Personal Imprint:** someone selects a place *remotely* on a map, writes a poem or note, and attaches a music reference they are authorized to share. A small invited group voluntarily discovers the message on-site or via an accessible, consented alternative. QR codes are optional for **authorized partner installations**; they are not necessary for digital anchoring.

At this stage, avoid identity verification by background movement. A location fix or QR scan establishes at most a fallible check-in, not unique presence. Limit data, geofence precision, life span and active anchors; clearly distinguish placed content from people's live locations.

**Gate:** artist, listeners and any venue partner each report value and remain willing to participate; discovery is understandable without camera/AR; complaints and spam can be addressed; location denial and inaccessible travel do not erase artistic access.

## Horizon 4 — Imprints and collective unlocking

Only after the previous results, experiment with:
- opt-in public traces, invitation-only/private gifts and their distinct real authorization and encryption requirements;
- artistic trails curated by artists or cultural venues, plus moderation, removal, quotas and an opt-in discovery experience;
- a conditional reveal, e.g. **three consenting visitors during one window**, either private to that group or public to later visitors;
- later certificates of discovery if materially useful, without interpreting an NFT as the audio master, copyright or proof of a unique human.

**Gate:** completed misuse/harassment and sensitive-place review; artist rights verified; accessible paths and recipient security tested; a small user/artist/venue pilot shows relationships rather than accumulating pin counts. Otherwise remain in a closed trial.

## Horizon 5 — Resonance Gardens and shared creative ecosystems

Research with willing musicians, visual artists and creative developers. Author a limited transformation grammar for one musical seed. Test bloom, dormancy, and reawakening as **different artistic forms**, not a punishment for low traffic. Then consider independent local manifestations with a shared identity, temporal resonances between cities and *artist-consented* hybridization of distinct works.

**Gate:** musical merit across states, artist control of rules and derived works, meaningful community stewardship, privacy-safe event provenance, resilient persistence and a clear no-extraction design. Do not ship attention-to-token conversion or dynamic on-chain writes without explicit rights, threat-model and cost evidence. A garden may never advance beyond research.

## A common community checkpoint for every horizon

Each trial closes with **two independent acceptances**, and a decision record:

| Question | Technical acceptance | Human/cultural acceptance |
| --- | --- | --- |
| **Does it work?** | Reproducible supported-device journeys, rights and failure states | People can describe what to do without facilitator rescue |
| **Does it matter?** | No silent data loss, unbounded access or misleading state | People recount real experiences, discover artists, form invitations or return voluntarily |
| **Does it respect people?** | Consent, expiry, moderation, privacy and accessibility checked | Participants can decline, leave, remain anonymous where allowed, and criticize the experience |
| **Does it serve artists?** | Proven rights, permitted sharing, clear support/attribution | Artists judge the exchange worth repeating, not merely a source of metrics |
| **Should we proceed?** | Risks and remaining limitations documented | Listening community and artist feedback materially influence proceed / revise / stop |

Collect minimal **consented** evidence: a qualitative conversation, observed task completion and carefully scoped aggregate return/discovery measures where participants accept them. No universal retention requirement, fabricated meaningful-listen threshold, emotional inference or GPS/social graph. Record which people were heard and which were missing (e.g. accessibility, venue perspectives); do not turn a tiny prototype into a population claim.

Each decision record should state: **candidate and date, participants and consent, exact experiment, what worked, what failed, accessibility/rights/privacy findings, artist and listener voices, go/revise/stop decision, and next scope owner**. Keep personal stories out of public evidence without permission.

## Practical handoff and ownership

- **Engineering:** Project 5 and the selected readiness sequence continue unchanged. Open narrowly scoped implementation issues only after a community gate and owner selection; each issue gets its own acceptance, rights/privacy review and evidence.
- **Artists:** retain runtime, licensing, price, royalty, release and any collaboration/hybridization authority. Artists co-design experiments rather than merely supply media.
- **Listeners/hosts:** choose their room rituals, memory creation, location use and public sharing. Refusal cannot prevent basic listening.
- **Community partners:** opt in to site-specific experiences and approve physical installations where appropriate. An app pin never claims authorization to affix a sign to someone else's property.
- **Product research:** keep a compact experience journal and record explicit stop decisions. These are learning checkpoints, not engagement-growth goals.

The [concept document](../design/relational-experiences.md) owns the philosophical and UX model. This roadmap owns proposed **ordering and community gates only**. Source code and runtime policies govern implemented behavior; [Project 5](https://github.com/users/knzeng-e/projects/5) governs active workflow. This proposal changes neither.
