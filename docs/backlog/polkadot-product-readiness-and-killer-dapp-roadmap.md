# Polkadot product readiness and killer dapp roadmap

Status: active execution note; the Product DevNet baseline is implemented on
`feat/product-devnet-adaptation`.

Last Product SDK verification: 2026-07-26 against
`@parity/product-sdk` 0.19.1 and
`@polkadot-community-foundation/polkadot-app-deploy` 0.13.1.

## Verdict

Dotify should align with the Polkadot product ecosystem without replacing its
standalone production path with Product SDK assumptions.

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

The first adaptive slice is now implemented:

- a separate Product DevNet build and `dotify-test01.dot` manifest;
- explicit Host detection and app-scoped Product account connection;
- Product identity for room presence without claiming EVM/EIP-191 authority;
- canonical `.dev-dot.li` room links;
- shared Fly API/signaling allowlists for Netlify and Product origins;
- Product Mobile WebRTC boundary detection with an external-browser
  continuation when the host sandbox does not expose `RTCPeerConnection`;
- a pinned build/deploy workflow and operator rollback guide.

Typed runtime ports are now extracted in the follow-up branch. Product-native
contract writes, Product-signed key requests, Product personhood, and Product
presence transport remain gated follow-up work.

## Product ecosystem evidence

The current Parity product direction is coherent: Levity for publishing,
Product SDK for shared app capabilities, Playground for AI-assisted deploy and
`.dot` publication, and Humanity / Individuality for sybil resistance. The
recent messaging is about making infrastructure invisible to builders and
users, not about every part being production-ready today.

The SDK details matter for Dotify:

- Product SDK and Playground are explicitly prototype / reference / unaudited
  code.
- Product DevNet exposes the Asset Hub, People, and Bulletin system-chain
  topology used by the current Product tooling.
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

- #11 frontend health/readiness, #36 hosted signaling evidence, and #37
  frontend public-env validation are delivered/closed.
- #33 public injected-wallet/device validation is delivered/closed; Product
  host/account integration remains scoped to #85, not reopened here.
- #86 cached catalog implementation is active: the browser uses one cacheable
  API request, while the backend persists and reconciles SmartRuntime state.
  Keep it open until review and public warm/cold p75 evidence are attached.
- Validate DAV2 Range/MSE and fallback behavior across browsers and gateways
  through #88.
- Decide whether a backend read-through gateway is needed for reliable first
  sound through #88.
- Keep demo-mode Pinata and content secrets out of public deployments.

### Phase 2 - Shared listening depth

Goal: deepen rooms without breaking the room-guest doctrine.

