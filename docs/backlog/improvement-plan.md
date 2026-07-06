# Dotify strategic improvement plan (July 2026)

Tracked outcome of a full review of the implementation against the product
memory, technical memory, philosophical north star, and the Polkadot/Parity
principles Dotify claims (artist sovereignty, permissionless architecture,
Individuality/Proof of Personhood, Bulletin deployment, statement-store
presence, Triangle host citizenship).

This plan does not change the production readiness rule: the spine finishes
first. It exists so the differentiating work after the spine is deliberate,
tracked, and does not drift into ornamental features.

## Review verdict (summary)

What holds up: incremental behavior-preserving refactors with an e2e net,
pure tested feature modules, documented security boundaries that do not
overpromise DRM, the dev-signer fail-closed guard, and the host-based room
doctrine (guests join with a link alone).

Where it falls short of its own standards:

1. The social core is the thinnest part of the product. Rooms are one host,
   one stream, one listener count: no chat, no reactions, no shared queue, no
   visible human presence. The philosophy says rooms are the village square.
2. The killer differentiator is mocked. Human-free access gated by real
   Individuality verification is the one feature no Spotify clone has; it is
   currently a dev-only admin call (ticket 11 still research-phase).
3. Two Web2 organs in a Web3 body: centralized Socket.IO signaling/presence,
   and content-key delivery behind a single backend-held master secret.
4. Not yet a Triangle citizen: the frontend deploys to Bulletin/IPFS but does
   no host detection, no Host API signing, no DotNS name.
5. Frontend debt is now concentrated in the mega-hooks (`useCatalog` 879
   lines), not `App.tsx`; ABI bindings are hand-maintained (ticket 09) and
   the key service is unobservable (ticket 10).
6. UX gaps against the "invisible trust" bar: time-to-first-sound routes
   through catalog browsing, the unlock moment is transactional rather than
   warm, the aura engine is decoration rather than discovery, and a single
   global transaction toast cannot represent overlapping operations.

## Now - finish the spine (no new scope)

| Item | Tracking | Status |
| --- | --- | --- |
| PR8b providers/context boundary (5 stacked PRs) | `08b-providers-design.md`, tracker rows 8b-1..8b-5 | Planned |
| PR9 `shared/` tree relocation | `08-frontend-refactor-tracker.md` | Planned |
| PR10 split mega-hooks (`useCatalog`, `useSession`, `useArtistConsole`) along their `features/*` seams | propose as follow-up rows in the ticket 08 tracker after 8b lands | Proposed |
| Generated ABI bindings | `09-generated-abi-bindings.md` (#10) | Delivered (`feat/generated-abi-bindings`) |
| Observability and health checks on the key service | `10-observability-health-checks.md` (#11) | Open |
| Separate production preview assets | `18-production-preview-assets.md` (#27) | Open |

## Next - the moves that make this a killer dapp

| Item | Tracking | Status |
| --- | --- | --- |
| Real Individuality integration: DIM1/DIM2 verification against the Individuality runtime with allowance provisioning, replacing the mocked `setPersonhoodLevel` admin call. Promote ticket 11 from research to build. | `11-proof-of-personhood-integration-research.md` (#12); new build ticket to be cut from its research output | Open (promote) |
| Statement store as the presence layer: room discovery, presence heartbeats, and minimal ephemeral room chat on People Chain statement store (last-write-wins channels fit presence). Socket.IO remains the SDP/ICE relay initially, then signaling itself migrates. Delivers the deferred room chat (ticket 15) and removes the largest centralization point. | new ticket 19 to be authored | Proposed |
| Triangle host citizenship: host detection and Host API signing alongside the extension/passkey paths; DotNS name on the existing Bulletin-deployed artifact. | new ticket 20 to be authored | Proposed |

## Later - concept and social depth

| Item | Tracking | Status |
| --- | --- | --- |
| Rooms as an actual village square: collaborative queue with host veto, lightweight reactions rendered through the aura engine, and provenance trails (which room and host a listener met a track through) as the substrate for the ambassador model without referral mechanics | `12-ambassador-social-propagation-model.md` (#13); collaborative request queue with host veto delivered in `21-room-collaborative-queue.md` | Collaborative queue delivered (first slice); aura-rendered reactions and provenance trails still proposed |
| Aura-driven discovery: browse rooms and tracks by light and mood rather than lists | new ticket | Proposed |
| Key-delivery decentralization path: documented then implemented route away from the single `CONTENT_KEY_MASTER_SECRET`, e.g. per-artist key derivation anchored to the SmartRuntime, or threshold key shares across independent key-service instances | new ticket | Proposed |
| UX polish pass: landing hero that drops a visitor into a live (or curated ambient) room within one click; a warmer unlock moment showing the actual on-chain royalty split; a feedback queue replacing the single transaction toast | new ticket | Proposed |

## Ordering and guardrails

- Nothing in Next or Later starts before the Now table is green, per the
  production readiness rule in `README.md` (this folder).
- Every Next/Later item passes the philosophical decision filter before being
  cut into a ticket: does it strengthen shared listening, artist sovereignty,
  and reduce friction, without lying about security.
- When any Next item lands and changes public positioning or roadmap,
  `docs/index.html` is updated in the same PR (GitHub Pages alignment rule).
- The through-line: contracts, encryption, and refactoring discipline are
  already at standard; the gap is that the most Dotify-specific ideas
  (human-verified access, living presence, cultural propagation) are the
  least built. This plan closes the spine and then spends everything on
  exactly those.
