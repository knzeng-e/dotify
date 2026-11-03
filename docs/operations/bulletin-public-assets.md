# Prepare Bulletin covers and metadata

Read [ADR 0044](../adr/0044-bulletin-public-release-assets.md). The existing synthetic pilot is now activated in [Product 0.1.69](../backlog/implementation/evidence/product-0.1.69-rollout-2026-11-02.md). The procedure below is a runbook for explicitly approved operations, not permission to add or replace a policy. Keep the existing publisher/queue, nonce history, receipts and installed signer; never reinitialize them to add assets.

1. Include the merged #375 correction in the rollout and review the existing failed audio job's separate controlled recovery. The public-asset extension does not restore exhausted processing attempts.
2. Prepare private 0700/0600 policy storage owned by custody UID 1000. Match the existing lowercase artist address and exact audio pilot scope. Choose separately reviewed attempted-store/byte ceilings for one cover and one metadata directory; count all raw/file/directory blocks and reserve future renewal transactions/bytes alongside every prior obligation. A source upload's byte grant does not include generated variants or DAG overhead.
3. After stopping custody gracefully and verifying no other account writer is running, bind the additive policy. The initializer takes `publisher.lock` exclusively, refuses an existing asset binding, and never reads the key or contacts a network:

```sh
# Inside the built custody image (/app), UID 1000; example paths only.
node dist/scripts/initializeBulletinAssets.js /data/contributions/config/bulletin-pilot.json /data/contributions/config/bulletin-assets.json
```

Policy shape (replace every placeholder; **not an approved allowance**):

```json
{
  "schema": "dotify.bulletin.public-assets.v1",
  "owner": "LOWERCASE_ARTIST_EVM_ADDRESS",
  "scope": {
    "chainId": 420420417,
    "runtimeAddress": "LOWERCASE_RUNTIME_ADDRESS",
    "contentHash": "EXACT_SYNTHETIC_CONTENT_HASH",
    "keyVersion": "dotify-content-key-v2"
  },
  "cover": { "maxBytes": 524288, "maxTransactions": 16, "minimumLifetimeBlocks": 100 },
  "metadata": { "maxBytes": 65536, "maxTransactions": 4, "minimumLifetimeBlocks": 100 }
}
```

4. On **custody only**, select `PUBLIC_ASSET_STORAGE=bulletin` and set `BULLETIN_PUBLIC_ASSET_POLICY` to that policy file. Keep `STREAMING_AUDIO_STORAGE=bulletin` and its existing `BULLETIN_PUBLICATION_PROFILE`. Missing/mismatched policy, signing identity, canonical authority or publication binding fails closed. No Pinata fallback exists in this mode. The policy and its copy in the inventory directory must remain unchanged; a changed file does not enlarge an admitted asset's allowance.
5. Public edges retain read-only `BULLETIN_MEDIA_RPC_URL`, no publisher policy/key. The existing API origin/CORS permissions suffice: no new Host origin or service is needed. Deploy the new Web/Product client resolver before publishing Bulletin artwork/metadata references; old clients may try generic gateways. This deliberately does not add permanent old-runtime support.
6. Verify source/version, readiness, authenticated upload grants, actual graph sizes, receipts/sender/nonces, retention and canonical references. Read every variant and `release.json` on Web/Desktop/mobile, including the unpublished studio preview and a slow/missing Host read. Complete ordinary artist-wallet registration and protected listening/payment tests. A successful public asset upload proves none of those protected-access outcomes.

## Exact pilot repair admitted, 2026-11-03

The [0.1.70 intervention](../backlog/implementation/evidence/product-0.1.70-rollout-2026-11-03.md)
installed the owner-approved `metadata-name-repair.json` for **Thot Nzeng**.
The original ready audio, cover and metadata inventories remain. The corrected
metadata still needs its ordinary authenticated artist request (two blocks /
1,101 bytes), followed by explicit wallet registration. Do not run admission or
prepared-audio recovery again for this pilot. The generic operator procedure below
is not authority to add another exception or enlarge either graph's allowance.

## Failures and rollback

A repeat of the same bytes addresses the same job, reconciles its pending transactions and reuses verified receipts within the original cap. A different cover/metadata graph is refused in this one-release pilot. The first admitted graph owns its kind even when an upload response is lost or a store fails. The first strict metadata input is durably preserved in `public-metadata-input.json`. When the app rebuilds a retry timestamp, the writer reuses the first bytes only if every other field is unchanged. Actual metadata changes remain a different graph and require operator review. Recurring editing/multi-release admission is a later scope.

