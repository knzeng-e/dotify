# Fresh testnet deployment, 2026-10-21

Issue #317. Authorized by the owner in the implementation session to start the
next streaming test from zero. Core contracts and CDM publication are live;
**the application/service cutover is not deployed**.

## Public identity and evidence

| Field | Observed value |
| --- | --- |
| Chain | Polkadot Hub TestNet / Paseo Asset Hub, `420420417` |
| Publisher/deployer | `0xc3571714248588c6e19cdece2778b75341b2c288` |
| Factory | `0x708d35eee7c1416f6d332344068be9d714aec24c` |
| Directory | `0x8e611ef60169f8ed93019de4a3034a504ae2ad29` |
| Audit | Finalized block `14709581`, hash `0x49339bad43574d98f48c8e87023dc21d7b13e6cf5c8baca5e4721cc9d36e9bfc` |
| Registry facet source hash | `0x59020fa678566611842e12b116e7e83352e89337ba6c5ae51c437c48316cd8d9` |
| Catalog at audit | 0 finalized runtimes, 0 pending; factory/directory pairing and source guard match |
| CDM registry | `0x05662b3dbd5dd9f2ff92d67630477e84b0b37c1f` |
| CDM versions | Both `@dotify/artist-directory` and `@dotify/artist-runtime-factory`: **2** |

The factory, directory, initializer and seven shared pallets are recorded in
[deployments.json](../../deployments.json). All ten passed source verification
on [Blockscout](https://blockscout-testnet.polkadot.io/address/0x708d35eee7c1416f6d332344068be9d714aec24c#code).
The [registry audit](evidence/fresh-contracts-2026-10-21-audit.json) records the
actual finalized source comparison, not a manually asserted boolean.
The [CDM readback](evidence/fresh-contracts-2026-10-21-cdm.json) checks exact
versions at finalized block `14710253`.

The deployment submitted ten contract creations and one factory wiring
transaction. The two subsequent CDM transactions succeeded:

- Directory: `0x7e19cbbff2158586f550cb9944ea3395daea445bafd3fd6a9b62fa83d06a8882`.
- Factory: `0x2fe328154957859132a0c6a192252cbe6ab4c132715d43a365eba10253640ab7`.

No funded tip, access purchase or artist runtime was created as a smoke test.
The public CDM metadata files/CIDs are byte-identical to the prior checked-in
files; no metadata re-upload or new signer was necessary. The hardcoded
Product snapshot version of one was insufficient: generation now takes the
recorded version from `contracts/evm/cdm.json` and rejects stale addresses.
DotNS's registry is separate; the Product executable/DotNS version was not
updated by these CDM transactions.

## Coordinated cutover after review

1. Merge/deploy W30 non-root storage preparation first. Preserve session epoch,
   content-key secrets, revocations and contribution history.
2. Merge the W32 publication code and this configuration. Provision and measure
   its private encoder, initialize a **fresh** streaming custody directory as
   the API user, then configure the dedicated worker token. Follow the W32
   operations procedure supplied by that PR; never erase nonce reservations.
3. During a quiet test window, deploy the API against this exact factory and
   directory. Its read model rejects the old-directory checkpoint and indexes
   the new empty directory. Keep the previous snapshot/volume for rollback.
4. Deploy signaling with `SIGNAL_CONTRIBUTION_DIRECTORY` matching the new
   directory. Publish Web and Product from the same tested configuration.
   Use the committed empty catalog fixture for frozen Product packaging until
   the new API has authoritative releases. A normal bootstrap refresh against
   the old API would reintroduce old tracks.
5. Create the owner's new artist runtime from the application, publish new
   music, and record real Web/Product listening, denial, host/guest and value
   flow acceptance. Local tests and source verification do not establish this.

Read-only preparation helpers:

```sh
npm --prefix contracts/evm run fresh:plan:testnet
npm --prefix contracts/evm run fresh:readback:testnet
```

The first reports artifacts/account/network without submitting; the second
reads the new addresses at finalized CDM versions. Both avoid printing keys.
For a future reset: deploy core contracts, generate CDM metadata, publish the
reviewed CDM updates, record finalized address/version readback and update the
installed `contracts/evm/cdm.json` snapshot, then regenerate Product bindings.

## Rollback and unverified gates

Previous core addresses are retained at tested base `cdf92d8`:
factory `0x835a626a9a6965b197d079ae56b1ec94033c2699`, directory
`0x4e883827d61e573094c7b777bae323070ea9f954`. Their artist runtimes, state,
claims and encrypted files were not changed. To roll clients/services back,
restore their matching configuration/bootstrap and preserve the latest custody
and revocation stores. CDM is append-only: rollback of `latest` requires an
explicitly reviewed new version pointing back to the old addresses; historical
versions are not deleted. Do not change a pinned Product snapshot to `latest`
as a shortcut.

Verified locally: 74 contract tests before deployment, artifact compilation,
source verification, finalized registry audit and CDM address/version readback.
API/Web/Product deployment, new artist onboarding, new live publication,
physical native audio/signing and real funded value-flow tests are **not run**.
