# Isolated checkpoint reconstruction — 2026-11-12

## Artifact and scope

Implementation: `6c7b50021a693a711a043737bca63c3e3d57c91d`
(initial extraction/refactor `a3afb4102014e995e7e6331e8b823a10c609945d`), from tested merged dev
`4565cc29f81634485b2fbfce86da4b0c381d963e` (#442). The follow-up makes refusal directory entries durable before ordinary data and
adds real publication-store factory refusal tests. Generated transfer/container harness: `63c64880`
(the production TypeScript remains at `6c7b5002`). Documentation-only commits
do not change those sources. All three merged-dev integration
workflows were green before the branch started.

Scope: #407, one active settled multi-release domain, generated state only.
The [runbook](../../../operations/bulletin-isolated-restore.md) owns commands,
limits and operational refusal handling; [ADR 0057](../../../adr/0057-isolated-checkpoint-reconstruction.md)
explains the guarded layout and shared validator. The
[selected sequence](../listening-and-publication-readiness.md) keeps real data/key
and service/image recovery ahead of compact activation, then Room/artwork/CASH.

## Local validation

Node 22.13.1 / macOS arm64, locked API dependencies. All state and encrypted
objects are generated temporary fixtures; injected publication transport uses no
chain. CLI children receive only `PATH`, without application config or secrets.

| Check                             | Observation                                                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Complete API suite                | **521 tests / 43 suites pass**, no failures or skips; 171.13 seconds.                                                      |
| Typecheck / production build      | Pass; the CLI is compiled, generated fixtures/tests remain excluded.                                                       |
| Capture/reconstruction coverage   | Existing eleven checkpoint cases plus eight reconstruction cases; full-suite results are bound to the tested source below. |
| Formatting / whitespace / backlog | Pass.                                                                                                                      |
| Links and anchors                 | **393 local links/anchors pass** in the changed Markdown documents; the added public-page link resolves.                   |

## Observed recovery and refusal boundaries

For both standard and compact layouts, capture a ready fixture, delete its entire
original domain (including profile and synthetic key sentinels), then reconstruct
the saved files elsewhere. Every original logical byte matches, original files
are private and single-link, and signer/master sentinels are absent. Delete the
input hashed-object checkpoint too: `verify-restored` still succeeds with the
separately retained original manifest digest.

Outside the production reconstruction command, tests supply the public fixture
key explicitly. They authenticate the recovered manifest, decrypt the archive and
all twelve playback objects, compare the expected structural plaintext and verify
both source/output reservations under that key's actual fingerprint. The command's
`ciphertextAuthenticated` flag stays false: it never reads a content key.

Real queue startup and eight-day retention also produce pruned ready fixtures.
Reconstruction preserves their zero queued jobs, permanent inventory, receipts,
counters and nonce files; it does not invent missing ciphertext. Existing #442
regressions continue to reject missing output reservations after either kind of
pruning through the shared state validator.

The normal publication-binding contract rejects the recovered queue with the
original Bulletin profile and with no profile/Pinata fallback. An independent
synthetic queue matching relocated settings also rejects the publisher barrier.
The actual publication-store factory also refuses the reconstructed queue and
publisher before injected signer loading or transport opening, including Pinata
fallback. These tests use separate synthetic probe settings; the preserved
original profile is never relocated. No HTTP service or deployed image is started.

Bad digest, oversized logical JSON, existing destination, source/input overlap
and cancellation refuse without changing input or existing data. Output
verification refuses altered bytes, changed refusal barriers, missing empty
directories, links and incomplete markers. A simulated producer rewrites an
inventory owner to active work and recomputes every relevant hash: byte-only
checkpoint verification passes, but reconstruction's shared local validator
refuses, preserves input and leaves only a guarded `INCOMPLETE` workspace.

## Compiled CLI and container rehearsal

The compiled CLI's five modes (`inspect`, `copy`, `verify`, `restore`,
`verify-restored`) pass for both layouts. Standard recovers 27 logical files;
compact recovers 28. Original roots are removed before reconstruction; the input
checkpoint is also removed before the final readback.

The generated-only [harness](../../../../services/api/scripts/rehearse-isolated-checkpoint.mjs)
adds two jobs to the [backup workflow](../../../../.github/workflows/bulletin-backup-restore.yml):
a producer captures public fixtures and removes their originals; a fresh runner
downloads only those checkpoints. Original manifest digests are separate producer
outputs. Actions artifact downloads lose Unix modes, so a shape/count/ownership-
bounded generated-only adapter restores privacy before invoking the unchanged CLI.
It is not an adapter for real private backups.

The consumer locally builds the unchanged production API image and runs the
compiled command as a non-root UID with no network, a read-only root, all
capabilities dropped, no new privileges, 64 PIDs, one CPU and 1 GiB memory/swap
ceiling. Only the fresh destination is writable during reconstruction. A second
container verifies read-only output **without mounting the input checkpoint**.
The harness is bound read-only rather than added to the production image. Both
phases authenticate 13 structural synthetic objects per layout with the explicit
public key, verify original paths absent and publication bindings refused. They
do not start the HTTP service or test real key recovery.

Local macOS Docker Desktop maps private bind directories to root ownership, so
the first non-root bind attempt correctly refused. The local acceptance rerun
used a dedicated generated-only volume, with a one-shot CHOWN-only provisioner
assigning it to UID/GID 1000. Restore passed with the volume writable; verification
passed after deleting its input and mounting the volume read-only. Each process
had the enforced network/root/capability/resource settings above. The temporary
containers and volume were removed. This owner-mapping workaround is local;
Linux CI retains native runner UID/GID checks on binds. Image:
`sha256:fd550e479a8b50b94b3dfb5ed58076486a3dfc02c321f47eed6373707f93da27`.

Workflow YAML and embedded Bash parse locally. Independent GitHub-runner and full
integration results remain to be recorded against the final PR head; the local
container result alone does not claim those checks passed.

## Unaccepted operational gates

The CLI itself supplies filesystem/workflow isolation in private directories,
not a kernel sandbox or protection against a malicious same-UID owner. The
generated container harness separately enforces its kernel/network limits. Both original
and reconstructed metadata remain private; the original profile is preserved
without relocation under a non-service filename. Ordinary bindings are deliberately
invalid. No activation/unseal mode, key installation or source-path restoration
exists.

No artist file, real custody data or secret is read. No Fly access, registry
upload, service restart, Bulletin/DotNS operation, renewal, allowance/quota change,
musical publication or deployment occurs. Recorded delivery stays Web/Product/
public APIs 0.1.82 and custody #426.

The authenticated audio here is structural synthetic data, not audible AAC or a
real artist release. Real independently retained data and usable key recovery,
current canonical history, service/image rollback, physical Host/Room/background,
first sound, hosted memory and separately authorized publication latency remain
#407 gates. A valid old snapshot can omit later broadcasts; it never authorizes
replaying old journals over newer work.
