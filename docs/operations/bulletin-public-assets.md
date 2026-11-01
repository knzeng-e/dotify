# Prepare Bulletin covers and metadata

Read [ADR 0044](../adr/0044-bulletin-public-release-assets.md). This is a review candidate, not activation or permission to write. Keep the existing publisher/queue, nonce history, receipts and installed signer; never reinitialize them to add assets.

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

## Failures and rollback

A repeat of the same bytes addresses the same job, reconciles its pending transactions and reuses verified receipts within the original cap. A different cover/metadata graph is refused in this one-release pilot. The first admitted graph owns its kind even when an upload response is lost or a store fails. The first strict metadata input is durably preserved in `public-metadata-input.json`. When the app rebuilds a retry timestamp, the writer reuses the first bytes only if every other field is unchanged. Actual metadata changes remain a different graph and require operator review. Recurring editing/multi-release admission is a later scope.

Never clear an unresolved intent, delete locks without establishing exclusive ownership, reset counters or create a second job to retry a failed asset. A failed asset can block the shared account writer until canonical reconciliation. Error responses contain no provider body or credential. Pinata authentication/usage is irrelevant when both audio and public assets select Bulletin; readiness says this is a configuration observation, not a live quota/retention proof.

Rollback admission before rolling code back. Keep the additive policy, all inventories and account cursors intact, even if the client/asset selector is restored. Previously issued Bulletin references still need the new reader, so retain compatible API readers while clients use them. Old publisher code treats any public inventory as a claimed audio pilot job and may fail closed; do not erase it to work around that. A pre-asset whole-volume restore would also discard newer security/nonce state and is not a rollback procedure. Coherent off-volume backup/recovery and recurring renewals remain production gates.
