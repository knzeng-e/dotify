# 0044 — Public release assets on the existing Bulletin publisher

Date: 2026-11-01. Status: proposed implementation; activation requires review and a separate exact network budget. Refs #288 (W33), #287.

## Problem and decision

The owner confirmed the Pinata free account has reached its file limit. A release can therefore fail while saving its cover even when Bulletin audio is selected. Complete the same storage path for the cover and public release description, instead of deleting unrelated pins or purchasing more capacity to finish this pilot.

Keep the existing custody service, signer and account-wide nonce journal. A nonce is the account's transaction sequence number: a second independent writer using the same account would risk conflicting submissions. Serialize audio and public-asset jobs through the same publisher, and retain the existing pending-submission barrier and receipt checks. No new service, account authority or subscription is introduced by this code.

## Public files and durable limits

An additive, explicitly initialized `dotify.bulletin.public-assets.v1` policy binds the artist address, chain/runtime/content/key-version scope, and separate attempted-store/byte caps for **one cover and one metadata object**. It does not rewrite the audio profile hash, queue, encrypted output, attempts or nonce ledger. Each asset directory has its own deterministic job ID and existing durable inventory. The first metadata input is retained in a private sidecar so a retry that only rebuilds `createdAt` reuses the original bytes/CID. A different graph of the same kind is refused after its first inventory is claimed; this is a bounded internal pilot, not unrestricted publishing or editing.

A cover retains the original and its existing five WebP variants. Metadata retains the strict `dotify.track.v2` JSON under `release.json`. Both use deterministic UnixFS DAG-PB directories and BLAKE2b-256 content identifiers, reusing the proven graph encoder. Their inventory generation tags explicitly identify public data; the scope's key-version field identifies the associated release, not encryption of these assets. Public files have no content key. Audio still requires an authenticated encrypted manifest and the original one-job pilot restriction.

Signed purpose/byte upload grants and canonical artist authority remain required. Authority is checked again when queued public work reaches the writer. The operator policy is checked before any write session. Each graph must fit its own immutable cap including directory overhead; attempted, failed and uncertain stores stay charged. Prior-publication renewal obligations include attempted/completed public assets as well as audio, across restarts. A pending nonce blocks another asset; it never authorizes replay. File-count and byte caps do not promise sustainable production throughput or recurring retention.

## Reads and authority

References remain `ipfs://<BLAKE2b-directory>/cover/640.webp` and `ipfs://<BLAKE2b-directory>/release.json`. No mutable service URL is committed to the runtime. Clients recognize these identifiers and do not send them to Pinata or race unrelated gateways. Ordinary Web uses the existing API's `/api/assets/ipfs/:cid/*` relay. Host-aware fetch/cache paths first request native raw preimages and authenticate every CID/edge, then may recover through that same API. Direct image URLs/system integrations can use the API relay.

The relay deliberately supports pre-publication studio artwork, so it is not catalog-gated. It admits only fixed image/metadata paths, canonical BLAKE2b directory CIDs, no queries/ranges/URLs/RPC methods, two active requests and bounded bytes, graph traversal, deadlines and cache. Images must have matching supported magic/MIME, metadata must pass the strict schema. Failed responses are not cached. These public names and validation rules do not grant listening rights; all protected audio paths and the archive remain excluded. Canonical runtime state, not public JSON claims, remains authoritative for access and payment.

The service is still centrally operated. Native Host retrieval reduces its role for public reads; Web reads and publication orchestration still depend on it. Bulletin retention must be monitored/renewed separately. This is not permanent storage or a claim that all of Dotify is decentralized.

## Alternatives and operational boundary

A separate signer/nonce owner for covers would require a distinct account or shared sequence coordination; neither is needed here. A new general-purpose IPFS gateway would expand cost and abuse surface. Keeping Pinata as an automatic fallback would hide quota failures and spend outside the selected provider's budget, so selection is explicit and failures remain visible. Existing demo/Pinata configuration is preserved until explicitly changed.

See the [activation runbook](../operations/bulletin-public-assets.md) and [verification evidence](../backlog/implementation/evidence/bulletin-public-assets-2026-11-01.md). The existing three-attempt failed audio job still needs its controlled recovery; asset provisioning cannot reset or replace it. The independent admission correction #375 is now merged into dev and must remain in the rollout. No live upload, key transfer, reset or rollout has occurred here.
