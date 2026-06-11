# 17 - Artist studio Living Light parity

## Sprint
Design track - Living Light experience

## Priority
P2

## Objective
Bring the artist studio to the same Living Light language as the listener app: an aura identity header, metric cards, a "You own this space" sovereignty card, a "Latest support" feed, and a publish workbench with a live preview card. Preserve the real on-chain registration, publish, and royalty flows.

## Context
The studio is functional and dark-themed but not laid out to the prototype. Current files: `web/src/views/artist/ArtistConsole.tsx`, `OverviewTab.tsx`, `NewReleaseTab.tsx`, `ReleasesTab.tsx`, `RoyaltiesTab.tsx`, `ArtistOnboarding.tsx`. Reference: `design/Dotify-design/app/screens-artist.jsx` + `artist.css`, screenshots `02-studio-overview.png`, `01-publish.png`. The prototype Overview is a showcase (identity header with aura avatar + verified + runtime code chip + "since"; metric cards Releases / Listening now / Earned - paid direct; "Your releases" list with covers + now-listening; sovereignty card; latest-support feed). The current Overview is a registration/setup panel.

## Required work

- Studio identity header: aura/conic avatar, artist name + verified mark, `@handle`, runtime address as a code chip, "since" date - matching the public profile language. Keep the existing register/refresh actions reachable (move into the header or a settings area).
- Metric cards: Releases, Listening now (sum of now-listening across the artist's tracks), Earned (real total from `royaltyPayments`, "paid direct"). Use only real values.
- "Your releases" list: covers + access label + now-listening, linking into the player.
- Sovereignty card "You own this space": You hold the keys / You set the access / Value flows to you (warm copy, already in the brief).
- Latest support: reuse the real royalty payments feed (avatars via `Presence`).
- Publish workbench: align the existing stepper (`NewReleaseTab`) to the prototype's Assets -> Details -> Access -> Review with a sticky live preview card (cover + access chip + "you keep %"). Keep the real encrypt -> IPFS -> register pipeline.
- Apply the global aura to the studio (currently it inherits the resting aura, which is acceptable; optionally give the studio the artist's own aura).

## Constraints

- Do not change the registration, encryption, upload, or royalty logic - reskin and re-layout only.
- Real values only; omit unknowns (no invented listener counts or earnings).
- Honors the production rule: this is presentational and must not block or destabilize the spine.
- Straight ASCII; hyphens only.
- This pairs with #8 (frontend feature-module refactor): extract studio presentation from logic where it reduces risk.

## Acceptance criteria

- Studio overview shows the identity header, real metric cards, releases list, sovereignty card, and latest-support feed.
- Publish flow still encrypts, uploads, and registers on the runtime; review step reflects the draft.
- Royalties still read on-chain.
- `tsc -b`, lint, build green.

## Non-goals

- New artist features (analytics, payouts scheduling) beyond what contracts expose.
- Changing contract calls or ABIs.

## Senior-engineer notes
The studio is where sovereignty is felt. Keep every on-chain path intact; change only how it looks and reads. Reskin like a surgeon (see #8).
