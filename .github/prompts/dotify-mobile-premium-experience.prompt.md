Work in `knzeng-e/dotify`. Execute W28 using
`docs/backlog/implementation/W28-mobile-premium-experience.md`.

Read `AGENTS.md`, `docs/backlog/implementation/common.md`,
`docs/backlog/README.md`, `docs/context/dotify-product-memory.md`,
`docs/context/dotify-technical-memory.md`, and
`docs/context/dotify-philosophical-north-star.md` first.

Inspect the current working tree, latest `origin/dev`, dependencies, and related
issues/PRs. Work on `feat/mobile-premium-experience`, created from the latest
tested `dev`, without disturbing unrelated work. Implement only this sequence.

Prioritize shippable mobile improvements:

- correct live/direct mini-player state when room audio continues after leaving
  the room;
- touch-native horizontal track rails and clean track cards;
- immersive mobile full player with visible seek, previous/play/next, and
  secondary queue/support/repeat controls;
- room mobile layout that keeps player, chat, queue/requests, people and the
  composer reachable;
- desktop parity without dashboard clutter.

Preserve Dotify invariants: wallet-free room guests, host-only protected room
keys, no frontend production secrets, no hidden demo signer, no fabricated room
counts, no new payment policy, and no unsupported Product/Web3 claims.

Run meaningful tests and visual checks, write
`docs/backlog/implementation/evidence/W28.md`, and prepare a draft PR targeting
`dev`. Do not merge, deploy, spend funds, contact users, or start another
sequence unless separately authorized.
