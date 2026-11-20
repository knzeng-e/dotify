# Prepare a coherent fresh testnet generation

Use this procedure for #317 after the owner-selected full redeployment and
merged audit/SDK corrections. It prepares a reviewable deployment and cutover;
source preparation is not evidence that contracts, services or a Product were
delivered. The [configuration reference](../operations/deployment-configuration.md#native-payment-correction-candidate-484)
owns state preservation and native acceptance boundaries.

## Freeze the source and prepare the public plan

Start from current tested `dev`. Run the contract tests and regenerate Web/API
ABIs, Product CDM bindings and candidate metadata from the same compiler output:

```sh
npm --prefix contracts/evm test
npm --prefix contracts/evm run generate:abis
npm --prefix web run generate:cdm
npm --prefix web run generate:cdm-metadata
```

Review and commit generated changes. Generation is local; it does not publish
metadata or update a registry. The retained `deployments.json` and
`contracts/evm/cdm.json` continue to name the earlier deployment until actual new
receipts and finalized registry readback supply new addresses/versions. Candidate
factory metadata is not proof that that earlier address implements the new ABI.

Set `DOTIFY_DEPLOYER_ADDRESS` to the reviewed public H160 account and
`DOTIFY_NATIVE_TOKEN_DECIMALS` to the verified native Balance precision. The
audited 10-decimal preset uses `10`; EVM currency metadata's `18` is a different
unit. Neither a public address nor this read-only command needs a private key:

```sh
npm --prefix contracts/evm run fresh:plan:testnet
```

Retain its v2 JSON with the source commit/clean state, chain ID 420420417,
finalized block/hash, observed pending nonce/balance and creation-code hashes.
The nonce is an observation, not a reservation or instruction to reset it.
Freeze a clean source and refresh this record before the operator signs.

The complete core has seven shared implementations: cut, loupe, ownership,
registry, royalties, access and metadata; then initializer, directory and
factory. That is **10 creations plus one directory-wiring transaction**.
Royalties inherits the contribution implementation and installs its gift
selectors; do not add a second standalone contributions deployment. CDM writes,
Bulletin retention/storage, client publication and artist setup are separate
operations with their own reviewed counts, costs and identity.

## Complete the deployment record before changing active references

The operator's reviewed signing scope must name the source/artifacts, network,
deployer, transaction/fee limits and recovery procedure. The existing
`deploy:testnet` entry point writes on-chain state and updates local deployment
files; preparing a plan does not run it. Partial execution must be reconciled
from receipts/account nonce before retrying; there is no automatic replay or
rollback of contract creations.

After actual core creation and wiring, retain transaction hashes, addresses and
explorer/source verification results. Generate the new metadata blobs from that
same source. Publish the reviewed blobs to Bulletin and the two existing CDM
names under their actual publisher; record exact finalized versions. Preserve
the append-only CDM history and account nonces. Use the [Product runbook](../operations/product-devnet-deployment.md)
for storage authorization, retention, signer handling and registry operations.

Update `contracts/evm/cdm.json` only from those actual results. With the same
explicit public deployer, run:

```sh
npm --prefix contracts/evm run fresh:readback:testnet
```

The v2 readback checks at one finalized block:

- all ten deployed bytecodes against compiler output, masking only the compiler's
  declared immutable slots;
- the factory's directory, initializer, seven facet addresses and native precision,
  plus the directory's factory/deployer binding;
- zero finalized artists before cutover; this is not enumeration of unknown
  pending artist shells;
- each exact address/version pair in the recorded CDM snapshot, without searching
  a small version range or accepting another historical match.

Getter comparisons separately bind the masked immutable values. Missing metadata,
wrong precision, different code, wrong bindings, a populated directory or mismatched
CDM versions stop the readback. A local EVM rehearsal is not native Revive or Host
acceptance. Archive the dated readback before creating a new artist.

## Review one contract/API/client configuration

Prepare this table with actual values before the quiet-window cutover:

| Component | Values that must agree |
| --- | --- |
| Core manifest and generated Web configuration | New directory/factory/initializer/seven facets, native decimals and source |
| CDM snapshot and generated Product bindings | Exact new addresses, finalized versions and published metadata bytes/CIDs |
| Edge and custody API | `DOTIFY_DIRECTORY_ADDRESS`, `DOTIFY_FACTORY_ADDRESS`, chain ID and EVM/native RPCs; matching receipt endpoints |
| Signaling | `SIGNAL_CONTRIBUTION_DIRECTORY` equals the new directory |
| Active custody state | New generation-specific catalog/receipt/queue/admission scope; one writer; independently retained old evidence and required secrets/nonce history |
| Web and Product | Matching source/configuration, reviewed app/product identity and empty new-generation bootstrap |

The [deployment configuration](../operations/deployment-configuration.md#native-payment-correction-candidate-484)
defines what is retired as active application state and what must be preserved.
Do not delete old on-chain/storage objects or reset a reused writer's nonce.
Do not copy old runtime-bound encrypted releases, pending writes, grants or receipt
lookups into the new active generation. Do not use an old custody writer with new
data or enable compact publication/recurring conservation as part of this cutover.

An old populated API must not seed the new Product bootstrap. After the API is
bound to the new empty directory, retain its authoritative catalog JSON and
verify `items` and `artists` are empty. Generate the frozen bootstrap from that
reviewed JSON with `generate:product-catalog-bootstrap -- --input <file> --strict`;
this avoids a second mutable API fetch. Review/commit the snapshot, then run
deployment guards, Web/Product builds and signer-free candidate validation.
Keep an explicit new delivery identity; the retained tracked old appVersion is
not a new release.

Deliver matching API/custody/signaling/client components in the reviewed quiet
window and independently read back their served identities/configuration. A
rollback must restore a complete matching component set and preserve the latest
nonce and protected state; returning old releases to active use is outside the
owner's selected clean-generation scope.

## Accept the new generation

New artists now approve creation plus **seven** installation/finalization calls.
The metadata selector is installed before the final artist-signed transition;
administration stays with the factory and directory membership stays absent until
that final transition. The recorded artist remains stable after administration
delegation.

First collect actual Runtime 0.31 Host info on an identified qualification client
using [the device procedure](qualify-product-host-031.md). Then accept new Bulletin
publication, correction of release details, protected allow/deny, solo/Room
guests, Pause, track changes and lock-screen artwork on matched components.
Native money acceptance separately requires actual finalized beneficiary value,
failed-recipient claims, refunds, maximum fan-out and receipt/outage/reload repair.
Old receipts or the CASH screen cannot establish these new-generation results.
Record source, deployment and device outcomes separately. #317/#484/#85 remain
open until their applicable delivery/acceptance gates pass; CASH #406/#408 stays
disabled and separate.