Never clear an unresolved intent, delete locks without establishing exclusive ownership, reset counters or create a second job to retry a failed asset. A failed asset can block the shared account writer until canonical reconciliation. Error responses contain no provider body or credential. Pinata authentication/usage is irrelevant when both audio and public assets select Bulletin; readiness says this is a configuration observation, not a live quota/retention proof.

Rollback admission before rolling code back. Keep the additive policy, all inventories and account cursors intact, even if the client/asset selector is restored. Previously issued Bulletin references still need the new reader, so retain compatible API readers while clients use them. Old publisher code treats any public inventory as a claimed audio pilot job and may fail closed; do not erase it to work around that. A pre-asset whole-volume restore would also discard newer security/nonce state and is not a rollback procedure. Coherent off-volume backup/recovery and recurring renewals remain production gates.

## A required release detail was discovered after storage

The studio must validate title, artist name and About this track before
metadata storage or registration approval, and save the same trimmed text in metadata and registry.
See the [artist-name regression and current pilot state](../backlog/implementation/evidence/publication-artist-name-2026-11-02.md).

For an already stored manifest, do not promise that editing and retrying can
replace the first metadata graph. `preservePublicMetadata` permits a changed
timestamp only; substantive changes fail closed. The current one-graph pilot
needs an explicitly reviewed revision allowance and exact old/new identity plan.
Preserve the audio, cover, original metadata receipts/counters, queue, permanent
reservations and shared account cursor. Deleting `public-metadata-input.json`,
reinitializing the policy or restoring an old snapshot is not a repair. No
live metadata revision is implemented or authorized by the frontend fix.

## Exact artist-name repair

[ADR 0045](../adr/0045-bounded-metadata-name-repair.md) prepares a single exception
for the pre-registration `Unknown artist` defect. This procedure is not an
approved intervention or network budget. Merge/review and green exact-source CI
must precede preparation of the deployment/maintenance package.

1. Review the old/new roots, exact artist-selected name and extra attempted-store
   cap. Reserve renewals for the new graph **in addition** to every old dependency.
   The observed synthetic manifest produces two new blocks / 1,101 bytes; live
   quota, expiry and canonical unregistered state must be checked afresh.
2. Obtain explicit maintenance and new-write approval for this exact candidate.
   Stop custody gracefully, verify exclusive account ownership and preserve a
   coherent backup of queue, publisher state, permanent nonce/key custody and
   profiles. Do not restore an old snapshot over newer account progress.
3. Inside the reviewed custody image, with its usual environment and UID 1000,
   inspect without opening a signer:

   ```sh
   node dist/scripts/prepareMetadataNameRepair.js inspect 'Thot Nzeng'
   ```

   Inspection takes a temporary publisher lease, requires no writer/pending
   barriers, verifies the existing ready metadata graph and current canonical
   artist/runtime/unregistered state, and returns a plan plus `planSha256`.
   Review both roots, full name-only manifest, exact additional cap and snapshot.
   If anything changed, inspect again; never substitute a stale plan hash.
4. After review and approval, admit precisely that plan:

   ```sh
   node dist/scripts/prepareMetadataNameRepair.js admit 'Thot Nzeng' INSPECTED_PLAN_SHA256
   ```

   This command installs only the immutable permit; it submits **zero** storage
   or wallet transactions. A duplicate or partial existing permit is refused.
   Keep `public-metadata-input.json`, the original asset policy and every receipt
   intact. No preparation attempt is reset.
5. Restart reviewed custody and verify readiness/version and the permit binding.
   The artist completes the name in release Details using #381, retaining the
   original title, note, cover, audio, access and royalty choices. A client retry
   may regenerate its timestamp; custody reuses the exact approved metadata bytes.
   Normal signed upload grants initiate the two bounded stores, then the artist
   approves ordinary registry publication in their wallet.
6. Independently verify sender/nonce receipts, exact new metadata bytes/root,
   zero uncertain intents, preserved old inventories/caps and normal readiness.
   Verify the on-chain metadata reference and protected Web/physical Host allowed
   and denied listening. Storage success alone does not establish those gates.

If an account nonce or inventory changes between inspection and admission, the
hash refuses it. If registration is already visible at finalized **or latest**
state, metadata repair is refused. These reads are observations, not a cross-chain
reservation; avoid independent artist registrations during intervention. A wallet
race can leave orphan metadata, never silently edit an existing registry record.
Unknown storage submissions retain their normal reconciliation barrier and stay
charged. Keep the new permit with all inventories in future backups. Missing,
corrupt or changed permits fail closed; neither rollback nor an operator retry
may delete the marker or replenish either graph's allowance.
