# Fresh development publication candidate — 2026-11-08

Refs #407 / #411; based on tested merged dev `21f3f788` (#410). The owner chose
a fresh development start rather than migration of old test drafts. The
unmerged migration tool and its nonce-import/sealing path are removed from #411.
[ADR 0047](../../../adr/0047-fresh-bulletin-development.md) and the
[fresh setup runbook](../../../operations/bulletin-fresh-development.md) define the
replacement, operational boundaries and acceptance still required.

## Automated evidence

Local Node 22.13.1, macOS. Dependencies reused with temporary untracked symlinks
to clean same-lockfile worktrees. All new state/keys are synthetic test fixtures;
no live custody files, storage signer, artist source, network endpoint or service
is accessed by these tests.

- **358 API tests / 42 suites pass**, including five new fresh-start tests.
- The initializer leaves an old terminal job with a missing permanent reservation
  and its old owner/ledger unchanged. It creates a separate random 32-byte master, later
  version, private key file, empty admission/nonce queue and declared account floor.
  This is not a historical migration with an incomplete imported reservation set.
- Wrong active version or wrong content master refuses publisher startup before
  any transport session or storage-signer load. The bound correct configuration
  opens with synthetic dependencies; old unbound profiles retain prior behavior.
- The integration prepares two different new-domain sources, publishes their
  audio/cover/metadata via the actual queue/graph/publisher with a fake transport,
  authenticates their manifests and decrypts the prepared masters. The old key
  cannot authenticate the new output, while retained old-version derivation is
  unchanged. Six inventories remain, with no account cursor rewind.
- Existing/partial destinations, a reused version and mixed policy versions are
  refused. A child-process CLI invocation succeeds without printing its new key.
- API typecheck and production build, formatting, offline backlog and whitespace
  checks pass. Final PR CI is authoritative for the repository matrix.

The encoded media payload is a structural test fixture, not a playable rendition.
These checks do not prove wallet registration, audible Host/Web playback or live
quota/retention. Frontend, SDK, contracts and the encryption/receipt engine are
unchanged by this slice. No migration, deletion, service maintenance, live key
installation, musical write or quota change is performed in this turn.

## Review finding

[discussion_r4505214976](https://github.com/knzeng-e/dotify/pull/411#discussion_r4505214976)
correctly identified missing saved-generation validation in additional queues of
the original migration implementation. That entire path is removed, rather than
retained as an unsafe optional shortcut. A fresh domain never seals old queue
reservations or claims the old history is complete. The damaged-history regression
checks that separation; runtime key binding checks the independent domain.

## Next acceptance

Review and merge the fresh initializer. Prepare the actual artist/runtime scopes,
representative graph/throughput budget, unused version and current account
nonce/quota/authorization/retention plus existing obligations. Obtain the concrete
maintenance/rollout/write authorization, install the new content mapping through
private secret input with prior read versions preserved, and deploy matched
#410+ clients/API. Then actual ordinary New release, explicit artist-wallet
approval, catalogue readback and audible Web/Desktop/phone playback close #407.
No historical draft recovery is required for this test. Conservation and coherent
key/security recovery remain wider public-pilot duties; no recurring renewal is
activated. Existing Web/Product 0.1.80 and the live synthetic admission remain
unchanged until that reviewed cutover.
