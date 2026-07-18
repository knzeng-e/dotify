# Let the Music Connect the Dots

Status: book charter and working table of contents.

This book is the companion text for Dotify. It should teach a reader how to
build a full-stack decentralized application while also making the cultural,
social, and philosophical argument visible.

Dotify itself remains the primary artifact. The book explains what the artifact
is proving, how each technical decision works, what Web3 adds, what it costs,
and which claims are still unproven.

## Working title

**Let the Music Connect the Dots: Building a Sovereign Cultural Commons with
Polkadot**

## Promise

The book should help a reader understand Dotify at three levels:

1. Product: why shared listening, artist sovereignty, protected access, and
   human-centered discovery belong in the same application.
2. Engineering: how to build the app from frontend, rooms, WebRTC, backend key
   delivery, encrypted media, IPFS, and artist-owned runtimes.
3. Culture: why blockchain is useful only when it solves a real social problem
   without turning the human experience into bureaucracy.

The book must not be a detached manifesto. Every technical claim should point to
code, tests, PRs, issues, operational evidence, or a clearly marked open
question.

## Audience

- Full-stack developers who want to learn how to build a real Web3 application.
- Product builders who want to understand where blockchain helps, where it does
  not, and how to avoid wallet-first product design.
- Web3 readers who want a concrete example of applied sovereignty, trust, and
  cultural transmission.
- Artists, curators, and community builders who want to understand how digital
  infrastructure can protect creative agency.

## Evidence Standard

Every chapter and major section should carry one of these labels:

| Label | Meaning |
| --- | --- |
| `Implemented` | The behavior exists in the repository and has code references. |
| `Validated` | The behavior exists and has automated tests, CI, deployment evidence, or manual production evidence. |
| `Experimental` | The idea has a prototype or spike, but the production boundary is not final. |
| `Aspirational` | The concept belongs to the Dotify thesis but is not implemented yet. |
| `Rejected` | The project considered the path and chose not to take it, with reasons. |

This protects the book from becoming marketing. It also lets readers learn from
the unfinished parts without confusing them with shipped guarantees.

## Voice

Use plain technical language when precision matters. Use cultural and
philosophical language only when it clarifies the product decision.

Good book prose should answer:

- What human problem is this section about?
- What is the Web2 baseline?
- What does Web3 add here?
- What new risks or costs does Web3 introduce?
- How does Dotify implement the idea today?
- What remains unresolved?

Avoid decorative philosophy. The philosophy should appear inside the product
mechanics: room entry, access gates, artist runtime ownership, key custody,
royalty visibility, personhood caution, and social propagation rules.

## Scope

Included:

- The Dotify product thesis.
- Full-stack app construction from local development to public testnet
  operation.
- React/Vite frontend structure.
- Socket.IO signaling and WebRTC room playback.
- Backend-mediated uploads and content-key delivery.
- Encrypted audio access with honest limits.
- IPFS and gateway reliability.
- Artist-owned SmartRuntime contracts.
- Royalties, access policy, and runtime transparency.
- Product SDK, Playground, Statement Store, and Humanity as gated feasibility
  tracks.
- Security, threat modeling, test strategy, and operational runbooks.
- Cultural propagation and ambassador mechanics only after consent and
  anti-abuse foundations are designed.

Excluded until proven:

- Tokenomics as a primary product story.
- Claims of full DRM.
- Claims that Proof of Personhood is live.
- Claims that Product SDK Host mode is production-ready for Dotify.
- Claims that room guests receive protected source access.
- Referral mechanics without provenance, consent, and anti-abuse design.

## Annotated Table of Contents

### Part I - Why Music Needs a Commons

Purpose: explain the social problem before introducing technical machinery.

1. **The private headphone city** (`Aspirational`)
   - Shared spaces contain isolated listeners.
   - Music is not only content; it is memory, invitation, and relation.
   - Dotify asks whether a shared track can reopen a temporary commons.

2. **Not Spotify with a wallet** (`Implemented`)
   - Explain why individual consumption is not Dotify's center.
   - Introduce the product triangle: shared presence, artist sovereignty, and
     invisible trust.
   - Reference: `docs/context/dotify-product-memory.md`.

3. **The Web2 baseline** (`Aspirational`)
   - Compare a normal streaming platform, a chat room, and a payment platform.
   - Name what those systems do well.
   - Name the capture problem: platform-owned catalog rules, opaque value
     flows, fragile access boundaries, and algorithmic discovery without
     social relation.

### Part II - First Sound

Purpose: teach the reader to build the first useful listening product before
adding heavier Web3 machinery.

4. **The listener surface** (`Implemented`)
   - Build the Music view: catalog, track cards, access badges, player, and
     room controls.
   - Explain why the first screen is the app, not a marketing page.
   - Reference: `web/src/views/ListenView.tsx`.

5. **Rooms as the social core** (`Implemented`)
   - Build one-link rooms with hosted signaling and WebRTC.
   - Explain why room guests do not need wallets.
   - Reference: `docs/explanation/listening-rooms.md`.

6. **The host-access doctrine** (`Validated`)
   - Show the room security boundary: the host may receive a temporary key; the
     guest receives only an ephemeral WebRTC stream.
   - Reference: `docs/product/room-access-policy.md`.

### Part III - Artist Sovereignty

Purpose: show how blockchain enters because the artist needs control, not
because the product needs a crypto aesthetic.

