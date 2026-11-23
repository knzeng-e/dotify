# Check one Product artist before onboarding

For operators preparing #317, this read-only source candidate checks the chosen
Product account against the fresh deployment and exact CDM snapshot. It does
not open artist publication or replace the full deployment attestation.

## Run the bounded check

Use the intended public key from the accepted account report, never a private
key, seed or infrastructure publisher. From a reviewed checkout:

```sh
cd web
npm run test:artist-prerequisites
npm run check:artist-prerequisites -- \
  --public-key <public-32-byte-hex-key> \
  --native-ws <public-wss-asset-hub-endpoint> \
  --evm-http <public-https-asset-hub-endpoint>
```

Endpoints must have no credentials, query or fragment. Both are trusted RPCs;
this is not a light-client proof. No signer, wallet prompt, submission, storage
write or hosted configuration change is used. Output goes to stdout; retain it
privately because it includes public artist/runtime addresses. The report omits
the raw public key, native mapping address, balance and provider error payloads.
Its account fingerprint is SHA-256 of the public key bytes.

The command records source/clean state and hashes of the deployment and CDM
files. A dirty report is useful for local diagnosis, not frozen-source delivery
evidence. The 60-second overall deadline stops further reads; EVM calls have
10-second timeouts without retries. Failure prints a sanitized message and exits
nonzero without emitting a successful report.

## Interpret the result

The reader selects one finalized native block, verifies the Paseo Asset Hub
genesis and the existing `Revive.OriginalAccount` mapping, and requires the EVM
provider to return that same block number/hash on chain 420420417. Providers that
cannot supply matching canonical references are refused. All contract/code/CDM
reads are pinned to this explicit block. Missing mapping is a failure, with no
padded fallback or automatic mapping registration.

It checks all seven factory facet bindings, initializer/directory pairing,
native precision, nonempty code at all ten core addresses, and both exact CDM
address/version pairs. Code hashes are observations, **not** comparisons with
reviewed compiler output. Run the separate
[fresh-generation readback](prepare-fresh-testnet-generation.md#complete-the-deployment-record-before-changing-active-references)
for reviewed bytecodes and complete core attestation.

| State | Meaning at the recorded block | Approval count reported |
| --- | --- | --- |
| `absent` | No registered or pending runtime for this artist; stage is zero | 8: creation plus seven installation/finalization calls |
| `pending` | A nonzero pending runtime with stage 1–7 and no registered runtime | `8 - completedStage` |
| `registered` | Directory runtime exists; no pending runtime and stage zero | 0 bootstrap calls |

The count explains the observed state; it is not a signing plan or authorization.
Conflicting state, unsupported stages, missing runtime code or any failed read
refuses the report. Native-created pending runtimes are found by factory state,
without relying on `eth_getLogs` visibility. A registered address does not prove
its current artist/administrator, installed selectors or media readiness.

## Keep the remaining gates separate

This is selected-artist discovery only: `globalPendingDiscoveryComplete`,
`reviewedBytecodeVerified`, `runtimeAuthorityVerified`, `signerControlVerified`
and `publicationEnabled` remain false. It must not populate the checked-in
publication attestation or lift quarantine. Full native-aware global discovery,
reviewed factory attestation and an identified signer-control client remain
before artist approvals. The [fresh-generation procedure](prepare-fresh-testnet-generation.md)
owns later key/profile, services and client activation. #85/#317 and physical
value/media acceptance remain open; CASH stays disabled.

Implementation: `web/scripts/artist-onboarding-prerequisites.mjs` contains the
state checks; `web/scripts/check-artist-onboarding.mjs` connects the installed
SDK/PAPI and generated CDM ABIs. Deterministic tests exercise absent, pending and
registered artists plus mapping, block, binding, code, CDM and state failures.
These fixtures are not live-chain or physical Host acceptance.
