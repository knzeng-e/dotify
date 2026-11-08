# 0047 — Start fresh for development publication

Date: 2026-11-08. Status: active bounded development deployment in 0.1.81; actual artist/public-pilot acceptance remains open.
Refs #407 and merged #410 / ADR 0046.

## Delivery checkpoint

[0.1.81 delivery](../backlog/implementation/evidence/product-0.1.81-rollout-2026-11-08.md) records owner-approved activation, retained keys/state, exact budgets and real acceptance still required.

## Decision

The owner chose a fresh development start rather than migrating old test drafts
and publication inventories. Replace #411's unmerged migration candidate with a
small explicit initializer: a new private queue/publisher, a newly generated
32-byte content master under an unused later version, and ADR 0046's bounded
multi-release policy. Old state stays at its original paths and is not opened,
rewritten, imported, retried or deleted by this initializer.

This is a fresh **publication/key domain**, not deletion of a blockchain or reset
of the whole application. The existing artist runtime can publish new content
hashes with this domain. A deliberately empty catalogue/new artist space, if
wanted, still uses the normal wallet-approved runtime flow; this tool does not
create one or bypass artist authority. No new contract deployment is needed just
to stop recovering old unpublished drafts.

## Why an empty encryption ledger is safe here

Every release key uses HKDF with its configured content master, key version,
chain, artist runtime and content hash. The initializer generates a new random
master and uses one version later than every declared retired version. It does
not relabel an old secret or reuse a release key with a reset ledger. The new
queue can therefore begin with no inherited reservations. After first use, its
own permanent reservations must never be reset or recreated.

The generated profile has optional `freshContentKey` with version and master
SHA-256. At publisher startup, before a transport session or storage signer is
opened, the actual active vault version and secret must match that binding.
Admission and publication recheck it. No secret goes to the frontend, routine
CLI output, profile or report. The generated mode 0600 `content-key.json` stays
private outside queue/inventories; deploying it uses the existing private secret
workflow. Retain prior version secrets for existing read references; key rotation
is not automatic catalogue migration or re-encryption.

Profiles without this binding keep their normalized hash and existing behavior.
The isolated encoder, permanent nonce implementation, sender/nonce receipt engine,
wallet grants, key-service access checks and artist registry remain unchanged.

## The storage account does not reset

A new content master has no effect on Bulletin account authorization, quota,
transaction nonce or retention duties. The request explicitly supplies an account
nonce floor and the profile's prior renewal reserve; the initializer preserves
both. It does not infer or verify live account state (`accountStateVerified:false`).
The existing writer compares with finalized state before writing and permits only
safe monotonic progress without a pending owned submission. At cutover, exclude
old/account-sharing writers and reconcile unresolved submissions first. No stale
account barrier is bypassed by starting a fresh directory.

Use the full existing account reserve, including old application/media/lab
obligations, until explicitly decommissioned. This is not a budget refund or
permission to drop remote retention. New per-release/global caps still need their
concrete measured allowance. Retention and coherent recovery remain public-pilot
requirements; a migration of abandoned test drafts is no longer a prerequisite
for this development slice.

## Provisioning and failure boundary

One strict private request names the absent destination, retired versions,
account floor and complete new multi-release profile. All admitted artists must
use the same new version. New inventories must be inside the destination; the
installed storage signer stays outside it and is never read/copied. The parent
is canonical and owner-private. Output uses private directories, exclusive first
creation and durable state writes. An existing or partial destination is refused,
never cleaned up to force a retry. `ready.json` is written last.

The request's retired-version list is an operator declaration, not discovery of
all prior keys; compare it with the actual vault before installation. The random
new master provides independent encryption even when old historical nonce files
are damaged. Do not start the damaged old writer; keep its old files available
for later investigation/archival. There is no historical nonce import/sealing
path in this candidate. This removes the omitted-reservation path reported in
[the #411 review](https://github.com/knzeng-e/dotify/pull/411#discussion_r4505214976).

Local synthetic tests prove two fresh-domain audio/cover/metadata releases,
manifest authentication and master decryption, old-version key stability,
pre-signer refusal for wrong configuration, private output and refusal to
reinitialize. They do not prove real wallet/audio acceptance, network quota or
physical Host behavior. Actual installation, matched rollout and reviewed
maintenance/network budget remain necessary; #407 stays open until real
Web/Desktop artist publication, catalogue readback and sound.
