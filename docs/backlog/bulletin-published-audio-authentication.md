# Authenticate published Bulletin audio offline

Issue: [#453](https://github.com/knzeng-e/dotify/issues/453) · Parent: [#407](https://github.com/knzeng-e/dotify/issues/407)
P1 · Production spine · Now · Work. Project 5 owns workflow status.

## Problem and boundary

The [published-data archive](bulletin-published-graph-backup.md) preserves content
after temporary custody ciphertext is pruned. Its CID checks prove intact graph
bytes, not that separately recovered keys decrypt the expected artist release.
Add a separate offline authentication command; do not recreate old queue files.

## Scope

An explicit private trust plan binds the archive digest, registered streaming
reference, release scope and content-master commitment. Its own expected digest
is retained separately. Load only an explicit private recovered-key envelope,
using the existing version/size grammar. Verify the manifest, original audio
content hash and every rendition object in standard and compact layouts.

Keep original reconstruction bounded to 50 MiB plus its authentication tag,
with count, byte and depth limits. Do not expand ordinary playback/archive paths.
Recheck the artifact and private inputs before reporting success. No plaintext,
key or signer export, configuration fallback, network, state repair or startup.

## Acceptance

- Generated standard/compact archives authenticate after source/producer loss;
  original content hash and every encrypted object match the explicit scope.
- Wrong digests, reference/root/layout, scope, key/version/commitment, damaged
  authentication tags, unsafe files and cancellation refuse without mutation.
- The recovery-only reader handles the original-size maximum and refuses
  malformed/over-budget/deep UnixFS data; public media still denies originals.
- CLI errors reveal no private input; operator guide distinguishes expected
  reference matching from verified registration, key provenance, canonical
  history, independent storage, decoded sound and writer authority.

## Remaining public-pilot gates

This is code and generated evidence only. Real graph capture, independent key
transfer, canonical history and writer/image recovery require their own concrete
operational scope. Hosted capacity, physical Web/Host/background listening,
publication latency and the selected #395 → #388 → CASH sequence remain open.
