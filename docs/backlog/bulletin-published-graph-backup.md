# Back up published Bulletin graphs after custody pruning

Issue: [#451](https://github.com/knzeng-e/dotify/issues/451) · Parent: [#407](https://github.com/knzeng-e/dotify/issues/407)
P1 · Production spine · Now · Work. Project 5 owns workflow status.

## Problem and boundary

Successful publication permits temporary queue ciphertext to be pruned. A
custody checkpoint preserves original history but may then contain no audio.
Do not recreate those old files or call a metadata-only reconstruction an audio
backup. Capture the immutable published graph as a separate private artifact.

## Scope

Starting at one explicit trusted Bulletin root, copy every reachable block,
including archive data, with content-address, count, depth and byte checks.
Provide exclusive private filesystem output, incomplete-artifact refusal,
cancellation and independent offline verification against a separately retained
manifest digest. Use existing codecs/private-file guards. Keep capture transport
explicit and read-only; verification must not contact the network.

No new media API route, key delivery, master/signer loading, state repair,
publication, renewal or custody startup. Graph integrity proves neither audio
authentication nor availability, canonical history or independent key provenance.
Missing published blocks fail; no replacement publication is implicit.

## Acceptance

- Generated standard and compact graphs, including archive blocks, survive
  removal of the source and verify offline against the same trusted digest.
- Missing/changed/unreachable blocks, links/unsafe file modes, wrong digests,
  unsupported/over-budget/deep graphs, failures and cancellation refuse.
- Existing destinations remain unchanged; interrupted capture is visibly
  incomplete and cannot be verified as a committed archive.
- No signer/key/config/service import or ordinary listening behavior changes.
- CLI, operator procedure and reports keep graph versus custody/key duties clear.

## Remaining public-pilot gates

This ticket adds data capture/verification only. Follow-up authenticates published
archive audio using separately recovered keys and binds it to the immutable
release reference. Real capture/key transfer needs a new bounded agreement.
#407 also retains current canonical history/service-image rollback, hosted
capacity, physical listening and actual publication latency. #395 → #388 → CASH
keep their order. No live operation is authorized by this implementation.