- Preserve walletless guest entry for room listening.
- Add TURN/SFU/reconnect only where it improves room reliability.
- Keep TURN/network failures separate from Product Mobile runtime-capability
  failures: missing `RTCPeerConnection` happens before ICE and cannot be fixed
  by a relay. Upstream Product Mobile clarification is tracked in
  [dotli-community#27](https://github.com/Polkadot-Community-Foundation/dotli-community/issues/27).
- Keep Statement Store limited to host-signed presence/discovery until its
  constraints are solved for richer behavior.
- Treat provenance and ambassador work as consent/anti-abuse design first,
  mechanics second.

### Phase 3 - Product SDK feasibility

Goal: prove the Product host path with small spikes before committing the app.

- Delivered: pin Product SDK/deploy versions and add a compatibility matrix.
- Delivered: detect Host availability without blocking standalone first sound.
- Delivered: connect the app-scoped Product account only on explicit action and
  separate identity capability from EVM signing capability.
- Delivered: publishable Bulletin/DotNS build and dual-origin Fly boundary.
- Remaining: prototype host transaction signing and resource allocation.
- Compare Dotify's Hardhat/EVM runtime with Product SDK PolkaVM/CDM contracts.
- Delivered on the room-beacon branch: Statement Store presence with strict
  payload, TTL, and signer limits. Host-only publication, per-room last-write-
  wins channels, 512-byte and 1024-byte budgets enforced before writing, and
  expiry-based eviction on the reading side. Ships dormant
  (`VITE_DOTIFY_ROOM_BEACONS=off`) until discovery has a reader and live host
  evidence exists; joining stays on Socket.IO/WebRTC because moving it would
  require every guest to hold an identity.

### Phase 4 - Product integration

Goal: deepen the delivered Product mode one adapter at a time.

- Delivered: keep standalone adapters intact and lazy-load Product host code.
- Delivered: use the Product account as presence identity only when available.
- Delivered: surface host absence and unsupported signer boundaries explicitly.
- Delivered on the follow-up branch: extract typed runtime read/write ports and
  move the current viem runtime implementation behind `RuntimeReadPort` /
  `RuntimeWritePort`.
- Delivered on the next follow-up branch: add an experimental CDM/PAPI adapter
  behind those ports. It is not selected by default until Dotify has
  CDM-installed Product runtime packages and host-signed transaction evidence.
- Delivered on the next follow-up branch: add an API-side Product sr25519
  signature scheme for key delivery and session sign-in. It binds the Product
  account public key to the derived H160 requester before nonce consumption and
  access checks.
- Delivered on the next follow-up branch: wire Product-host frontend key and
  session requests to that signature scheme, while keeping contract writes on
  the standalone EVM/passkey signer path.
- Delivered on the next follow-up branch: generate the CDM manifest and typed
  contract augmentation from the same Hardhat artifacts as the viem bindings,
  and implement the real Product contract resolver behind the runtime ports.
  Selection stays opt-in behind `VITE_DOTIFY_RUNTIME_ADAPTER=product-cdm`.
- Settled: the chain question. Product DevNet is a preset over the Paseo system
  parachains (Asset Hub 1000, People 1004, Bulletin 1010) at EVM chain
  420420417, not a separate network. Dotify's contracts are already there,
  verified by byte-identical ArtistDirectory code served from both the DevNet
  and Hub TestNet endpoints. No contract redeploy is needed to port to DevNet.
  The SDK's `paseo` preset is Paseo Next (1500/1502), a different network, so
  `devnet` is the only environment Dotify can serve a catalog from.
- Next: `pallet-revive` account mapping plus real host-signed transaction smoke
  tests before Product writes can replace the EVM wallet path. This is now the
  only gate left for Product contract mode.
- Next: run real Product host smoke tests for protected playback and capture the
  Product sr25519 request evidence.
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

- #11: closed; backend/signaling/frontend readiness surfaces are delivered.
  Residual gateway/DAV2 operation evidence belongs to #88.
- #12: keep open, rewrite around current Humanity / Individuality and Product
  host APIs before build.
- #13: keep open but sequence last.
- #27: mark superseded by access model v2.
- #33: closed after public injected-wallet, deployment, SmartRuntime publish, and
  wrong-chain recovery validation evidence. Product SDK host/account work remains
  #85.
- #34: closed/superseded by delivered ticket 02; Project 5 should keep it as a
  Done/Record card only.
- #35: duplicate/overlap with wallet-signed key requests and access v2.
- #36: closed after hosted signaling operation evidence.
- #37: closed after #99 and manually checked deploy-host production env
  evidence.
- #85: Product SDK baseline, Product DevNet deployment slice, and typed runtime
  port extraction implemented; keep open for CDM/PAPI contract portability,
  backend Product signatures, resource allocation, and bounded Statement Store
  presence.
- #86: implementation active on `codex/86-catalog-read-model`; keep In Progress
  until review and public performance evidence close the warm/cold budgets.
- #87: keep for responsive cover/gateway pipeline.
- #88: keep for DAV2 startup and backend read-through gateway decision.
- #89: keep for TURN/SFU/reconnect; constrain Statement Store to presence.
- #90: keep for value-before-wallet onboarding.
