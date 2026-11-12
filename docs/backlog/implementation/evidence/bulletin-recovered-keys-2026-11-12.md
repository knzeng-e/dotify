# Offline recovered-key check — 2026-11-12

## Artifact and boundary

Production source: `73a631d2`, followed by generated macOS staging correction
`8b6c714f22ac7524f2609c7ba4ecb3ed230dd71a`. Base merged dev:
`1a6b22d49679a4af4c9156f3229e69c754fcd0be` (#443). Its `538fe53b` tree is
identical to the fully tested #443 candidate; merged-dev integration was still
running when this branch started. The source suite uses locked Node 22 dependencies.

The [operator procedure](../../../operations/bulletin-recovered-key-check.md)
owns the command, private key-envelope schema, limits and second-computer gates.
This evidence concerns **generated keys/ciphertext only**. The selected future
recovery target is another Mac with Docker; nothing was transferred there.

## Local observations

| Check                           | Observation                                                                                                                                                                                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API suite                       | **530 tests / 43 suites pass**, no failures/skips, 180.30 seconds on macOS arm64 / Node 22.13.1, with loopback access for existing HTTP tests.                                                                                                                                       |
| Focused recovery + key contract | Nine recovery cases plus three existing key-custody cases pass. The existing direct-HKDF vector preserves exact derivation and identity/version behavior.                                                                                                                            |
| Typecheck / production build    | Pass. The separate CLI's compiled local dependency graph has 22 modules and no app config, keyVault, index/service, queue startup, publication-store or transport module.                                                                                                            |
| Compiled five-mode rehearsal    | Standard and compact capture/reconstruct/readback pass after original source loss, with an explicitly supplied public key outside each artifact. Key readback authenticates 14 objects per layout (source plus 13 output objects) in both restore and read-only verification phases. |
| Documentation / workflow        | Local links/anchors, whitespace, offline backlog and YAML checks pass; exact link count and container/CI observations are recorded on the PR when complete.                                                                                                                          |

The cryptographic check supplies a private-shaped synthetic key envelope rather
than reading environment/vault defaults. It checks the fresh-master commitment,
actual-key source/output reservation filenames, original source/archive hashes,
manifest authentication and every retained AES-GCM object. Guarded files remain
byte-identical before/after; original custody paths and the input checkpoint are
absent. Output contains counts/version names/digest, never a key, source identity,
private path or plaintext. Activation/history/independence/key-origin/service flags
remain false.

Missing/wrong/unsupported keys, unsafe files, links, state/key overlap and missing
key files refuse; even an explicitly populated ambient `CONTENT_KEY_*` cannot
repair the latter. The CLI emits only its fixed error. Internally hash-consistent
corruption of source, manifest tag or a late playback object passes keyless
reconstruction but fails key readback. An output reservation moved under a wrong
fingerprint similarly passes keyless state checks and fails actual-key checking.
Normal eight-day ready pruning yields zero authenticated objects and explicit
partial/pruned coverage; no ciphertext is fabricated or complete audio recovery
claimed. Cancellation refuses without writes.

## Generated container and independent-runner acceptance

The existing [backup workflow](../../../../.github/workflows/bulletin-backup-restore.yml)
now invokes the compiled key checker for both layouts and phases in its fresh
consumer. An explicit public key is staged outside the artifact in private
container temporary memory. The generic reconstruction still reports no
ciphertext authentication; the separate key-check report authenticates 14 objects
and keeps real-key origin/history/service flags false. The consumer also checks
the compiled local import graph for operational modules. No real key is uploaded
to Actions or added to the production image.

The native Linux fresh-runner and local Docker results are pending at this dated
checkpoint, to be bound to the PR head after completion. Local native CLI success
alone is not container/independent-storage acceptance.

## Remaining acceptance

The copied input and temporary reconstructed buffers are bounded, but this is
not secure erasure of JavaScript/crypto memory, an audible codec/device test or a
kernel sandbox supplied by the CLI. The ordinary service's key-authority and
scope checks remain in place; moving the existing HKDF primitive to a pure module
adds no key-delivery endpoint or authority bypass.

Independent encrypted data transfer, separately recovered real key provenance,
current canonical account/receipt history and service/image rollback remain
unaccepted. Missing already-pruned media requires separately verified remote or
retained copies. Physical Host/Room/background, first sound, hosted capacity and
separately authorized publication latency remain #407 gates.

No live private inspection, artist file, real secret, Fly access, registry push,
service restart, key/admission/quota mutation, Bulletin/DotNS operation, renewal or
deployment occurs. Web/Product/public APIs remain 0.1.82 and custody #426.
