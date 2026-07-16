# CLAUDE.md

## Dotify in one sentence

Dotify is a decentralized cultural social hub where music becomes a live social connector: artists publish rights-managed works through artist-owned smart runtimes, and listeners discover music through shared real-time presence.

Dotify is not a Spotify clone.

## Philosophical line

The project starts from a simple social observation: in shared spaces, people are physically together but spiritually isolated. Dotify/Muzinga explores whether music can reopen a human commons inside that isolation, while leveraging the web 3 principles and philosophy, as promoted by Polkadot community, Dr Gavin Wood and Parity.

The goal is not merely to stream audio. The goal is to restore a form of relation: one human can let another enter their musical world, in real time, without dispossessing the artist.

Think of Dotify as:

- a social listening room;
- an artist sovereignty layer;
- a rights-aware music runtime;
- a cultural propagation system;
- a Web3 infrastructure for shared presence.
- a community-powered cultural coordination protocol.

The technology must serve the living social experience, not dominate it.

## Product north star

The product must feel simple:

```txt
create a room -> share a link -> listen together
```

The infrastructure can be deep:

```txt
artist runtime -> encrypted IPFS audio -> on-chain access policy -> wallet-signed key request -> WebRTC room
```

But the user must not be forced to understand all of that before feeling the value.

## Current strategic priority

The current goal is production readiness, not adding more features.

Build the production spine first:

1. backend key service;
2. server-side Pinata uploads;
3. wallet-signed content-key delivery;
4. hosted signaling and room links;
5. Classic unlock e2e coverage;
6. artist publish e2e coverage;
7. room join e2e coverage;
8. frontend modularization;
9. generated ABI bindings;
10. observability and health checks.

## Active execution focus

Ticket 25 (`docs/backlog/25-thresholds-functional-v1.md`) is delivered on
`main` by PR #92 and is now a delivery record, not the active ticket.

The current "Now" work is the production operation and backlog-sync set:

- `docs/backlog/10-observability-health-checks.md` / #11 - frontend health
  surface and public operation evidence;
- #36 - hosted signaling operation evidence for public rooms;
- #37 - production environment validation and unsafe-secret guards.

The immediate Product SDK planning track is
`docs/backlog/polkadot-product-readiness-and-killer-dapp-roadmap.md` / #85.
Treat Product SDK / Playground / Humanity work as a gated feasibility track and
progressive enhancement until the relevant Host, contract-portability,
Statement Store, and privacy boundaries are proven.

## Source of truth

Before implementing, read:

- `docs/backlog/README.md`
- the matching issue file under `docs/backlog/`
- `docs/context/dotify-product-memory.md`
- `docs/context/dotify-technical-memory.md`
- `docs/context/dotify-philosophical-north-star.md`
- `README.md`
- `spec.md`
- `deployments.json` (canonical contract addresses for all deployed pallets)

Also inspect:

- `docs/Dotify_presentation.pptx`

The presentation is part of the product memory and should inform the tone, positioning, and UX direction.
List every file/repo you plan to modify and wait for my confirmation before making any edits.

## Engineering posture

Work as a senior blockchain engineer.

Be explicit, skeptical, and production-minded.

Do not:

- expose secrets in Vite/frontend variables;
- keep production key material in the browser bundle;
- use dev accounts as hidden public fallback signers;
- bypass wallet access checks silently;
- add speculative tokenomics before the production spine is stable;
- grow `App.tsx` with more unrelated business logic;
- overpromise DRM guarantees;
- hide complex failure modes behind vague messages;
- insert curly/smart quotes (U+2018/U+2019/U+201C/U+201D) or unescaped apostrophes into source files — use straight ASCII quotes; they break esbuild silently.

Do:

- fail closed on ambiguous access decisions;
- document security boundaries;
- keep the user experience simple;
- make blockchain complexity invisible where possible;
- use typed APIs and explicit errors;
- add tests for critical flows;
- preserve existing local demo behavior unless the active ticket says otherwise;
- make every technical detail serve the social/philosophical purpose;
- ground all explanations of contract/pallet behavior in actual source code with file and function references.

## Product language

Prefer language that frames Dotify around connection, presence, artist sovereignty, and cultural transmission.

Use terms like:

- listening room;
- shared listening;
- artist runtime;
- protected access;
- cultural propagation;
- ambassador;
- human-verified access;
- music as a living common.

Avoid reducing the product to:

- Spotify clone;
- NFT music marketplace;
- crypto streaming app;
- token reward system;
- referral machine.

## Implementation discipline

For each issue:

1. Read the issue body.
2. Read the matching `docs/backlog/XX-*.md` file.
3. Identify touched modules.
4. Preserve unrelated behavior.
5. Add tests or document why not.
6. Update README/spec/context docs if behavior changes.
7. Keep commits focused.

## Build & Verification

Always run typecheck, lint, and build after making code changes; report results before considering work complete.

## GitHub Pages alignment rule

`docs/index.html` is the public-facing project page.

When a change affects public product positioning, roadmap, production priorities, architecture narrative, presentation links, visual identity, or the philosophical framing of Dotify, update `docs/index.html` in the same PR.

Keep the page visually aligned with the DApp theme from `web/src/styles/` (tokens.css and aura.css): Dotify Night Console, deep navy canvas, track-driven Living Light aura, electric cyan action accents, restrained Polkadot pink, glass chrome, and clear low-friction product language.

Do not let the page drift into generic crypto landing-page aesthetics.

## Commands

Frontend:

```bash
cd web
npm install
npm run dev:listen
npm run build
npm run lint
npm run typecheck
```

Backend API:

```bash
cd services/api
npm install
npm run dev        # tsx watch (hot reload)
npm run typecheck
npm run build
npm run start      # production (requires build first)
```

Contracts:

```bash
cd contracts/evm
npm install
npm test
npm run compile
```

## Final reminder

Dotify must be as simple as a shared link, as alive as a listening room, as fair as an auditable access policy, and as deep as a cultural commons.

Do not build a casino wearing headphones. Build infrastructure for relation.
