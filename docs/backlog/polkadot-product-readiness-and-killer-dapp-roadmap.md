# Polkadot product readiness and killer dapp roadmap

Status: active planning note, supersedes the stale draft from PR #91.

Last Product SDK verification: 2026-07-14 against
`paritytech/product-sdk@2f359bba28ca72855207a0a519d4118b37b4438c`
(`@parity/product-sdk` 0.17.0).

## Verdict

Dotify should align with the Polkadot product ecosystem, but it should not
replace its standalone production path with Product SDK assumptions yet.

The right product shape is dual-mode:

- Standalone web remains first-class for the public testnet path: a room link
  opens, a guest enters without wallet friction, and protected source keys stay
  server-side.
- Product mode progressively enhances that app when it runs inside a compatible
  Host: product accounts, host signing, resource allocation, payments, local
  storage, Statement Store presence, and later Humanity / Individuality proofs.
- Any denied Host permission or missing Host capability must produce an explicit
  product failure state. It must not fall back to demo secrets, hidden signers,
  or bypassed access checks.

## Product ecosystem evidence

The current Parity product direction is coherent: Levity for publishing,
Product SDK for shared app capabilities, Playground for AI-assisted deploy and
`.dot` publication, and Humanity / Individuality for sybil resistance. The
recent messaging is about making infrastructure invisible to builders and
users, not about every part being production-ready today.

The SDK details matter for Dotify:

- Product SDK and Playground are explicitly prototype / reference / unaudited
  code.
- Product SDK preset chains are live for Paseo and Summit. Polkadot and Kusama
  preset paths are gated because Bulletin / Individuality descriptors are not
  live there.
- Product SDK contract helpers target `pallet-revive`, PolkaVM artifacts, and
  CDM manifests. Dotify currently uses Hardhat Solidity, generated EVM ABIs,
  viem, and Paseo Asset Hub EVM RPCs.
- Product SDK Host APIs require a compatible Host container. Outside that
  container, host storage, host provider, product account, permissions, and
  resource allocation cannot be treated as available.
- Statement Store is small and ephemeral: 512-byte statement payloads,
  1024-byte total user budget, default 30-second TTL, and signed publishing.
  That is a good fit for discovery/presence heartbeats, not DAV2 media,
  SDP/ICE, durable chat history, or walletless guest reactions.
- Cloud Storage and Playground/Bulletin/DotNS help publication and deployment.
  They do not replace backend-held content-key custody or server-side upload
  verification.

## What PR #91 got right

PR #91 correctly identified that Dotify should not be merely a standalone
web3 music app. The strong direction is:

- make the chain/service stack invisible to builders and listeners;
- treat Product host capabilities as the long-term app environment;
- plan for Humanity / Individuality as the real differentiator behind
  `human-free`;
- use DotNS/Bulletin-style deployment as public product infrastructure;
- sequence Product SDK work explicitly instead of letting it stay implied.

## Why PR #91 should not be merged as-is

PR #91 is a draft against an older base and adds a duplicate numbered backlog
ticket. Since PR #92 merged, the local backlog already has ticket 25, access v2,
the Shared Score functional slice, multi-recipient royalty publication, and
fresh-deployment safety notes.

The PR also over-assumes implementation readiness:

- it treats Product SDK as a direct adapter layer before proving Host support,
  resource allocations, and current API shapes;
- it does not account for Dotify's current EVM/viem runtime path versus
  Product SDK PolkaVM/CDM contract tooling;
- it implies Statement Store can carry more room behavior than its current size,
  TTL, signer, and allowance model supports;
- it risks making Product SDK a hard dependency for first sound, which would
  break Dotify's link-first guest promise.

Recommendation: close PR #91 as superseded by a fresh branch from `main` with
this unnumbered roadmap note and the backlog sync workflow.

## Execution roadmap

### Phase 0 - Truth and governance

Goal: make the backlog truthful before new feature work.

- Mark ticket 25 delivered by merged PR #92.
- Reconcile Project 5 with local docs: statuses, duplicates, open issues, and
  stale completed cards.
- Keep GitHub Project 5 as the workflow board and local Markdown as the scope /
  acceptance source.
- Add `backlog.json` and `scripts/backlog-sync.mjs` so drift is visible in PRs.

### Phase 1 - Standalone production operation

Goal: make the existing web/API/signaling stack reliable enough for public
testnet users.

- Finish #11 frontend health and production readiness surface.
- Keep #36 and #37 focused on hosted signaling/API operation and frontend
  public-env validation.
- Validate DAV2 Range/MSE and fallback behavior across browsers and gateways.
- Decide whether a backend read-through gateway is needed for reliable first
  sound.
