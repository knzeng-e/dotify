# Private protected Bulletin canary preparation, 2026-11-01

**A generated encrypted package and operator commands are prepared locally;
no new storage or signing occurred.** Refs #288 / #287. Source is
`e1ea30f340e10d6204846c865c5a21fb9a420af0`, from green `dev`
`9b253d2d8546153a1bad75ab90fa3b0b2264eede` after #368 (CI run
[41246280086](https://github.com/knzeng-e/dotify/actions/runs/41246280086)).
See [ADR 0041](../../../adr/0041-private-bulletin-canary-package.md) and the
[operator runbook](../../../operations/bulletin-protected-canary.md).

## Prepared artifact, not write authorization

| Item | Local result |
| --- | --- |
| Input | Fixed generated eight-second chord; no artist recording |
| Format | Real v3 encoder, 96 / 160 / 320 kbps AAC, HKDF-derived private key |
| Root | `bafykbzacec2bpys6cfd23kbnvg4p7fidf6laimhd5afshs32sgilt74gkybhw` |
| Maximum new stores | 16 |
| Maximum uploaded bytes | 713,229 |
| New renewal reserve | 16 transactions / 713,229 bytes; not submitted |
| Earlier reserve preserved | 91 transactions / conservative 20 MiB renewable bytes |
| Approval digest | `c1dbb79cec39fd5e7aaac812de493439c4931aa2d5b28a6a100db73f603cf440` |
| Local backup | Seven private files, checksum verified; inspection-only |
| Runtime registration / key distribution | None |
| Stores / renewals / signer / DotNS changes | None |

The review candidate is at `/private/tmp/dotify-protected-candidate-e1ea30f3/`;
its private inspection backup is `/private/tmp/dotify-protected-backup-e1ea30f3/`.
Neither directory belongs in Git or Bulletin. Temporary local copies are not
durable disaster-recovery storage. Before signing, move the exact custody to a
reviewed persistent private location and protect a coherent backup independently;
this local result does not claim that operational gate is fulfilled.

Preparation ran from the committed source through the credential-isolating
launcher. It authenticated every encrypted object, checked the generated master,
reconstructed the full graph and bound nonce custody and allowances to the plan.
The same package can be loaded without encoding/encrypting again. A new prepare
uses fresh custody and produces a different root; no byte-identical regeneration
claim is made. The private secret is absent from review metadata and uploaded
files. The `fixture.publicKey: false` field denotes that the **content encryption
key** is not distributed; the storage account address remains public.

## Read-only network observation

The actual bounded WebSocket/PAPI composition passed `check` at finalized head
**1,450,677**, account nonce **1,030**, authorization expiry **1,621,405**.
After subtracting the fixed earlier reserve, it exposed 50 transaction slots,
47,848,040 storage bytes and 41,072,542 renewable bytes, covering the proposed
16 stores plus 16 new renewal slots. Raw transaction allowance was 141; raw
renewable bytes were 62,044,062. This is a dated observation, not reserved
capacity or permission to write. Recheck immediately before any approved run.
No CID lookup, upload, content key, signer or store was needed for this check.

## Automated verification

- **6 private-canary checks pass:** real generated AAC preparation, exact local
  budget, private-secret exclusion, full snapshot checksums, interrupted/readonly
  backup refusal, permanent generation collision refusal after copying custody,
  all-three-rendition FFmpeg decode, quota floors and missing/tampered state.
  A new store instance reconciles a lost acknowledgement, continues unchanged
  ciphertext and ends with exactly one store per block over a model transport.
  A fresh isolated launcher ignores inherited fake deployment credentials.
- **30 pipeline/transport checks pass:** explicit nonce observation, direct
  sender/receipt identity, bounded parallel admission, abort/disposal and
  cumulative allowances retain their existing regressions.
- **8 protected-access rehearsal checks pass:** real signatures/canonical access
  decisions continue to allow/deny keys correctly over simulated runtime/storage.
- The private-canary suite includes a real loopback response larger than 20 MiB,
  split across frames: the selected `ws` client rejects it before delivering any
  JSON-RPC message. The package directly declares the same already locked
  `ws` 8.22.0; no resolved package version was upgraded.

The three test commands are `test:protected-canary`, `test:pipeline` and
`test:protected` in `research/bulletin-prototype`. CI now runs the new isolated
suite. The API implementation and deployed app composition did not change.

## Failure and persistence boundary

`publish` requires the exact reviewed digest, source compatibility, a verified
private backup, exclusive account use and an explicit signer descriptor. It
checks network/quota before reading the signer; existing pending intents must
first be resolved by `reconcile`. Only `publish` can construct a writer.
Read-side commands reject signer input; reconciliation may persist local
receipts, but its transport cannot store missing blocks. Every attempt remains
charged to the original durable allowance.

Snapshots receive an inspection marker before copying the first custody file.
They cannot be opened as writer packages, even when interrupted. There is no
automatic mutable-state restore: older nonce cursors must not conceal newer or
uncertain submissions. Missing journals, account/cursor mismatch, replaced
receipt pointers or a crash lock require review, not directory recreation,
lock expiry or blind retry. A same-disk copy only rehearses custody recovery.

## Remaining gates

Review the source and obtain green CI, durable custody and fresh explicit owner
approval of this exact network budget. Then run the signed storage canary and
fresh readback with retained receipt evidence. The generated scope is a model
runtime; real on-chain registration, canonical wallet-signed key delivery and
protected Web/Host listening remain separate acceptance steps. Representative
release upload costs, background/uncached recovery, recurring retention and
production provider selection remain open. No speed, cost, artist-access or
physical-playback improvement is claimed by this preparation.
