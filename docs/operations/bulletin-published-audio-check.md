# Authenticate a published audio backup

Use this offline operator command after [capturing the published graph](bulletin-published-archive.md)
and recovering content keys separately. It proves that those keys authenticate
the expected original and every rendition object. It does not export playable
audio, open a media endpoint or restart custody. The implementation is a code
candidate; generated tests do not establish real independent recovery.

## Prepare the trust inputs

Use the reviewed compiled API on maintained Node 22, preferably the isolated
Docker recovery route. Keep the archive read-only and keys on private encrypted
storage or a private temporary memory filesystem. Disable network access at the
container/OS boundary; the command itself has no network reader or fallback.

Create a small JSON plan **outside the archive**. It contains these exact fields:

```json
{
  "schema": "dotify.bulletin.published-audio-check.v1",
  "archiveManifestSha256": "TRUSTED_64_LOWERCASE_HEX",
  "registeredReference": "EXACT_REGISTERED_STREAMING_REFERENCE",
  "scope": {
    "chainId": 420420417,
    "runtimeAddress": "EXACT_LOWERCASE_H160",
    "contentHash": "EXACT_LOWERCASE_CONTENT_HASH",
    "keyVersion": "dotify-content-key-v3"
  },
  "masterSha256": "TRUSTED_64_LOWERCASE_HEX"
}
```

The placeholders are not executable inputs. Obtain the reference and scope from
the independently reviewed release/registration record, the archive digest from
its separately retained capture receipt, and the master commitment from the
trusted original key-domain record. Do not generate these expectations from the
archive being checked or substitute a digest computed from an untrusted key copy.
This command compares supplied expectations; it never queries registration.

Retain the plan's SHA-256 separately from the plan/archive. That expected digest
is a trust input, not a signature or proof of where the plan came from. A wrong
trusted plan can still describe a different valid release.

Use the existing [recovered-key envelope](bulletin-recovered-key-check.md) in a
separate explicit file. The key file and plan must be distinct and outside the
archive. Canonical absolute paths, UID ownership, private 0700 parent directories,
0600 files and single-link regular files are required. Symlinks and aliases
refuse. There is no application environment, vault, signer or HTTP fallback.
Keeping keys outside the archive does not by itself prove independent custody.

## Run offline

From `services/api`, after building:

```sh
node dist/scripts/authenticatePublishedBulletin.js /PRIVATE/archive /PRIVATE/plan.json EXPECTED_PLAN_SHA256 /PRIVATE-SEPARATE/keys.json
```

All four arguments are required. Only paths and an expected non-secret digest
are passed as arguments; never put key bytes in the command line or chat.
The command reads the full archive before authentication and again afterwards.
It verifies the private plan's expected digest, the reference/root/key version,
the recovered master's commitment and the authenticated manifest's release scope.
The original is decrypted only in memory, its content hash compared, then each
rendition's initialization and media objects authenticated. Buffers are cleared
on completion where possible; JavaScript strings/runtime copies are not a
guaranteed memory-erasure boundary. No plaintext/key files are written.

Standard and compact references select their existing distinct rendition readers.
Only this offline command uses a separate constant `archive/master.bin` reader;
the ordinary media path still rejects original-archive requests.

| Bound                           | Limit                                                         |
| ------------------------------- | ------------------------------------------------------------- |
| Trust plan / recovered-key file | 64 KiB each                                                   |
| Recovered envelope              | 1–64 versions; 32–512 bytes per secret, within the file limit |
| Original plaintext              | 50 MiB; encrypted length adds 16 bytes                        |
| Original traversal              | 2,048 reads; depth 8; encrypted length + 64 KiB fetched       |
| Authentication reads            | 32,768 reads; 4 × the 134-MiB graph limit                     |
| Deadline                        | Six minutes, including the archive rechecks                   |

The existing [graph bounds](bulletin-published-archive.md#capture-explicitly) and
authenticated streaming-manifest bounds also apply. This is offline recovery,
not hosted playback or a claim that every provider fits a particular memory limit.

## Interpret the result

Success reports the plan/archive digests, layout, original byte count and number
of authenticated encrypted objects. `ciphertextAuthenticated`,
`originalContentHashVerified` and `expectedReferenceMatched` are true. This
includes the published original once, not an invented pruned `source.bin`.

Registration, canonical history, storage independence, key-backup provenance,
decoded/audible sound, service startup and writer activation remain **false**.
Preserve the [custody checkpoint](bulletin-custody-checkpoint.md) and its original
nonce/admission/receipt history separately. This success is not permission to
restart a publisher or evidence that a microphone/speaker/locked phone works.

A refusal exits 1 with fixed `BULLETIN_PUBLISHED_AUDIO_STOPPED` text. It omits
paths, keys, roots and raw exceptions. Preserve the inputs; inspect them privately
against the trusted receipts. Missing data is not fetched, repaired or republished.
Real music/key capture, transfer or maintenance needs its reviewed operational
agreement; merging the code authorizes none of those actions.

Sources: [authentication](../../services/api/src/services/bulletinPublishedAudio.ts),
[original reader](../../services/api/src/services/bulletinArchivedMaster.ts),
[tests](../../services/api/src/services/bulletinPublishedAudio.test.ts),
[backlog scope](../backlog/bulletin-published-audio-authentication.md).
