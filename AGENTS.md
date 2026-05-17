# AGENTS.md

## Project

Dotify is a decentralized cultural social hub for real-time shared listening, artist-owned smart runtimes, protected audio access, and human-centered music discovery.

Dotify is not a Spotify clone.

Spotify optimizes individual consumption. Dotify must optimize shared musical presence, artist sovereignty, and cultural transmission.

## Product north star

Make the experience feel as simple as sharing a link, while keeping the deeper infrastructure — smart runtimes, IPFS, encrypted access, royalties, and personhood-aware policies — as the invisible foundation.

The user-facing promise is:

> I can listen with another human being, discover an artist through social presence, and know that the artist keeps control over access, rights, and value flows.

## Current execution priority

The current priority is production readiness, not feature expansion.

Build the production spine first:

1. Move production secrets out of the frontend.
2. Move Pinata upload and content-key delivery server-side.
3. Implement wallet-signed content-key requests.
4. Make room creation and joining as simple as sharing a link.
5. Add deterministic tests for Classic unlock, artist publishing, and room joining.
6. Modularize the frontend without changing product behavior.
7. Generate ABI bindings instead of hand-maintaining contract interfaces.

## Source of truth

Read these files before implementing:

- `docs/backlog/README.md`
- the relevant ticket file under `docs/backlog/`
- `docs/context/dotify-product-memory.md`
- `docs/context/dotify-technical-memory.md`
- `docs/context/dotify-philosophical-north-star.md`

For product/vision context, also review:

- `spec.md`
- `README.md`
- `docs/Dotify_presentation.pptx`
- `docs/index.html`

## GitHub Pages alignment rule

`docs/index.html` is the public-facing project page.

When a change affects public product positioning, roadmap, production priorities, architecture narrative, presentation links, or the philosophical framing of Dotify, update `docs/index.html` in the same PR.

Keep the page aligned with the DApp visual identity from `web/src/styles.css`: Dotify Light Console, deep blue core, cyan action accents, restrained Polkadot pink, white surfaces, and low-friction product language.

Do not let the page drift into generic crypto landing-page aesthetics.

## Engineering rules

- Do not bundle production secrets in frontend code.
- Do not expose unrestricted Pinata credentials in Vite variables.
- Do not use dev accounts or hidden fallback signers in public user flows.
- Do not silently bypass wallet access checks.
- Do not add speculative tokenomics before the production spine is stable.
- Do not grow `web/src/App.tsx` further with unrelated business logic.
- Preserve existing local demo behavior unless the active ticket explicitly changes it.
- Prefer typed services, explicit errors, and small modules.
- Fail closed on ambiguous access checks.
- Keep user-facing errors understandable without blockchain expertise.
- Document security boundaries honestly.

## Commands

Frontend:

```bash
cd web
npm install
npm run dev:listen
npm run build
npm run lint
```

Contracts:

```bash
cd contracts/evm
npm install
npm test
npm run compile
```

## Implementation discipline

When working on an issue:

1. Read the issue.
2. Read the matching `docs/backlog/XX-*.md` file.
3. Implement only the requested scope.
4. Add or update tests when requested.
5. Update docs when behavior or setup changes.
6. Update `docs/index.html` when product positioning, roadmap, architecture narrative, public presentation, or visual identity changes.
7. Avoid unrelated refactors.

The standard is senior engineering: secure by default, explicit in failure, clean enough for future contributors, and faithful to the product's human-centered purpose.