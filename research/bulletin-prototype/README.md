# Bulletin segmented-media prototype

**Isolated research. Not a deployable storage adapter.** Refs #288/#287;
follows [the feasibility study](https://github.com/knzeng-e/dotify/pull/353).
Pinata, the deployed player and native permissions remain unchanged.

This implementation builds a real named UnixFS directory with SHA-256/raw and
DAG-PB blocks. It uses the existing Dotify v3 encryptor, durable nonce reservation,
manifest validation and AEAD decoder on public synthetic byte patterns. The
patterns are not AAC and do not contain artist music. Offline tests use a random temporary key, wiped at the end and never
checkpointed. The separate operator canary retains its synthetic key in a
private local file for later verification; it never uploads that key.
The directory root is built with this experiment's explicit UnixFS settings.
Preserving its block CIDs does not prove equality with Pinata's existing import
settings or migration of an already-published directory.

```sh
npm ci --prefix services/api --ignore-scripts
npm ci --prefix research/bulletin-prototype --ignore-scripts
npm test --prefix research/bulletin-prototype
npm run measure --prefix research/bulletin-prototype
```

The measure command writes ignored `results.json`. Tests/measure create only
temporary fixture data, and all storage transport is an in-memory fault/expiry
model. They do not initialize a network client, select a signer, create a
wallet, send a transaction or read deployment credentials. SDK **0.5.0** and its
dependencies are isolated here; the production SDK/protocol pins are unchanged.

## Read in this order

1. `graph.mjs`: build and validate the complete directory. Children precede
   parents; each block is bounded below automatic SDK chunking. Read a path by
   fetching only its dependencies, verifying every block CID, with byte/depth/
   read budgets. Host reads request `noReassemble: true`, which exists in pinned
   Product SDK 0.39.0. The original mock exercises only that interface; the real Host limitation is recorded below.
2. `sdk-store.mjs`: the real Bulletin SDK builder preserves codec/hash and waits
   for finalization. Each returned CID/size/storage coordinate must match; an
   unexpectedly chunked result is refused. No signer is constructed here.
3. `publication.mjs`: checkpoint graph/account/network identity and finalized
   receipts. A retry rereads chain state and bytes, rather than trusting local
   receipts. A lost acknowledgement is recovered by finalized lookup. A missing
   CID does **not** prove an uncertain submission failed; that case stops for
   operator reconciliation instead of blindly consuming quota again.
4. `simulated-chain.mjs` / tests: fault and expiry scenarios. The model is not a
   full Bulletin runtime emulator or a claim about live quota economics. Two
   tests resume partial/lost-acknowledgement state in a fresh Node subprocess,
   with ciphertext and the simulated remote state persisted separately from
   receipts. No key or deployment credential is passed to that subprocess.

## Recovery and renewal model

Before writing, validate the complete graph and reserve explicit byte/transaction
budgets, authorization lifetime and one full renewal cycle. The directory root
is last; a partial publication does not return a ready root. The checkpoint
contains public CIDs and receipt coordinates, no source bytes, keys or plaintext.
Writes use temporary-file fsync, rename and directory fsync. A checkpoint from
another account/network/graph is refused. Ciphertext is reused unchanged.

Renewal covers every dependency block. A finalized request is only a request;
the next read must observe later storage coordinates, extended retention and
retrievable bytes for all children before reporting retained data. The tests
show a renewed root whose expired children are still unavailable.

This is **one process, one operator, one renewal cycle**. An in-process guard
rejects overlapping writers to the same checkpoint; it is not a cross-process
lease. There is no unattended renewal scheduler, multi-cycle policy, production
receipt index, secret manager or rollback/migration path here. An unresolved
submission or renewal requires explicit chain reconciliation. These deliberate
limits must be resolved before production integration, not inferred from a
green local test.

## Network canary

The local results provide exact graph bytes/block count for the bounded canary.
Before any live write, explicitly select a user-owned authorized account,
verify its signer/account and the pinned DevNet genesis, and approve the graph's
storage plus one-cycle quota budget. The owner has chosen to reuse the DotNS
account for this bounded manual canary. DotNS ownership does not itself grant
Bulletin storage authorization or quota. Keep signing local; never place that
key in the frontend or a backend worker, and do not change the DotNS record.
Do not use the public deployment pool for media. A separate storage account is
recommended for unattended production renewal so it cannot control the domain;
it is not a Bulletin requirement for this manual test.
`live-transport.mjs` implements finalized authorization/lookup checks with PAPI
3.3.0 and raw retrieval through the official node's `bitswap_v1_get` RPC. CID
hash, codec, size and retention must agree with metadata at the same pinned
finalized head. Reads time out and cannot fall back to uploads. The signer is
supplied locally through a file descriptor, verified against the selected
account; no environment secret is read automatically. Tests/CI never run this
network command. `canary.mjs` adds a cross-process exclusive operator lock and
persists one immutable synthetic ciphertext graph independently of receipts.
It refuses to overwrite or re-encrypt an existing fixture.

Prepare and preflight without a signer:

```sh
npm run canary --prefix research/bulletin-prototype -- prepare /private/tmp/dotify-bulletin-canary
npm run canary --prefix research/bulletin-prototype -- check /private/tmp/dotify-bulletin-canary
```

For the reviewed owner-authorized canary only, use a local signer pipe on
FD 3. Never place the phrase in an argument, tracked file, command output or CI.
For example, in zsh after the owner has temporarily activated the local signer:
Invoke Node directly for signing: `npm run` does not preserve the extra file
descriptor and must only be used for the unsigned commands above.

```zsh
# Keep shell tracing off. Always remove the temporary local signer afterward.
cd research/bulletin-prototype
trap 'launchctl unsetenv MNEMONIC' EXIT
node --import tsx canary.mjs publish /private/tmp/dotify-bulletin-canary --signer-fd 3 3< <(launchctl getenv MNEMONIC)
# Same graph, fresh read-only process: reuse all 19 receipts with no signer/write.
node --import tsx canary.mjs reconcile /private/tmp/dotify-bulletin-canary
node --import tsx canary.mjs verify /private/tmp/dotify-bulletin-canary
node --import tsx canary.mjs renew-now /private/tmp/dotify-bulletin-canary --signer-fd 3 3< <(launchctl getenv MNEMONIC)
node --import tsx canary.mjs verify /private/tmp/dotify-bulletin-canary
```

The canary is capped at 1 MiB of stored ciphertext and 40 attempted transactions
per session; this fixed graph plans 19 stores plus 19 one-off immediate renewals.
The wall-clock limit is 30 minutes per command. The initial 12-minute limit
expired after all 19 stores had finalized but before the root receipt was saved;
read-only `reconcile` recovered it with no new write. This sequential reference
writer is not a production throughput design.
`renew-now` uses `forceRenew`, not `renew` (which only registers a request for the
retention boundary) or recurring auto-renewal. Every dependency must show a later
finalized position, extended expiry and readable bytes before retention is
reported verified. This exercises immediate renewal, not a two-week soak.

The private directory contains `key.bin`, ciphertext, the nonce ledger and public
receipts. Never commit/upload it; preserve it to resume the exact graph. Abrupt
termination leaves `operator.lock` and possibly a pending submission. First prove
the recorded process is stopped, inspect finalized lookup and receipts, then
remove only the stale lock to resume. Do not erase a pending submission or nonce
ledger to force a retry. Unknown writes remain blocked unless finalized lookup
finds the expected block. No automatic stale-lock takeover or uncertain resend
is implemented. JavaScript buffers are cleared where practical, not guaranteed
secure memory erasure of SDK-internal or immutable string copies.

The isolated dependency audit currently reports high-severity `deepmerge-ts`
recursive-merge exhaustion through PAPI's CLI chain, and a moderate esbuild dev
server advisory through tsx. This tool uses neither that CLI nor a dev server;
no production dependency is changed. These advisories and the experimental SDK
still require review before any production integration.

Continue verifying Web and physical Product raw-CID retrieval, byte/AEAD equality,
real decodable audio, cold first sound and continuity against the current
baseline. Local fixture timings are not network or audible-start measurements.
The [live canary](../../docs/backlog/implementation/evidence/bulletin-network-canary-2026-10-29.md)
verified 19 stores, signer-free timeout recovery, selective decryption and 19
immediate renewals. Native delivery compatibility and a full retention-window/scheduled
renewal cycle remain gates. Sequential storage took roughly twelve minutes
for this small fixture; do not treat this writer as a production throughput design.

## Real AAC and Host reader, 2026-10-30

The next canary uses a reproducible, quiet eight-second generated chord, not an
artist recording. `aac-fixture.mjs` calls the production encoder directly: EBU
R128 loudness, FFmpeg AAC-LC at 96/160/320 kb/s, the permanent nonce ledger and
v3 authenticated encryption. No production format, key route or player is
changed. Each invocation creates a new private directory/key/nonce reservation;
never overwrite the earlier live canary or substitute its receipts.

Install the unchanged Web dependencies too (`npm ci --prefix web
--ignore-scripts` from the repository root). FFmpeg must be installed and on
PATH. Then, from `research/bulletin-prototype`:

```sh
npm test                       # Includes real AAC decrypt/decode, all three rates
npm run test:host               # Chromium control, not physical Host evidence
npm run prepare:aac -- /private/tmp/dotify-bulletin-aac-new
npm run canary -- check /private/tmp/dotify-bulletin-aac-new
npm run host -- /private/tmp/dotify-bulletin-aac-new
```

The prepared macOS fixture is 713,199 bytes / 16 blocks: 16 stores, with another
16 transactions and the same renewal byte budget reserved by preflight. FFmpeg
builds can produce different bytes/block counts; the command prints the exact
budget and refuses more than 1 MiB / 40 store-plus-renewal transactions. The
Linux test checks the bound, not equality to a macOS encoding. It verifies
non-silent full-length PCM decoded from **each** authenticated rendition. These
checks do not measure physical audibility or first sound.

New live writes still require the explicit local signer descriptor and
account/genesis/quota validation described above. A successful local prepare
is not a network upload. Use the existing `publish`, signer-free `reconcile`
and `verify` commands on this **new** directory after the operator activates
signing. Renewal is optional for this reader experiment; the preflight still
reserves a full cycle. Never automatically run a live command in CI.

The server binds **127.0.0.1:5278 only**, with fixed Host/origin checks,
no CORS and no-store responses. It serves only an explicitly selected private
generated-AAC fixture; the old non-AAC fixture is rejected. It makes that test
key available to the local page, never in a committed bundle or exported report.
Do not expose the server by tunnel, LAN binding, reverse proxy or public preview.
This operator fixture is not a content-key service or an access-control test.

Open `localhost:5278` in a new Polkadot Desktop tab. The
[official local-development instructions](https://docs.polkadot.com/apps/build/)
describe the Desktop localhost route; this does not publish or modify DotNS.
Choose the delivery explicitly:

- **Native Host preimage API:** pinned Product SDK `queryBytes` with
  `noReassemble: true` and an explicit ten-second lookup bound (thirty seconds for diagnosis). The shared `reader.mjs`
  verifies every raw/DAG-PB CID and resolves only the requested path. It never
  calls the local block endpoint, Pinata, a gateway or Dotify's API.
- **Native Host chain RPC (diagnostic):** obtains the approved genesis through
  the Host provider, verifies it with `chainSpec_v1_genesisHash`, then requests
  only `bitswap_v1_get`. It has a ten-second read bound, verifies every returned
  block and destroys its client on stop. A missing method is a failure, never a
  gateway fallback. The installed adapter rejects this content method.
- **Local control:** reads the same encrypted blocks from loopback, exercising
  the current Dotify manifest authenticator, media reader and persistent audio
  attachment. This checks the decoder without attributing local speed to Bulletin.

All modes inject only the ciphertext reader into the existing
`createStreamingPlayback`; standard MSE, ManagedMediaSource and bounded Blob
selection remain production code. Playback refuses the archival master's raw
CIDs. Page memory starts empty per attempt; Host/IPFS caches cannot be cleared
by this test and their state is recorded as unknown. There is no fallback
between delivery modes. First-playing and sixty-second whole-clip
watchdogs make failures visible instead of leaving an indefinite spinner.

Enter device/OS/Host and network conditions, start at low volume, then download
the report. It records source SHA/dirty state, root, transport, raw reads,
reader selection, playback events and stall timing. The **playing event is not
an audible-start measurement**; operator confirmation of hearing the chord is
separate, unchecked by default. The report excludes keys and signer material.
Close the test tab and stop the server after use.

A physical mobile run needs a separately reviewed distribution route. This
localhost-only tool cannot run on a phone by exposing the Mac's port; no public
preview, domain, Host permission change or mobile result is implied here. The
remaining gate is native raw retrieval plus actual audible startup/continuity,
compared with the current storage path on the same device and network. An
8-second chord cannot establish prolonged listening or production throughput.

### Live and installed-Host outcome

The [real-AAC evidence](../../docs/backlog/implementation/evidence/bulletin-aac-host-canary-2026-10-30.md)
records 16 finalized stores, nine decrypted audio objects and a removed signer.
Native Desktop 0.1.4-rc.3 returns no preimage block at 10 or 30 seconds; the
separate Host chain provider verifies genesis but rejects `bitswap_v1_get`.
The pinned SDK strips SHA-256 CIDs to bare digests while the inspected upstream
core expects BLAKE2b preimages. This is a compatibility lead, not a proof that
the installed binary equals upstream or that BLAKE2b playback already works.
Keep Pinata active. A new bounded BLAKE2b fixture or a CID-aware Host reader
needs a separate proof before production integration.
