# Explicit compact dispatch and exact admission — 2026-11-12

Refs #407. Implementation commit **`a0c8ae183d2c68eb95b8a4e4ef83957abcde96a5`**, based on merged/tested dev
**`757a26a25614d9b0268e4f7ce9def9365c7aa2b2`** (merged #435). Dev integration
[run 43052364279](https://github.com/knzeng-e/dotify/actions/runs/43052364279)
was green before this branch started.

## Scope and authority

The [delivery reference](../../../reference/bulletin-compact-delivery.md) owns the
wire, HTTP and ledger contracts. [ADR 0054](../../../adr/0054-explicit-compact-delivery.md)
explains the choice. This slice connects the existing compact graph/readers to
an explicit registered reference, ordinary Web/API/Host dispatch and a reviewed
exact-source admission. Existing profiles, references and claims stay standard.

All media, keys, chain policies and storage used here are synthetic local
fixtures. No production state, artist audio, hosted service, signer or wallet
was used. Zero live Bulletin/DotNS operations, renewals, production profile/admission applies,
image uploads, service changes or deployments occurred. The recorded delivery
stays Web/Product/public APIs 0.1.82 and custody #426; #407 stays Now/In Progress.

## Local validation

| Check                                     | Result and scope                                                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Full API suite                            | **461 tests / 42 suites pass**, zero failures or skips                                                                               |
| Final focused access/media checks         | **23 tests pass**; include compact Classic/Room denials, Free zero-address policy, reference substitution and shared HTTP rate limit |
| Full Web unit suite                       | **1,143 tests / 148 files pass**                                                                                                     |
| Existing browser journeys                 | **60 pass**, two workers, zero retries: Classic unlock, artist publication and Room joining                                          |
| API typecheck and build                   | Pass                                                                                                                                 |
| Web and frozen Product DevNet builds      | Pass with API dependencies temporarily absent; restored afterwards                                                                   |
| Web lint                                  | Zero errors; two pre-existing App hook dependency warnings                                                                           |
| Web formatting and changed API formatting | Pass; generated ABI bindings remain excluded by the normal Web formatter contract                                                    |
| Offline backlog and whitespace checks     | Pass                                                                                                                                 |

The API vector tests run the actual catalogue route, bounded raw-block reader,
manifest authentication, compact reconstruction and ordinary object GCM for all
qualities. Wrong scope/missing keys refuse; inactive or ambiguous references,
archives, direct packs, offsets, wrong format paths and ranges issue no allowed
media response. The two formats share one 240-request rate-limit store.

Publisher tests cover ready reuse and a lost acknowledgement after inclusion in
both formats. Restart retains graph, generation, blocks and layout; the encoder
runs once and each included block is submitted once. An altered layout refuses
before loading a signer. Exact extension tests retain old claims/slots, bind the
first compact claim before inventory work, and reject downgrade, changed bounds,
retrospective identity selection and unsupported versions. Cover/metadata proofs
and prior obligations remain required.

Web tests reconstruct/decrypt the same vector through native selection and
matching HTTP recovery. The ordinary player prepares both Web and Host paths
and passes authenticated logical bytes into a structural SourceBuffer stub.
Warm cache identity includes layout, and late cancellation cannot populate it
or start recovery. Metadata preserves the full compact reference, including
prepared-details reuse. Existing standard flows remain covered by the complete
unit and 60 browser journeys.

## What these results do not prove

The new vector and SourceBuffer checks are structural: their bytes are not a
playable AAC release, and the buffer stub does not decode or produce sound.
The existing 60 browser journeys exercise standard publications, not a live
compact artist release. The build checks prove dependency separation and
compilation; they are not first-sound evidence artifacts or a deployment.
Existing large-chunk warnings remain. No new dependency audit is claimed;
#432/#433 retain their separate security scope.

Real AAC startup/seek/adaptation, legacy and mixed-format acceptance, intended
Host/Room/background sound, first sound and memory pressure remain before
activation. The ordinary queue's simulated response-loss restart is narrower
than a coherent operational restore/rollback rehearsal. The dedicated stopped-
writer prepared-job repair tool still refuses compact inventories and needs a
compatible follow-up. No old ledger may be rewritten or restored to obtain a
new slot. A future exact trial needs its own source, concrete budget, compatible
deployment and operational review. Modeled block/wave reductions are not an ETA
or a live speedup.
