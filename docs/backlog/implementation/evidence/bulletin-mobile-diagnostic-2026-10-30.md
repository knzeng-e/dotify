# Bulletin mobile diagnostic preparation, 2026-10-30

**Outcome: a separate generated-only diagnostic can be built without exposing
the Desktop loopback key server to a phone. It is not published yet.**

Base `dev`: `3ba973c0e2085d7a68203c0409d18843df28d036`, after #355/#356.
Tested implementation and clean candidate source:
`ca24fd50f1739b9072518d25712cca805b142620`. The accompanying JSON records exact
artifact sizes/hashes and the read-only availability observation.
Refs #288 / #287; neither acceptance issue closes with this preparation.

## Decision and trust boundary

A phone cannot safely use the localhost-only operator key server. The new
`mobile-package.mjs` prepares an independent static Product from the existing
BLAKE2b generated chord. Before copying any test key, it authenticates the v3
manifest/objects, decrypts the local master and compares exact bytes with
`generatedWav()`. A forged “generated” label is rejected. The caller must
explicitly acknowledge that the generated test key becomes public. It refuses
SHA-256 graphs, loose private-key files and an existing output directory.

Only the public generated session identity/key and playback dependencies are
embedded. Archival raw blocks, fixture/operator paths, signing state and nonce
ledgers are not included. No `.env` file, production content-key endpoint,
account signer, upload, payment or contract update is involved. The generated
key is test data, not an access entitlement; this is not an artist publishing
adapter or a proof of production authorization.

`host/player.ts` is the single controller for the existing Desktop harness and
this bundle. Both use the unchanged production streaming player/AEAD verifier.
The native path calls the Host preimage reader. The bundled decoder control
must be selected explicitly and is loaded in a separate chunk; native failure
never tries that chunk, an API, gateway or loopback reader. Host detection is
bounded too. Pause/seek/stop, media events and visibility transitions are
observed. Hiding the page does not stop healthy playback; page exit stops it.
Startup/whole-attempt watchdogs remain 45/60 seconds, subject to OS suspension.

## Evidence that survives the Host

Host file downloads previously failed, leaving a report only in a tab. The
standalone UI keeps up to five reports / 256 KiB in origin-local storage,
with manual inspection and selectable text. New attempts select their own
report; inspecting an older report is preserved during ongoing updates.
Clearing history requires confirmation. Older entries are evicted at the
reported bound; users should retain important evidence separately.

The storage projection permits only bounded diagnostic fields. It excludes
keys, raw bytes, signer material, arbitrary fixture metadata and transport
metrics that are not in the stored schema. Optional device/network notes,
user agent, public CIDs, reader choice, source identity, media/visibility events
and read timing remain. Reports are never automatically transmitted. Check
those notes before sharing. `operatorHeardAudio` is an explicit checkbox;
`playing` never becomes a claim of measured audible startup.

Unfinished preparing/playing records recovered on reload are labeled
interrupted while retaining their last observed state. A blocked/full/corrupt
store warns and continues in page memory, so persistence cannot be promised
if the Host disables storage. An operator killing the process can still lose
changes since the last recorded event. This is a diagnostic notebook, not a
server-side evidence archive or a verified background-playback claim.

## Verification

- **66 Node tests pass:** 38 existing reader/codec checks, 22 pipeline checks
  and six packaging/report checks. New cases cover acknowledgement, BLAKE2b,
  exact generated-master identity (including forged labels), playback-only
  dependency projection, bounded history, corruption, blocked storage,
  interrupted recovery and secret-field exclusion.
- **Seven browser/server checks pass:** six existing Host harness controls plus
  the standalone built bundle at a 390-pixel viewport. The latter plays AAC,
  pauses/seeks, finishes, stops and releases its source, reloads its notebook,
  and refuses native mode outside the Host without loading the decoder control.
  It makes no external HTTP request. This is Chromium evidence, not iPhone proof.
- A full-page mobile screenshot was inspected locally for overflow, hierarchy,
  readable status and keyboard-accessible controls. Backlog/diff checks pass.
- Read-only Bulletin verification at `2026-10-30T16:39:58.074Z` authenticated
  all nine AAC objects at the existing root, with 29 raw reads / 460,656 bytes,
  no remote master fetch and **zero attempted transactions**. Its 3,405-ms
  first-authenticated-object timing is a Node transport observation, not first
  sound, native mobile performance or a paired benchmark.

The candidate root is
`bafykbzacecbgxu5coifnfzajpkwzuaxv36snvjfd4zqsbvpgfk4mx7mhzhtj4`.
The clean local build contains a 375,287-byte entry script and a separately
loaded 610,448-byte decoder-control chunk (14 playback dependency blocks).
These are uncompressed artifact sizes, not network timings. Vite reports the
expected >500-kB lazy control warning and upstream pure-annotation warnings;
neither is suppressed. The native test does not load the control chunk.
Application download time precedes the attempt timer and must be included
separately in any future cold-start comparison.

## Next physical-device gate

1. Review/merge this preparation, choose and explicitly approve a **separate
   diagnostic address**, and verify its pinned deployment/Host profile and
   exact upload budget. No address availability or ownership is assumed. Do not
   overwrite `dotify-test01.dot`, publish a private key server, or use artist keys.
2. Publish only that reviewed diagnostic through the locally activated signer,
   with its exact source/artifact record. This preparation authorizes no upload,
   new storage allowance, renewal, paid service or DotNS modification.
3. On the actual phone, record OS/Host version and network. Run native delivery
   first, confirm hearing separately, retain the report, then run the bundled
   control. Check pause, seek, stop, brief background/screen lock and return.
   Keep all failed attempts. Caches remain unknown unless independently measured.
4. Compare paired native/current-delivery first sound on the same device and
   network before selecting a storage path. The bundled control isolates the
   decoder and is not the current API/Pinata delivery benchmark. An eight-second
   chord cannot establish prolonged listening, renewal or scalable publication.

Production storage, its key/access boundaries and hosting costs are unchanged.
The [runbook](../../../operations/deployment-configuration.md#generated-only-bulletin-mobile-diagnostic-not-deployed)
and [commands](../../../../research/bulletin-prototype/README.md#standalone-mobile-diagnostic-preparation)
record build, publication and rollback boundaries. No physical mobile run or
production replacement is claimed.
