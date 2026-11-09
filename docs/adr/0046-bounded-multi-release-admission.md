# 0046 — Bounded Bulletin admission across releases

Date: 2026-11-08. Status: active bounded development deployment in 0.1.81; actual artist/public-pilot acceptance remains open.
Refs #407, extending ADR 0043/0044 while preserving their existing pilot paths.

## Delivery checkpoint

[0.1.81 delivery](../backlog/implementation/evidence/product-0.1.81-rollout-2026-11-08.md) records owner-approved activation and actual artist acceptance still required.

## Problem and decision

The current publisher deliberately admits one exact synthetic release. Removing
that guard would leave per-job budgets without a global limit, and the public
asset policy would still refuse the second cover/manifest. The artist should
publish successive works through the ordinary journey, without an operator
exception for each content hash, inside an explicitly reviewed storage allowance.

Add an optional `releasePolicy` to a fresh immutable publisher profile. It lists
allowed owner/chain/runtime/key-version tuples, not track hashes, plus a maximum
release count, separate cover/metadata caps and one aggregate attempted-store/byte
ceiling. Audio keeps the existing profile budget. The inline policy requires
explicit Bulletin audio/public-asset selection and cannot coexist with the old
pilot scope or public-asset policy file. Profiles without it preserve their
existing bindings and behavior; there is no automatic upgrade.

## Whole-release reservations

Let A, C and M be the audio, cover and metadata caps. Effective admission count is:

`min(maxReleases, floor(totalBytes / (A.bytes + C.bytes + M.bytes)), floor(totalTransactions / (A.tx + C.tx + M.tx)))`.

A read-only preflight checks eligibility/capacity. Admission then durably charges
one complete A+C+M allowance before encoding/reserving encryption nonces, or before
a cover reaches storage. Thus concurrent audio/cover requests for the same work
charge one release; distinct works compete atomically for remaining slots.

`release-admission.json` is private, bounded and bound to the normalized profile
hash. A release identity includes chain, runtime, content hash and key version.
Its audio UUID is deterministic; its public-asset job IDs also bind the part/root.
These IDs identify work, not encryption nonces: every new encrypted generation
still uses the permanent nonce ledger. At most one audio, cover and first metadata
graph can claim each release. Existing writer inventories retain actual attempted
stores/bytes and enforce each immutable part cap, so the aggregate reservation
bounds failed/uncertain/repeated submissions as well as successful ones.

Reservations are never refunded automatically, including for unused parts,
abandoned drafts, queue cleanup or expired remote blocks. This conservatively
uses more allowance than charging only actual stores, but avoids crash-dependent
refunds and prevents a sequence of failed jobs from resetting the budget. Growing
or rolling an allowance requires a reviewed new generation, not editing counters.
[ADR 0048](0048-exact-release-admission-extension.md) proposes an exact-source
admission generation in the same key domain, archiving the prior checkpoint and
retaining every existing claim instead of copying/resetting nonce state.

## Data flow and authority

1. Existing signed upload grants and canonical artist checks remain mandatory.
   Audio admission also checks the policy owner; the encoder rechecks current
   authority before publication. Cover requests carry the content hash, with the
   active key version supplied by the server. A local preview needs neither a
   stored cover nor a wallet call; selecting cover before audio defers its upload.
2. Audio admission and public-part claims share a local serialization tail under
   the existing process-lifetime publisher lease. Each claim is atomically saved
   and fsynced before the writer runs. The actual account nonce cursor, pending
   intents, receipts, writer lock and bounded submission pipeline remain unchanged.
3. The first strict metadata input is preserved per release, excluding only retry
   `createdAt` differences. Metadata must point at ready audio and, when present,
   cover inventories for the same scope. It cannot substitute another release's
   objects. Those previously verified immutable dependencies need fresh canonical
   retention checks before metadata storage; this does not redownload audio or
   silently renew it. A past `ready` flag alone is insufficient.
4. Missing admission history, changed bindings, orphan inventories, wrong part
   caps or a pending account barrier fail closed. Pre-encoding admission may use the atomic allowance ledger while this process
   has a known live writer; its owner/job journal files are saved in separate
   durable steps. Every final publication validates the complete history under
   the writer tail. Once the client closes, an unresolved barrier blocks new
   admission. A lost store response is reconciled by the existing sender/nonce/CID
   engine; another release cannot bypass it. No ambiguous submission is treated as unused budget.
5. Storage readiness does not register the release or grant listening access.
   The artist still signs runtime registration, catalogue readback confirms it,
   and the signed key service enforces the canonical access policy.

Public covers and metadata use the existing readers. No Pinata fallback, new
service, account authority, payment rail or frontend secret is introduced.
Public filenames, allowed sizes and strict metadata validation remain bounded.

## Development follow-up, 2026-11-08

The owner selected [fresh content-key development setup](0047-fresh-bulletin-development.md)
instead of migrating abandoned test drafts. A new random master/version permits
a fresh encryption ledger; existing account duties and old read keys remain.
Carry-forward rules below apply when reusing an existing encryption key domain.

## Operational and rollback boundaries

Fresh provisioning creates the admission ledger exclusively. Startup never
recreates it. Existing pilot queues/inventories and their histories are not
rewritten into the new mode. A new generation reusing an existing content-key domain must
carry forward permanent encryption nonce reservations and all prior attempted/
retained obligations through a reviewed coherent migration/backup procedure;
this PR supplies no automatic migration command or activation allowance.

The profile's declared prior renewal floor and all previous attempted/retained
graphs still reduce live account availability through the existing transport.
Local reservations are not on-chain quota, sustainable retention, a scheduler
or proof of funded capacity. Expired authorization, insufficient quota or
unavailable dependency retention stop publication; no renewal is activated here.

Matched Web/Product clients must send the cover's release identity before this
mode is activated. Older clients fail closed; existing catalogue playback does
not change. Older strict server builds cannot open the new profile/ledger: keep
the previous generation intact, stop writers before switching, and reconcile all
pending submissions before any rollback. Never delete state to make it boot.

## Alternatives and remaining acceptance

An unbounded publisher or an increased allowance for every new job would not
bound aggregate spending. A new signer/service per part would complicate nonce
ownership and recovery. Continuing one-file exceptions recreates the owner's
friction. Charging only successful receipts could refund unknown broadcasts.

Local synthetic tests prove two complete releases, atomic capacity admission,
restart/response-loss recovery, reference isolation and retention refusal.
Representative artist encoding/throughput, migration and off-volume restore,
conservation/authorization monitoring and actual Web/Desktop wallet/catalogue/
listening acceptance remain deployment gates. This candidate does not authorize
musical uploads, maintenance, quota changes, signing or key transfer.
