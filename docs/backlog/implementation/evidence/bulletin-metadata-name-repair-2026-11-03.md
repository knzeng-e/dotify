# Bounded artist-name repair: implementation candidate — 2026-11-03

Refs W33/#288. Base: merged #381, tested dev
`c3ee049c0588879f0d0ccd855649d5581e9ad097` ([green CI](https://github.com/knzeng-e/dotify/actions/runs/41575309558)).
[ADR 0045](../../../adr/0045-bounded-metadata-name-repair.md) defines the exception;
[the runbook](../../../operations/bulletin-public-assets.md#exact-artist-name-repair)
defines activation and rollback.

## Delivered boundary

The maintenance-only inspection/admission command prepares one exact additional
metadata graph, changing only `Unknown artist` to the owner-selected name. Its
plan binds old/new roots, original manifest, immutable profile/policy, exact new
cap and all account/inventory state. Admission adds an exclusive durable permit,
not a storage transaction, counter reset or mutation of the first manifest.
Existing custody publishes only those approved bytes through the same account
journal and normal artist-authenticated upload path. Both metadata graphs remain
in the renewal inventory. Existing audio and cover bytes are reused.

The publisher lease is moved unchanged into a small shared module; its prior
export remains available to the prepared-audio recovery command. There is no
public maintenance endpoint, new signer, environment variable, subscription or
frontend secret. Artist identity, payment and protected-key authority are not
changed. A contract selector/RPC failure is not interpreted as absence.

## Verification

The new tests use actual private-file inventories, graph building and the normal
publication transport with synthetic receipts; no test signs or sends to Bulletin.
They cover inspection without persistent changes; exact admission; preserved
old bytes/receipts; timestamp-only retry; exact new attempted-byte cap; both
renewal obligations; restart; mismatched metadata; registration/authority denial;
stale nonce plans; lease/writer barriers; unknown broadcasts; lost acknowledgements
without duplicate stores; tampered and missing permits; and no second admission.
Canonical-check tests pin finalized/latest block hashes, refusing registered,
remapped, wrong-chain and unreachable states.

A separate **read-only** real RPC preflight of the known artist/runtime/content
confirms both canonical directory mapping and unregistered state on finalized and
latest blocks, including support for the exact EIP-1898 requests. It opens no
signer. This is a dated observation, not the later maintenance plan or a wallet
reservation. The previously reconstructed public-manifest correction is two
blocks / 1,101 bytes; no live metadata repair is admitted or uploaded here.

Build and TypeScript checks pass on Node 22. The two read-only ABI fragments
are generated from 32 successfully compiled Solidity files; the Dev CI drift
guard now also checks API bindings. Frontend generated output is unchanged. The sandboxed full API run passes
321 tests and has two `listen EPERM` failures for its existing IPv4/IPv6 HTTP tests;
the full run with local-socket permission passes **323 tests / 42 suites**.
Changed-file formatting, backlog consistency, documentation links and diff
checks also pass. No frontend or contract runtime code changes.

## Remaining gates

Review/merge, green CI and a concrete deployment/backup/maintenance package must
precede a new owner-approved budget. Admission and the two metadata stores are
separate actions. Preserve all existing ready media, keys, queue attempts, receipts,
nonce history and original budgets. The frontend #381 name guard is merged but
still needs its normal Web/Product rollout before the simplified Details repair
is available on the deployed app. No deployment or signature occurs in this PR.

W33 remains open for repaired real-wallet registration, protected Web/physical
Host acceptance, measured publication cost/startup, dependency conservation,
bounded renewal and coherent off-volume recovery. Capacity stays deferred.
