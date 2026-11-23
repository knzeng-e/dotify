# Prepare a coherent fresh testnet generation

Use this procedure for #317 after the owner-selected full redeployment and
merged audit/SDK corrections. It prepares a reviewable deployment and cutover;
source preparation is not evidence that contracts, services or a Product were
delivered. The [configuration reference](../operations/deployment-configuration.md#native-payment-correction-candidate-484)
owns active configuration and native acceptance boundaries.

## Development reset policy

The owner confirmed on 23 November 2026 that each development reset starts with
a fresh application generation. Retired test runtimes, releases, purchases,
claims, sessions and application histories have no migration or restoration
requirement. Global discovery of unfinished historical runtimes is outside
the onboarding prerequisites for this reset.

Verify the new core, exact CDM bindings and the intended artist's signer before
onboarding. Query that artist's current factory state on every creation/retry.
If creation has finalized but installation was interrupted, resume the recorded
runtime and stage. If submission has an uncertain outcome, reconcile finalized
state before requesting another approval. These checks belong to the normal
error and recovery path for the new generation.

Initialize the new application namespace empty and stop retired writers. Start
fresh authentication sessions and generation-specific receipts, queues and key
domains. A reset must not permit an old session or grant to authorize the new
generation. Chain-managed nonces, append-only registries and already incurred
storage obligations follow their network rules when an account is reused.

The [20 November core checkpoint](../operations/fresh-testnet-2026-11-20.md)
records an actual complete core deployment and finalized readback. Reconcile
against that manifest before planning any further creation. The
[21 November metadata/CDM checkpoint](../operations/fresh-cdm-2026-11-21.md)
records exact version 4 and the pre-onboarding empty-core readback; hosted
APIs/clients have not switched and the old custody publisher is stopped.

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
metadata or update a registry. Before publication, retain the earlier `deployments.json` and
`contracts/evm/cdm.json` until actual new receipts and finalized registry readback
supply new addresses/versions. Candidate factory metadata is not proof that an
earlier address implements the new ABI.

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
Begin the maintenance window and exclude all account-sharing writers before
those Bulletin publication operations.

Update `contracts/evm/cdm.json` only from those actual results. With the same
explicit public deployer, run:

```sh
npm --prefix contracts/evm run fresh:readback:testnet
```

The v2 readback checks at one finalized block:

- all ten deployed bytecodes against compiler output with each declared immutable
  slot filled from the reviewed manifest and explicit deployer address;
- the factory's directory, initializer, seven facet addresses and native precision,
  plus the directory's factory/deployer binding;
- zero finalized artists before the first onboarding;
- each exact address/version pair in the recorded CDM snapshot, without searching
  a small version range or accepting another historical match.

The report includes the deployed bytecode hash for each address. Getter comparisons
independently confirm the factory and directory bindings. Missing metadata,
wrong precision, different code, wrong bindings, a populated directory or mismatched
CDM versions stop the readback. A local EVM rehearsal is not native Revive or Host
acceptance. Archive the dated readback before creating a new artist.

## Review one contract/API/client configuration

Prepare this table with actual values before the development maintenance window:

| Component | Values that must agree |
| --- | --- |
| Core manifest and generated Web configuration | New directory/factory/initializer/seven facets, native decimals and source |
| CDM snapshot and generated Product bindings | Exact new addresses, finalized versions and published metadata bytes/CIDs |
| Edge and custody API | `DOTIFY_DIRECTORY_ADDRESS`, `DOTIFY_FACTORY_ADDRESS`, chain ID and EVM/native RPCs; matching receipt endpoints |
| Signaling | `SIGNAL_CONTRIBUTION_DIRECTORY` equals the new directory |
| Active custody state | New generation-specific catalog/receipt/queue/admission scope; one writer; empty new application state and chain-current account nonces |
| Web and Product | Matching source/configuration, reviewed app/product identity and empty new-generation bootstrap |

Apply the development reset policy above and the
[deployment configuration](../operations/deployment-configuration.md#testnet-cutover-with-an-interruption)
to the new component set.

The development environment has no users to keep online. Use one maintenance
interruption and the existing startup checks:

1. Stop old writers and initialize the empty new application namespace under the
   [cutover configuration](../operations/deployment-configuration.md#testnet-cutover-with-an-interruption).
   Complete the CDM publication/readback with exclusive storage-account access.
   Retain the finalized empty-directory core/CDM readback **before** creating an
   artist.
2. First run the [selected-artist prerequisite check](check-artist-onboarding-prerequisites.md)
   to inspect the intended account's mapping and pending/registered state. Its
   report supports creation/retry recovery. Verify the reviewed bytecode/CDM
   bindings and identified signer before approvals.
   Have the artist wallet create its runtime and approve the seven installation/
   finalization calls against the new factory. These are contract calls; they do
   not require the publication API. Use a wallet interaction or an identified
   qualification client bound to the new factory/CDM generation. Retain finality,
   recorded artist, owner and readiness evidence for that actual runtime.
3. Prepare its new content-key domain and bounded Bulletin profile, then start
   one matching custody process with the existing publisher preflight. Start
   matching edges and signaling with the new namespace, directory and factory.
4. Retain the authoritative new-generation API catalog JSON. Verify `items` is
   empty and any artist entries resolve through the new directory. Onboarding
   may now have added the first artist; the zero-artist check belongs to step 1.
   Generate the frozen bootstrap from that reviewed JSON using
   `generate:product-catalog-bootstrap -- --input <file> --strict`, avoiding a
   second mutable API fetch. Review/commit it, run deployment guards and builds,
   and deliver an explicitly identified Web/Product release. The retained old
   appVersion is not a new delivery identity.

Independently read back the served component identities/configuration. Resolve a
failed startup against the selected new generation before resuming onboarding.

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