7. **The artist-owned runtime** (`Implemented`)
   - Explain SmartRuntimes, factory deployment, and the artist directory.
   - Show how one artist gets one runtime and why that matters politically and
     technically.
   - Reference: `docs/reference/contracts-api.md`.

8. **Publishing a protected release** (`Validated`)
   - Walk through upload, encryption, metadata, IPFS, and on-chain
     registration.
   - Contrast demo browser upload with backend-mediated production upload.
   - Reference: `docs/reference/environment-variables.md`.

9. **Royalties as inspectable value flow** (`Validated`)
   - Explain Classic payment, royalty splits, collaborator shares, and runtime
     reads.
   - Reference: `docs/explanation/royalty-settlement.md`.

### Part IV - Protected Access Without False Promises

Purpose: teach security boundaries honestly.

10. **What encrypted delivery protects** (`Validated`)
    - Explain key custody, signed key requests, replay protection, and denied
      playback.
    - State the limit clearly: this is distribution access protection, not full
      DRM.
    - Reference: `docs/explanation/content-protection.md`.

11. **Dotify Audio V2** (`Experimental`)
    - Explain DAV2 chunked encrypted media, startup behavior, gateway reads,
      fallback strategy, and why first sound matters.
    - Reference: `docs/reference/audio-v2-container.md`.

12. **Gateway reality** (`Experimental`)
    - Explain IPFS gateway behavior, browser range reads, cache behavior, and
      the backend read-through decision.
    - Tie this to the active DAV2 validation gate.
    - Reference: `docs/backlog/polkadot-product-readiness-and-killer-dapp-roadmap.md`.

### Part V - Making Web3 Disappear

Purpose: align Dotify with the current Polkadot product ecosystem without
pretending the future is already shipped.

13. **Product SDK as progressive enhancement** (`Experimental`)
    - Explain Host capabilities, Product accounts, resource allocation, and why
      standalone web remains first-class.
    - Reference: `docs/backlog/polkadot-product-readiness-and-killer-dapp-roadmap.md`.

14. **Statement Store and presence** (`Experimental`)
    - Explain why small signed ephemeral statements fit presence better than
      media, chat history, SDP/ICE, or durable catalog metadata.

15. **Human free and the dignity problem** (`Aspirational`)
    - Explain why personhood is philosophically central and technically
      dangerous.
    - Require privacy, address binding, fallback UX, and non-surveillance
      before implementation.
    - Reference: `docs/backlog/11-proof-of-personhood-integration-research.md`.

### Part VI - Operating a Cultural Commons

Purpose: show that production readiness is part of the philosophy.

16. **The production spine** (`Implemented`)
    - Explain deployable frontend, backend, signaling, contracts, env guards,
      health checks, and smoke tests.
    - Separate delivered production guarantees from active DAV2/gateway
      validation and backend read-through decisions.
    - Reference: `docs/backlog/README.md`.

17. **Tests as cultural honesty** (`Validated`)
    - Explain why critical flows are tested: Classic unlock, artist publish,
      room joining, access-state failures, and production env checks.
    - Show how tests defend the product promise from accidental regressions.

18. **PRs as teaching artifacts** (`Implemented`)
    - Explain PR descriptions as knowledge transfer between coder and reviewer.
    - Every PR should explain why it exists, what issue it solves, how the code
      works, what reviewers should inspect, what evidence was collected, and
      what remains open.

### Part VII - The Unfinished Commons

Purpose: keep the poetic ambition and engineering discipline together.

19. **Consented cultural propagation** (`Aspirational`)
    - Design provenance around consent, room context, and meaningful discovery,
      not referral spam.
    - Reference: `docs/backlog/12-ambassador-social-propagation-model.md`.

20. **The ambassador is not a marketer** (`Aspirational`)
    - Explain cultural transmission as care.
    - Define anti-abuse principles before mechanics.

21. **What remains unresolved** (`Aspirational`)
    - Name the hard questions: capture, identity, privacy, gateway reliability,
      governance, community memory, and the limits of software.

## Chapter Template

Each chapter should follow this rhythm:

1. **Lived situation** - a human scenario before the technical abstraction.
2. **Claim** - the product or philosophical proposition.
3. **Architecture** - the system pieces involved.
4. **Lab** - a concrete implementation walkthrough.
5. **Security review** - what can fail, what is protected, and what is not.
6. **Evidence** - code references, tests, PRs, issues, screenshots, or manual
   checks.
7. **Open question** - what the project still has to prove.

## Repository Workflow

The book should be maintained with the same discipline as code.

1. When a PR introduces a new concept, include a reviewer-learning paragraph in
   the PR description.
2. If the concept is durable, add or update the matching explanation,
   reference, manual, or book note.
3. Mark the book section with the correct evidence label.
4. Link to the issue, PR, tests, docs, and operational proof.
5. Keep aspirational sections short until implementation begins.
6. Update `docs/index.html` when the book changes public framing or introduces a
   major public-facing resource.

## Initial Milestones

1. Create this charter and expose it from the documentation index.
2. Draft Part I as explanation, not tutorial.
3. Draft the first tutorial chapter only after the corresponding app flow is
   stable enough that readers can reproduce it.
4. Add a short "Book notes" section to future PR descriptions when the PR
   teaches a concept that belongs in the book.
5. Keep the book honest: if Dotify has not proven something, the book says so.
