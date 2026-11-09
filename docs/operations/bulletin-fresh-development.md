# Prepare fresh Bulletin development publication

Use [ADR 0047](../adr/0047-fresh-bulletin-development.md) with the bounded profile
in [ADR 0046](../adr/0046-bounded-multi-release-admission.md). The owner chose to
stop recovering old test drafts and start publication in a new key domain.
This command prepares private files; it does not stop custody, install a key,
select the new profile, create a runtime or submit transactions.

## Current bounded development activation

[Web/Product/API 0.1.81](../backlog/implementation/evidence/product-0.1.81-rollout-2026-11-08.md)
activates two complete new releases globally under the separately approved
allowance. Custody and the key-serving edge API replicas use identical active v3
mapping with v2 retained. Neither a repeat of this initializer nor deleting its
journals can replenish that allowance. Actual ordinary artist acceptance remains
open under #407; the generic preparation/approval boundaries below still apply.

## Review the new input

Build the API and run as the owner of the private persistent state (UID 1000 in
custody). Use a canonical mode 0700 parent and an **absent** destination. Supply
one private mode 0600 JSON request. This shape is illustrative, not an approved
live budget:

```json
{
  "schema": "dotify.bulletin.fresh-development.v1",
  "destination": "/app/.data/bulletin-development-new",
  "retiredKeyVersions": ["dotify-content-key-v2"],
  "accountNonceFloor": 1120,
  "profile": { "replace": "complete reviewed fresh multi-release publisher profile" }
}
```

`profile` is the complete publisher profile, with `releasePolicy` and without
`pilotScope` or `freshContentKey`. Its `directory` must be
`destination/publications`; all allowed artists use one unused later key version
(e.g. v3 only if v2 is actually the last previously configured/archived version).
Check that version against the real vault, including historical mappings. Use the
actual artist runtime; a new empty artist space, if wanted, is created through
the ordinary wallet flow and then its address goes into the reviewed policy.
The initializer neither resets the chain catalogue nor invents a runtime.

Keep `seedFile` at its existing installed path outside the new destination. This
is the Bulletin/DotNS signer, different from the new content-encryption master.
It is not opened or transferred by preparation. Keep old queues, inventories,
keys and receipts intact at their existing paths; no migration manifest or old
queue import is needed to prepare the new domain.

The account nonce above is **an old illustrative number**, not a current value.
Before activation verify fresh finalized nonce/authorization/quota and that all
account-sharing writers are excluded and pending submissions reconciled. Put the
reviewed nonce floor into the request. Keep every existing account obligation in
`profile.priorRenewalReserve`; at the 0.1.80 record the conservative floor was
431 transactions / 150,484,205 bytes. Recheck subsequent history; do not lower it
because the local queue is empty. Per-part/global caps must cover measured real
artist graphs plus retries; preparation does not authorize musical writes.

## Initialize once

In the built API image, working directory `/app`:

```sh
node dist/scripts/initializeFreshBulletinDevelopment.js /private/reviewed-request.json
```

Output:

```text
content-key.json        NEW version → random master secret; private, never log
profile.json            bounded profile + new version/master-digest binding
queue/                  fresh jobs, permanent nonce ledger and profile binding
publications/           fresh inventories, admission ledger and account floor
ready.json              sanitized result; zero network writes, not activated
```

The routine command output contains counts, version and profile hash, not the
new key. Do not put `content-key.json` in Git, a frontend variable, chat or a
command-line argument. Preserve/protect it through the existing private backup
and installation workflow. A same-disk copy is not disaster recovery. Existing
or partial destinations are refused; preserve failures for inspection and use
a new reviewed absent destination after understanding the cause.

## Install and test after review

Prepare the exact maintenance, matched Web/Product/API rollout and musical write
budget before requesting operational approval. Use existing services and the
existing signer. Install the new content master through private secret input,
merging the new version into `CONTENT_KEY_MASTER_SECRETS` while retaining old
version secrets/`CONTENT_KEY_MASTER_SECRET` for existing catalogue reads. Set
`CONTENT_KEY_ACTIVE_VERSION` to the new version on the relevant custody/key-serving
roles together. The generated file contains **only the new mapping**; replacing
an existing multi-version map blindly would lose old keys. Do not log secret
values or put them in the public API role where not required.

Select these together on custody:

```dotenv
STREAMING_AUDIO_STORAGE=bulletin
PUBLIC_ASSET_STORAGE=bulletin
BULLETIN_PUBLICATION_PROFILE=/app/.data/bulletin-development-new/profile.json
STREAMING_STATE_PATH=/app/.data/bulletin-development-new/queue
CONTENT_KEY_ACTIVE_VERSION=dotify-content-key-v3
```

Unset the old `BULLETIN_PUBLIC_ASSET_POLICY`; the inline release policy replaces
it. Preserve other worker/auth/security/database configuration. A wrong active
version/master is refused **before transport/session or signer loading**. Deploy
clients from #410 or later so cover requests carry their release content hash.
The runtime/catalogue/wallet protocol is unchanged. Do not run the old publisher
alongside the new owner of the same Bulletin account.

Then use ordinary New release: artist-selected source, cover/details, wallet
approval, catalogue readback and audible Web/Desktop/phone checks. Do not use an
old saved test draft as the new acceptance case. Record actual timings, stores,
bytes, retries and retention. No automatic renewal is scheduled.

After first use, this new ledger is permanent. Rollback may disable new writes
or restore compatible code; it must preserve this queue, content master, receipts
and account progress. Never recreate an empty queue with the same new key or
restart a damaged historical writer to bypass an error. Production conservation,
protected denial/interruption and coherent key/security recovery remain broader
public-pilot gates; migration of abandoned development drafts is not one.
