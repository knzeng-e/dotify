# Check declared Bulletin retention

The separately approved [0.1.78 application rollout](../backlog/implementation/evidence/product-0.1.78-rollout-2026-11-06.md) performs bounded immediate one-off renewal of its retained dependencies, with durable intents and independent canonical expiry/byte readback. It does not add a writer to this read-only command, activate a scheduler or conserve every historical graph. Its cumulative future floor is 391 transactions / 131,511,566 bytes; older example floors below are not current defaults.

This operator command checks **every declared dependency**, account authorization
and renewal quota at one finalized block. A fresh app/root does not renew its
children. The command has no signer, submission method, scheduler or automatic
repair. It changes no custody profile, release, admission or account cursor.

This is the first conservation slice of W33/#288. A green report means only that
the selected RPC reports retained metadata and enough quota for the declared
scope. It does **not** prove retrievable bytes, complete inventory, recurring
renewals, an independent backup, key recovery or an artist-facing availability
commitment. Monitoring activation and those remaining gates are separate work.

## Prepare the inventory

Create an owned `0700` directory and a regular owned `0600` JSON plan, without
symlinks/hardlinks. Never include a seed, content key, signed request or credentials.
Use this shape; replace the account, root and dependency entries with verified
publication inventories, not examples or a current root alone:

```json
{
  "schema": "dotify.bulletin.conservation-plan.v1",
  "identity": {
    "genesis": "0xe101f0fa4627d29a257645e02be86d80378fea1a2bf8fa6a918d150ebc760a59",
    "account": "PUBLIC_STORAGE_ACCOUNT"
  },
  "retainedReserve": { "transactions": 311, "bytes": "93634213" },
  "warningBlocks": 20000,
  "criticalBlocks": 5000,
  "sources": [
    {
      "id": "app:version",
      "kind": "application",
      "root": "CANONICAL_CID",
      "blocks": [{ "cid": "CANONICAL_CID", "bytes": 271 }]
    }
  ]
}
```

The example reserve is the conservative 0.1.74 candidate floor, **not a default
or an authorization**. Read the latest verified rollout and reviewed obligations
before selecting it. Thresholds are explicit block counts, not inferred calendar
days. Allow time for operator response, account reauthorization and verification;
do not promise a deadline in hours from an assumed block rate.

List the root **and all transitive blocks** of each retained application,
diagnostic, audio graph, cover and metadata graph. Keep each source's association
even when CIDs are shared. Account for older trials and still-retained versions;
an inactive queue or superseded domain record is not permission to delete an
obligation. Review completeness against Product journals, lab journals, custody
media/public-asset inventories and the prior reserve ledger. This command does
not discover omitted sources or import a whole seed-bearing custody profile.

Canonical CIDv1 raw/DAG-PB with SHA-256 (Product) or BLAKE2b-256 (media) is supported.
Shared CIDs are deduplicated for reads and must agree on size. Plans contain at
most 256 sources / 8,192 dependency references; each declared block is at most 1 MiB (including Product CAR chunks).
The required renewal reserve is the greater of the known unique dependency total
and the **existing global floor** for each counter. The floor must already cover
these known obligations; it is not an additional disjoint allocation. Never lower
it just because this plan is incomplete, nor treat this report as permission to
prune a ledger or change a writer's remaining allowance.

## Run the check

From `services/api`, using the pinned Node 22 dependencies:

```sh
npm run build
npm run bulletin:conservation -- /PRIVATE/plan.json wss://EXPLICIT_REVIEWED_RPC
```

Choose the endpoint explicitly; `wss:` without credentials/query/fragment is
required. There is no environment fallback or production activation. The command
never loads application configuration, a seed file, `MNEMONIC` or a writer.
Preserve stdout as a private report; stderr contains only a fixed safe failure
message. The existing custody UID can run this without stopping the service,
because the plan is independent and only read operations are performed. This PR
does not install a plan or recurring job on Fly or add an HTTP/health endpoint.

| Exit | Meaning                                                                          | Operator action                                                                    |
| ---- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 0    | Declared metadata and quota above both thresholds                                | Record block/hash; still verify inventory completeness and separate recovery gates |
| 2    | Block or account deadline within warning threshold                               | Prepare a bounded reviewed renewal / account authorization operation               |
| 3    | Critical/expired/missing/unknown dependency, account or insufficient quota       | Investigate immediately; do not advertise conservation as healthy                  |
| 1    | Invalid inputs, wrong network, unavailable head/runtime, timeout or cancellation | No valid current report; investigate and repeat the read-only check                |

Block and account clocks are independent. Unknown/missing data is never green.
Permission read/encoding errors yield unknown authorization and a critical report;
individual dependency errors yield `unknown`. A failure to establish network,
head, runtime or retention period aborts the whole report. The run uses one
finalized hash, checks hash algorithm/codec/digest/size and bounds concurrency to
four reads, each read to ten seconds and the live run to sixty seconds. It trusts
the selected RPC's finalized chain data; it does not validate a light-client proof.
No raw payload, balance, nonce, transaction or signature is requested.

For reproducible offline assessment of a separately captured snapshot:

```sh
npm run bulletin:conservation -- --snapshot /PRIVATE/plan.json /PRIVATE/snapshot.json
```

Snapshots use `dotify.bulletin.conservation-snapshot.v1` and the exact plan
identity; inspect the schema in `bulletinConservation.ts`. They contain finalized
head/hash, authorization counters and per-CID observations. An offline report is
only as current and trustworthy as that supplied snapshot. It does not contact
the network or refresh an old deadline.

## Next conservation gates

Before any recurring activation, reconcile **all** historical obligations and
produce an exact reviewed plan, demonstrate a live metadata check and bounded
payload retrieval, then connect alerts to an explicitly selected operator. A
separate writer needs immutable transaction/byte caps, shared-account exclusion,
durable submission intents, finalized receipt readback and no ambiguous retry.
Verify off-volume restoration of encrypted blocks, inventories and compatible
key/nonce state before claiming recovery. A second copy on the same disk or a
reserved quota counter does not satisfy these gates. No renewal is sent by this
implementation, test suite or report.
