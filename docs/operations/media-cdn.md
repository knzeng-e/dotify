# Activate the public ciphertext CDN

W33 / #288, [decision](../adr/0034-media-cdn-and-native-storage.md).
This is a prepared integration, not a live CDN activation.

## Before activation

The owner-provided gateway is
`https://chocolate-selected-ocelot-159.mypinata.cloud`.
On 2026-10-22 it returned 401/ERR_ID:00024 for the current published streaming
manifest from Europe, North America and Asia. Leave the new variables unset
until this is corrected. The current API fallback works in all three regions.

In the Pinata account that owns the gateway, verify that the folder CID is
pinned in the same account used by the API's server-side upload credential.
Check Gateway Access Controls for that content. Do not expose the upload JWT,
put a gateway token into Vite/cache URLs, open access to arbitrary IPFS content,
or weaken application key checks to make this test pass. The provider's
[restricted gateway documentation](https://docs.pinata.cloud/gateways/gateway-access-controls)
explains the account-content boundary; the exact cause of this account's 401
has not been established from public HTTP responses alone.

Use the current catalog's audioRef root CID and test only:
`/ipfs/<cid>/manifest.json`, `160/init.bin`, `160/segment-000.bin`.
Compare exact bytes with the API relay, inspect public CORS and immutable
Cache-Control on 200 responses, then repeat cold/warm retrieval. Status 401/403,
404, 206 for a full-object request, truncation and oversized bodies are failures.
An error body must never be mistaken for a warmed object.

## Configuration and rollout

- Web and Product: `VITE_DOTIFY_MEDIA_EDGE_URL=https://<gateway>`; HTTPS origin
  only, no path/query/fragment/credentials. Rebuild both clients. Room entry
  requests Remote permission for that configured domain on Product; explicitly
  test standalone player and host fetch behavior on physical Desktop/mobile.
- API: `MEDIA_EDGE_URL=https://<same-gateway>` enables startup-object warming
  after confirmed, persisted catalog indexing. `MEDIA_IPFS_GATEWAY` may point
  at the same dedicated `*.mypinata.cloud` origin for relay misses. No token.
- The configured edge/dedicated first attempt has a 3-second transport deadline,
  then existing fallbacks retain their budgets. A slow CDN must not add an
  unbounded wait before recovery.
- Unset all three to retain current transport. The public cache never owns
  rights, keys, session signing, access policies or plaintext. CDN hits can
  outlive catalog deactivation; access/key requests still revalidate the work.
- Warming is best effort: at most eight admitted jobs/minute, two concurrent,
  queue eight and seven fixed startup objects/job (max roughly 7 MiB/job by
  byte caps), 5 seconds/object, three attempts per continuously observed CID
  with at least 20 seconds between failed attempts. Stops on an error or close.
  It neither delays publishing nor warms every geographic POP by itself.

No new provider account, paid plan, secret, infrastructure or live permission
change is authorized by merging code. Existing `.env.product-devnet` is not
activated automatically by this PR.

## Cost and monitoring

Verify the owner's actual plan/quotas and alert threshold in Pinata before
activation. The public pricing page lists Picnic at $20/mo, 500 GB bandwidth,
with $0.10/GB bandwidth overage; pricing checked 2026-10-22, not this account's
contract. Check request overages too. No plan was purchased or changed.
Budget both listeners and warming. Warming requests are bounded, but repeated
publication across a month still consumes provider bandwidth. Configure provider
billing alerts and a low pilot bandwidth ceiling before enabling; if the plan
cannot enforce a ceiling, use manual daily review and leave new warming off
until a cost owner accepts that limit. Do not claim a hard monetary cap in code.

Use existing first-sound schema 6 telemetry to see selected gateway, recovery,
manifest/init/segment bytes and actual audible start. Collect paired before/after
on the same browsers/networks in three regions, with attempt/failure counts,
cold/warm state and exact build SHA. The six diagnostic HTTP probes in W33's
evidence are not first-sound measurements or proof of production cache hits.
Sending URLs/CIDs to an external measurement service needs explicit owner
approval; no wallet/key/session data belongs in such diagnostics.

## Purge, withdrawal and rollback

The same bytes keep the same CID. For changed content, publish a new encrypted
bundle/CID and metadata through the normal artist flow; never overwrite a
CID with mutable bytes. Cache purge is not access revocation or IPFS deletion.

For suspected stale/corrupt provider cache, first unset
`VITE_DOTIFY_MEDIA_EDGE_URL` in Web/Product and `MEDIA_EDGE_URL` /
`MEDIA_IPFS_GATEWAY` on the API; rebuild/redeploy the reviewed artifacts. This
bypasses CDN immediately for new clients, preserves API/IPFS and every durable
key/nonce/revocation record, and stops new warming. Existing open clients may
still use their short-lived in-memory ciphertext cache until reload.

Use the gateway's provider-supported invalidation for the exact affected CID
objects (or contact Pinata support if the account exposes no purge control).
Do not guess an undocumented purge API or buy another service. Read back exact
bytes and immutable headers from each test region before restoring the origin.
For a rights withdrawal, deactivate through the artist policy and preserve
access verification; encrypted public copies may still exist. Keep keys secret.
