# Protected Bulletin release: offline integration rehearsal

Refs #288 / #287. Base: merged dev `3c59bc63e3e36c09d9bee392e86584d1e7f0a45c`, after the [four uninterrupted physical iPhone listens](bulletin-append-mobile-2026-10-31.md). This slice joins the existing publication and access boundaries in one executable, **offline** rehearsal. It does not publish a track, alter the main app, activate Bulletin storage or request an owner signer.

## Why this is the next check

The mobile lab deliberately embeds its synthetic key. That proved delivery and decoding, but cannot prove protected listening. A production release must instead use this path:

```text
generated master → existing durable custody job → encrypted v3 files
→ BLAKE2b IPFS directory → simulated Bulletin receipts
→ simulated canonical catalog/runtime registration
→ real wallet signature + nonce verification + canonical access resolution
→ release-scoped custody key → selective authenticated segment reads → AAC decode
```

Only the RPC/catalog responses and Bulletin transport are models. Job admission, source custody, FFmpeg encoding, nonce reservation, HKDF key derivation, BLAKE2b addressing, publication journal/reconciliation, API request validation, EIP-191/sr25519 verification, entitlement resolution, manifest/object authentication and AAC frame decoding use the existing modules. The test does not replace access checks with an unconditional allow result.

## Code and state ownership

1. `research/bulletin-prototype/protected-rehearsal.mjs` launches the test in a fresh temporary working directory with an allowlisted environment. Repository `.env`, database/service credentials, `MNEMONIC` and `NODE_OPTIONS` are not inherited. The test uses Fastify request injection without opening a listener and rejects Node TCP/fetch attempts. Temporary custody, ciphertext, decoded synthetic audio and receipts are removed when the child exits normally, including failed tests. An abrupt operator/process kill may leave a temporary directory; do not use this runner for artist recordings or production secrets.
2. `protected-release.test.mjs` supplies the existing `StreamingJobs.pin` callback with the existing bounded directory builder, BLAKE2b readdressing and receipt publisher. This demonstrates the storage seam without introducing a production provider switch or generic storage framework. The publisher's account, chain, graph, byte/transaction and retention checks still apply. The short generated fixture is deliberately limited to eight seconds; this callback is not a general adapter for full releases.
3. The first simulated storage attempt commits its third block and loses the acknowledgement. The job is **failed**, not ready. A new `StreamingJobs` instance reloads the same custody directory and retries. The publisher reconciles the pending block against fresh simulated lookup/readback, then completes the graph. The root, every file hash and the permanent nonce ledger stay identical; the encoder runs once and each block is stored once. Ready-state cleanup removes job files while keeping nonce reservations.
4. Registration and entitlement changes are explicit model actions, not on-chain submissions or payments. The unchanged `createChainAccessService` checks their canonical release, runtime reference, active state and per-requester entitlement at the observed block. Model block increments prevent an old same-block verdict from masking a change.
5. Random local EVM and Product sr25519 signers obtain real nonce challenges and sign the complete release-bound request. The unchanged key route verifies and consumes the nonce before asking the access service. Only successful verdicts derive a key. No fallback signer, key file, browser fixture or public test key is added to the product.
6. The delivered key authenticates the manifest and all init/media objects at 96/160/320 kb/s, using raw-CID Host-reader semantics over the simulated transport. FFprobe checks codec/duration; FFmpeg decodes every resulting AAC frame. Playback reads exclude all raw archival-master dependencies. This is cryptographic/codec evidence, **not an audible browser or physical Host test**.

## Verification

From the repository root with Node 22, locked dependencies installed in `services/api`, `web` and `research/bulletin-prototype`, and FFmpeg/FFprobe on PATH:

```sh
npm run test:protected --prefix research/bulletin-prototype
npm test --prefix research/bulletin-prototype
node scripts/backlog-sync.mjs --check --offline
git diff --check
```

Local results on 2026-10-31, tested implementation `ccc20eb88a48ef394bbbd9ebc70bf30923f8b420`:

| Check | Result and meaning |
| --- | --- |
| Protected rehearsal | 8 tests pass: integrated publication/reconciliation/key/decode path plus 7 denial/revocation subtests |
| Existing Bulletin suite | 38 tests pass: directory, hashing, real generated AAC, bounded reads, partial submission and retention models |
| Publication retry | One encode, unchanged ciphertext/root/nonce reservations; no duplicated simulated stores or renewals |
| Web and Product request schemes | Real EIP-191 and sr25519 verification; each delivered key authenticates/decodes all three renditions; replay returns `NONCE_REUSED` |
| Denials | Public Classic lookup, room guest, forged signature, changed signed reference, correctly signed wrong identity, changed runtime reference, revoked listener/host, RPC outage, stale catalog and inactive track return no key and do not derive one |
| Response caching | Successful keys and denial/error responses use `Cache-Control: no-store` |
| Isolation | No inherited deployment credentials or repository dotenv; TCP/fetch attempts rejected; no live chain, Pinata, DotNS, Product or storage transaction |

The existing Bulletin workflow runs the new command after the original directory tests. Its path filters now include the API trust modules consumed by this rehearsal. No dependencies or production settings change.

## Before a real protected-release canary

The next slice must turn the demonstrated callback into a separately reviewed storage adapter with durable receipt ownership tied to the production job, bounded real-release graphs and explicit selection. It must define ordinary Web retrieval alongside native Host retrieval; native BLAKE2b success does not establish a working public gateway. Artist release registration, key requests and playback must use the canonical result, never the generated lab's embedded key.

Prepare that concrete candidate before requesting any live action: private recoverable ciphertext and nonce custody; a selected synthetic/private test release; exact full-graph byte/transaction/renewal budget; owner account and quota; new canary records isolated from existing releases; Web/Desktop/mobile denial and allowed playback; failure/restart recovery; retention ownership and rollback. A separate storage signer is recommended before unattended operation, because domain control should not depend on a worker-held DotNS signer.

Actual runtime registration/payment, installed Host signatures, physical protected listening, cold audible startup, background/uncached network recovery, a recurring renewal cycle and operational cost remain unverified. Keep W32/W33 open. No network allowance from an earlier completed lab publication is reused.
