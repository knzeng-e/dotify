# Offline Bulletin generation preparation — 2026-11-08

## Identity and outcome

Issue #407; branch `feat/bulletin-generation-migration` from merged/tested dev
`21f3f788` (#410). [ADR 0047](../../../adr/0047-offline-bulletin-generation-staging.md)
and [operator runbook](../../../operations/bulletin-generation-migration.md) define
the implementation and actual activation gates.

The explicit offline command inspects frozen declared sources and prepares a new
candidate. It preserves raw historical profiles, queues/encrypted files, permanent
reservations, publisher receipts/attempts and metadata sidecars. It requires a
conservative reserve and copies the greatest known account cursor. The new profile
binds an inherited-reservation baseline checked before signer loading/publication.
It neither edits old state nor selects/activates the candidate.

## Local proof and limits

Node 22.13.1 on macOS. Dependencies reused through untracked symlinks to clean
same-lockfile temporary worktrees; they are excluded from the commit. All test
state is generated in temporary directories. No live source, private seed,
content vault, artist file, Bulletin endpoint or deployed service is used.

- API suite: **360 tests / 42 suites pass**, including seven new migration tests.
  A subsequent package-digest change is checked by the targeted migration tests
  and API build/typecheck; final CI remains authoritative for the combined source.
- Targeted migration tests prove exact declared-history copies, nonce union and
  rejection of a reused old generation, source immutability, conservative
  multi-generation floors and the greatest account cursor.
- A fresh child process verifies a relocated same-disk copy; the package digest
  can be required from a separately retained trusted record. Changed/missing state
  or a wrong trusted digest is refused. This is **not off-volume recovery proof**.
- A staged queue opens with synthetic publisher dependencies; deleting an inherited
  reservation stops a later open before another signer load. The actual seed path
  does not exist throughout inspection/staging, so no seed is needed/read.
- Stale exact-plan hashes, partial destinations, pending/account barriers, orphan
  inventories, active encoding, missing/malformed reservations, lower reserves,
  mismatched account, links, public permissions and crash locks are refused.
- API typecheck/build and offline backlog/diff checks pass. Frontend code, SDK,
  encryption/writer engine and on-chain contracts are unchanged; no new physical
  device, audio-latency, payment or frontend acceptance is claimed.

## Next gate

Review this tool, then inventory all real frozen generations and external account
obligations; omitted sources cannot be discovered by the command. Authenticate
prepared ciphertext with the existing vault and rehearse coherent off-volume
security/database/key recovery. Local opaque-byte preservation does not prove
content-key recovery. Review incomplete archived work; no old failed draft is
silently resumed under the fresh allowance.

Measure actual artist graphs/encoding throughput and fresh finalized authorization,
quota/retention/nonce, prepare the concrete network/maintenance budget and matched
client rollout. Only then request activation and actual ordinary Web/Desktop
artist-wallet registration, catalogue readback and audible checks. #407 remains
open. Existing synthetic pilot, Product/Web 0.1.80, keys, musical bytes and services
remain unchanged; no maintenance, upload, renewal, quota change or key transfer
occurs in this implementation turn.
