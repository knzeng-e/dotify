# Check recovered Bulletin content keys offline

This how-to helps an operator prove that **explicitly recovered content keys**
can authenticate the encrypted audio retained in a guarded reconstruction.
It complements [data reconstruction](bulletin-isolated-restore.md); it does not
export keys, transfer backups, recover missing remote objects or activate custody.
The implementation is a #407 candidate. Only generated state has been exercised;
[source-bound evidence](../backlog/implementation/evidence/bulletin-recovered-keys-2026-11-12.md)
records what actually passed and what remains unaccepted.

## Prepare the two inputs

Use the reviewed compiled API revision, Node 22 and the owning filesystem UID.
Keep the checkpoint's original manifest digest separately, as required by the
[capture procedure](bulletin-custody-checkpoint.md#verify-independently-retained-data).
First reconstruct and verify the data in a new private workspace. Do not rename
its `.checkpoint` files or remove its publication-refusal barriers.

Recover content masters through a **separate private channel**, into a private
regular file outside the workspace and all saved source paths. Its parent must
be a canonical absolute directory owned by the invoking UID, mode `0700` or
stricter; the file must be single-link, mode `0600` or stricter. The known original
signer path is explicitly refused. Do not put a wallet phrase, signing key,
production environment file or API/session secrets in this input.

The JSON envelope is an offline interchange format, not an app environment:

```json
{
  "schema": "dotify.content-key-recovery.v1",
  "masters": {
    "dotify-content-key-v3": "<recovered master as hex, without 0x>"
  }
}
```

The placeholder is intentionally invalid. Never paste real values into commands,
chat, issues, logs, fixtures or CI artifacts. Supply **every version reported by
that checkpoint**, retaining old versions rather than rotating them for the test.
The file is bounded at 64 KiB and 64 versions; each value is 32–512 bytes of hex.
Unsupported versions, malformed JSON/hex, links and unsafe permissions refuse.
A missing input never falls back to `CONTENT_KEY_*`, a `.env` file or a live vault.

## Authenticate the retained files

From the reviewed build's `services/api`, in the private review environment:

```sh
node dist/scripts/verifyRecoveredBulletinKeys.js /PRIVATE/review-copy EXPECTED_MANIFEST_SHA256 /PRIVATE/recovered-keys/versions.json
```

The command rechecks the guarded tree and trusted digest before reading the key
file. It checks the fresh-domain master commitment, derives keys with the same
HKDF primitive as ordinary key delivery, and binds each audio inventory's output
nonce reservation to that key's actual fingerprint. A retained queued source must
also have its source reservation under that fingerprint.

For each retained audio folder, it authenticates/decrypts `source.bin`, the
manifest and every archive/init/media object. Both source and archive plaintext
must match the original content hash. Encrypted bytes are size/hash checked
against the original checkpoint on the same descriptor read, before decryption.
The complete guarded workspace is verified again afterwards. There is no queue,
signer, transport, HTTP service or network client startup, and no write to either
input. No plaintext file or content key is returned.

The keyless checkpoint/reconstruction commands keep `ciphertextAuthenticated:
false`. This separate command reports authentication counts. It does not change
the artifact or its original false activation/history/independence flags.

## Interpret the report

| Field                                                                                                                                           | Meaning                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `requiredVersionsPresent`                                                                                                                       | All checkpoint-required version names had supplied masters; presence alone does not prove an unused master.                                        |
| `authenticatedKeyVersions`                                                                                                                      | Versions for which retained source, manifest and all output objects were authenticated.                                                            |
| `authenticatedObjects`                                                                                                                          | Source plus archive/init/media objects successfully checked; the manifest is authenticated separately.                                             |
| `retainedAudioInventories` / `prunedAudioInventories`                                                                                           | Inventories with complete retained folders versus histories whose ciphertext was already pruned.                                                   |
| `nonceReservationsChecked`                                                                                                                      | Output reservations for audio inventories, plus source reservations where queue entries remain, under each actual derived-key fingerprint.         |
| `ciphertextAuthenticated`                                                                                                                       | At least one retained audio folder authenticated; **not** proof all released audio is locally recoverable.                                         |
| `allAudioCiphertextRetained`                                                                                                                    | At least one audio inventory exists and none has pruned ciphertext. This is local availability, not remote retention or audible/device acceptance. |
| `writerActivationAllowed`, `canonicalHistoryChecked`, `independentStorageVerified`, `keyBackupOriginVerified`, `signerLoaded`, `serviceStarted` | Always false. A successful local command establishes none of these operational claims.                                                             |

Pruned audio history can pass its commitment/reservation checks with zero
objects authenticated and both ciphertext/availability flags false. Do not call
that a successful audio recovery. Remote retrieval or another retained encrypted
copy is a separate gate. Public covers/metadata are hash/state checked by the
underlying reconstruction; they are not encrypted audio and add no cipher count.

On any error the CLI returns exit `1` and a fixed
`BULLETIN_RECOVERED_KEYS_STOPPED` message, without paths, raw exceptions or key
material. Keep the guarded workspace unchanged and investigate privately. There
is no retry, repair, refund, reservation creation or publication capability.
The command has a six-minute cooperative deadline and reads one encrypted object
at a time, at most 50 MiB plus its authentication tag; its buffers and decoded
plaintext have a corresponding memory cost. Secret/plaintext buffers are cleared
when available, but JavaScript/crypto copies cannot be reliably erased. Use a
short-lived private process/container; disabling network and limiting mounts are
operator-enforced boundaries, not a sandbox provided by this CLI.

## Prepare the real second-computer rehearsal

The selected destination is **another Mac with Docker**. That is a preparation
choice, not evidence of independent storage or an authorization to export data.
Before any live read/maintenance/transfer, complete one private review record:

1. Pin the source revision/image and active domain, owning UID, queue/profile/
   publisher paths and required key versions. Record only scoped hashes/counts in
   shareable evidence. Arrange stopped-writer capture and supervisor control using
   the existing capture runbook; retain every historical intent/receipt/reservation.
2. Name the second Mac and private encrypted destination, encrypted transfer
   method, recipient identity and retention/cleanup plan. Keep the expected
   manifest digest outside the transferred data. A Fly snapshot or a second
   folder on the source Mac alone does not satisfy independence.
3. Name the separate key-recovery channel and its custodian. Never bundle raw
   masters with the data checkpoint or use a signing seed as a content backup.
   Readback here needs no signing key. Signing-key recovery remains a distinct
   operational custody duty before any future writer reactivation.
4. Build/verify the exact reader executable separately from the data. On the
   destination, use Node 22 as the owning Mac UID, or an explicitly reviewed Docker
   staging layout. Docker Desktop may expose bind ownership as root: **do not**
   weaken file checks or run the reader as root to evade them. The generated
   container acceptance uses owned Linux data and an explicit public key in
   temporary memory; it does not supply a real-key transfer/staging command.
5. On the destination without access to the source service, run data verification,
   guarded reconstruction and this key check. Record actual counts and pruned
   coverage. Compare checkpoint/account/receipt history to an independently
   captured current canonical head before considering any operational restoration.
   An old valid digest cannot prove no newer broadcast occurred.

**Exit criterion:** the selected real retained release authenticates on the
second computer using separately recovered masters, while hashes/history and
publication barriers remain unchanged. Document missing media/version coverage,
key provenance and data independence separately. No service is activated.
Service/image rollback, policy-enforced key delivery, physical audible playback,
hosted capacity and live publication latency remain separate #407 gates.

Source: [key checker](../../services/api/src/services/bulletinRecoveredKeys.ts),
[CLI](../../services/api/src/scripts/verifyRecoveredBulletinKeys.ts), and
[generated independent-runner acceptance](bulletin-isolated-restore.md#generated-independent-runner-acceptance).