- Keep demo-mode Pinata and content secrets out of public deployments.

### Phase 2 - Shared listening depth

Goal: deepen rooms without breaking the room-guest doctrine.

- Preserve walletless guest entry for room listening.
- Add TURN/SFU/reconnect only where it improves room reliability.
- Keep Statement Store limited to host-signed presence/discovery until its
  constraints are solved for richer behavior.
- Treat provenance and ambassador work as consent/anti-abuse design first,
  mechanics second.

### Phase 3 - Product SDK feasibility

Goal: prove the Product host path with small spikes before committing the app.

- Pin Product SDK versions and add a compatibility matrix.
- Detect Host availability and supported chain/capability surfaces.
- Prototype Product account connection, signing, identity prompt behavior, and
  resource allocation.
- Compare Dotify's Hardhat/EVM runtime with Product SDK PolkaVM/CDM contracts.
- Prototype Playground deployment against Dotify's single-file build and secret
  boundary.
- Prototype Statement Store presence with strict payload, TTL, and signer
  limits.

### Phase 4 - Product integration

Goal: ship Product mode as progressive enhancement.

- Add Product-mode adapters behind explicit ports, leaving standalone adapters
  intact.
- Use Host signing and Product accounts only when the Host path is available.
- Surface Host permission denial as actionable UI state.
- Keep backend key delivery authoritative unless a Product-host design proves a
  stronger key-custody boundary.
- Keep `.dot`/Playground deployment separate from access enforcement.

### Phase 5 - Humanity / Individuality

Goal: replace the dev-operated registrar with a real, privacy-respecting source.

- Rewrite ticket 11 research around current Product SDK / Individuality APIs.
- Prove whether Dotify should use runtime reads, backend verified decisions,
  registrar mirror, or Host proofs.
- Document address binding across EVM account, Product account, identity
  account, DotNS username, and contextual alias.
- Only then promote Human free from research to build.

### Phase 6 - Cultural propagation

Goal: build the killer dapp layer after trust, first sound, and personhood are
real.

- Track consented provenance: which room, host, and listening moment introduced
  a track.
- Design ambassador recognition without referral spam or surveillance.
- Consider awards and cultural memory objects only after provenance and
  anti-abuse rules exist.

## Project 5 workflow

Use this workflow to keep the board and local backlog synchronized:

1. Local Markdown owns scope, acceptance criteria, and delivery notes.
2. `docs/backlog/backlog.json` owns issue-to-doc mapping, track, phase,
   priority, and item type.
3. GitHub Project 5 owns workflow status: Todo, In Progress, In Review, Done.
4. Every active execution issue belongs to Project 5 and has a local doc or an
   explicit roadmap mapping.
5. Delivered/design-history docs can stay local records without active project
   cards.
6. PRs run `node scripts/backlog-sync.mjs --check --offline`.
7. Manual/scheduled project audits run `node scripts/backlog-sync.mjs --check
   --live` with a user-scoped `PROJECT_SYNC_TOKEN`.
8. Closing an issue moves it to Done; reopening moves it to Todo; labels and
   Project fields identify track, phase, type, priority, and source doc.

Recommended Project 5 fields:

- Priority: P0, P1, P2, P3.
- Track: Production spine, Product SDK, Room reliability, Personhood,
  Cultural propagation, Design record.
- Phase: Now, Next, Product feasibility, Later, Record.
- Type: Work, Research, Epic, Record.
- Backlog doc: local Markdown path.

## Current issue triage

- #11: keep open/in progress for frontend health surface and public operation
  evidence.
- #12: keep open, rewrite around current Humanity / Individuality and Product
  host APIs before build.
- #13: keep open but sequence last.
- #27: mark superseded by access model v2.
- #33: triage as likely delivered or narrowed by current wallet work.
- #34: duplicate/overlap with server-side Pinata upload and backend operation.
- #35: duplicate/overlap with wallet-signed key requests and access v2.
- #36: keep open for hosted signaling operation evidence.
- #37: frontend production env validation and unsafe-secret guards are
  implemented by the web build guard; keep open until the PR is merged and
  deploy-host production variables are configured.
- #85: split into Product SDK baseline, contract portability, Playground deploy,
  Statement Store presence, and integration adapter spikes.
- #86: keep for cacheable catalog read model.
- #87: keep for responsive cover/gateway pipeline.
- #88: keep for DAV2 startup and backend read-through gateway decision.
- #89: keep for TURN/SFU/reconnect; constrain Statement Store to presence.
- #90: keep for value-before-wallet onboarding.
