# Bulletin for Dotify music: a credible path, with delivery still to prove

Research requested by the owner on 2026-10-29. Refs #288/#287.
**No media migration, new infrastructure or storage transaction is activated.**
[ADR 0034](../adr/0034-media-cdn-and-native-storage.md) remains the current
delivery decision. This note explores its deferred Bulletin option after the
publication recovery deployment in [#352](https://github.com/knzeng-e/dotify/pull/352).

## What this would improve

Bulletin could replace the vendor account that stores encrypted releases,
artwork and metadata. Encoding, the current segmented player, signed access
checks and permanent nonce reservations can remain. That reduces dependence on
one pinning vendor; it does not remove the current custody/key authority or
guarantee cheaper, faster or permanent storage.

The best candidate is the existing **immutable publication Module**:

- **Files:** `services/api/src/services/streamingJobs.ts`, `pinata.ts` and the
  publication wiring in `app.ts`.
- **Current Seam:** a job supplies validated encrypted files to its injected
  `pin(files, name, signal)` function and receives a directory CID. Pinata is
  the current Adapter. Its Interface already concentrates storage behavior.
- **Proposed direction:** evaluate a Bulletin Adapter at that same Seam. Keep
  the artist's existing authority checks and approvals; do not route every
  audio segment through a new artist wallet interaction.
- **Leverage and Locality:** custody continues to own encryption/retry safety;
  one Module owns storage admission, receipts and renewal. Test its Interface
  with partial failure/restart and exact directory reads. Avoid a generic
  storage framework or pass-through wrappers before a second Adapter works.

## Evidence collected

The [read-only inventory](../../research/bulletin-storage/README.md) checks the
actual RPC used by Dotify, not a network inferred from a hostname. The result
matches the pinned Product SDK's **devnet** genesis
`0xe101f0fa4627d29a257645e02be86d80378fea1a2bf8fa6a918d150ebc760a59`;
the SDK's `paseo` preset is a different chain.

| Observed fact | Consequence |
| --- | --- |
| Storage transaction maximum: 2,097,152 bytes | Every encoded DAG block must fit; a complete release is not one transaction. |
| Retention and authorization periods: 201,600 blocks | About two weeks at the observed roughly six-second cadence. Content retention and account permission must be managed separately. |
| `store_with_cid_config`; SHA-256 and DAG-PB/raw supported by the pinned descriptor | Preserving current IPFS block identities is plausible; a live write/read proof is still required. |
| DataRenewal includes one-shot and automatic renewal | The application must retain receipts and monitor renewal failures for every dependency block. Renewing a root alone cannot protect its children. |
| Renewal cap observed: 1 TiB; counter about 23 MB at inspection | A test-network snapshot, not reserved space, production pricing or a scalability guarantee. |

See the [finalized network observation](../backlog/implementation/evidence/bulletin-media-network-2026-10-29.json).
The live runtime is `bulletin-paseo` spec 2005004. The public endpoint's name
does not mean the SDK `paseo` preset should be used.

## The important delivery trap

The current reader fetches `root/manifest.json`, then individual init/media
objects. The stored directory is a graph of named files and immutable IPFS
blocks, often called a DAG. A CAR is a container carrying such blocks.
**Uploading a CAR as ordinary bytes does not publish its inner directory.**
Default SDK file chunking also produces a file, not the named directory that
the current player needs.

This is observable in our already-public Product bundle: the complete CAR
download and all 127 block hashes verified during deployment, while a local
HEAD request to `transport-CID/index.html` returned 404 and the inner-directory
path timed out after 20 seconds. These [two observations](../backlog/implementation/evidence/bulletin-media-paths-2026-10-29.json)
are not a general gateway verdict or audio latency benchmark. App delivery is
not evidence that arbitrary segment paths will work.

Product SDK **0.39.0** / Cloud Storage **0.13.3** is pinned for the working Host
protocol. Its `fetchBytes` is Host-only, takes a CID and reassembles chunked
files. It cannot be assumed to provide Web gateway fallback or directory-path
resolution. The existing `useBulletin.ts` archives compact rights JSON, not
music; its quota check uses consumed counters as if remaining and its success
condition is best-block inclusion. Do not extend that helper for media.

## Preferred experiment and alternatives

1. **Preserve the IPFS directory.** Build its DAG locally, publish each exact
   block with matching hash/codec settings, then its root. Do not re-chunk an
   already encoded block. Verify every returned CID and finalized receipt.
   This is the first candidate because it can preserve the current player and
   catalog references.
2. **One CID per authenticated object.** If Host directory resolution is the
   obstacle, an authenticated object-to-CID manifest is a possible alternative.
   It deliberately changes the manifest/readers and needs a separate format
   decision. Do not hide it inside a gateway fallback.
3. **Whole-release CAR download.** Reject this as the mobile playback path: it
   would recreate the download-before-first-sound delay we just removed.

For a canary, use deterministic synthetic ciphertext, with no artist master,
user identity or key. Before any network write, choose a dedicated authorized
storage account and explicit quota budget. The public deployment pool and
DotNS owner are not media-publishing credentials. Direct artist-owned Cloud
Storage is a later option, with its own signer/permission and UX study.

The Adapter must record each block's CID, network, finalized block/index and
renewal state durably. A partially stored graph is not a ready release. Retry
must reuse verified ciphertext/receipts without re-encoding or recycling nonces.
Budget bytes **and** transaction/renewal counts for the entire graph; one
representative release already contains 217 authenticated objects before
directory/chunk overhead. Keep a recoverable encrypted copy until retention
and recovery behavior are proven.

## Gates before replacing Pinata

- Resolve the same manifest/init/first segment by path on ordinary Web and by
  supported Host reads on actual mobile/Desktop; verify bytes and AEAD.
- Measure cold first sound, continuous playback, seeks and interrupted reads
  against the current baseline. Storage capacity does not establish delivery
  performance; a sovereign gateway may still be needed, but is not provisioned.
- Rehearse partial upload, restart, rejected quota, authorization expiry and
  failed renewal; prove children remain available across a renewal cycle.
- Obtain a documented authorization/renewal arrangement and resource budget.
  No unlimited-free-storage or production-cost claim is supported yet.
- Review the Adapter and operational ownership, then authorize a separate
  activation. Existing W32/W33/native acceptance gates remain open.

## Primary references and version caution

- [Bulletin authorization](https://docs.polkadot.com/reference/apps/infrastructure/bulletin-chain/authorization/)
  describes quota grants and permission expiry.
- [Retention and renewal](https://docs.polkadot.com/reference/apps/infrastructure/bulletin-chain/renewal/)
  describes why stored content must be kept alive.
- [Product storage architecture](https://docs.polkadotcommunity.foundation/architecture/storage/)
  separates CID storage, authorized writes and Host retrieval.
- [Bulletin source](https://github.com/paritytech/polkadot-bulletin-chain)
  and [Product SDK source](https://github.com/paritytech/product-sdk) are
  experimental reference implementations. Current documentation, pinned SDK
  APIs and deployed runtime versions can differ; on-chain inspection is the
  evidence for this network's limits, not a promise of mainnet behavior.
