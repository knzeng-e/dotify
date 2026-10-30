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
generated-AAC fixture, or the exact public addressing marker below; the old non-AAC fixture is rejected. It makes that test
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
core expects BLAKE2b preimages. This initial compatibility lead did not establish the exact installed core
revision. The controlled marker and native BLAKE2b AAC follow-up below now
confirm that the alternative addressing works on Desktop. Keep Pinata active:
mobile delivery, cold audible-start evidence and production integration remain
separate gates.

## Controlled addressing comparison

`addressing-fixture.mjs` builds **three blocks / 387 bytes**: identical public
marker bytes under SHA-256/raw and BLAKE2b-256/raw, plus a BLAKE2b-256 UnixFS
directory linking both names. There is no content key or artist recording.
The exact deterministic fixture is checked before load or write; its separate
budget admits at most 2 KiB and six store-plus-renewal transactions. Only
three stores are planned. The general canary's account/genesis checks, finalized
receipts, root-last ordering, operator lease and uncertain-write reconciliation
remain in force. Both hash algorithms are verified from the CID; all other
hashes, truncated digests, corruption and oversized blocks are refused.

```sh
npm run prepare:addressing -- /private/tmp/dotify-addressing-new
npm run canary -- check /private/tmp/dotify-addressing-new
# After explicit local signer activation, use the direct Node publish command
# above on this directory; do not wrap signing in npm. Remove MNEMONIC afterwards.
npm run canary -- verify /private/tmp/dotify-addressing-new
npm run host -- /private/tmp/dotify-addressing-new
```

Open `localhost:5278/addressing.html` in Desktop. Run native preimage mode,
then export the report before leaving. Five cases distinguish the two raw
hashes, the raw directory, and each named path. Ten-second per-block bounds
and a 25-second per-case watchdog prevent indefinite loading. Native mode
never uses the local reader or an HTTP gateway. A browser local control checks
validation/export only. The marker server exposes only public proof metadata,
returns 404 for the audio session endpoint, and retains the existing loopback
and origin restrictions. Reports include source identity, unknown Host cache
state, exact CIDs, successful reads and typed failures.

The 2026-10-30 preflight confirmed 46 transactions remaining and the correct
network/account; it submitted nothing. Current local validation: 38 Node tests and six
Host-harness checks. The [installed-Host results](../../docs/backlog/implementation/evidence/bulletin-addressing-canary-2026-10-30.md)
show BLAKE2b raw/directory/path reads succeed while the identical SHA-256
payload times out; both paths were independently verified through Node RPC. Success here would establish addressing compatibility,
not AAC playback, audible first sound, mobile support or production readiness.

### Readdress the generated AAC ciphertext

After the marker succeeds, `readdress-aac.mjs PRIVATE_SOURCE NEW_PRIVATE_TARGET`
reuses the **generated eight-second chord only**. It verifies the source identity
and every decrypted audio object, rewrites all block hashes and directory/file
links to BLAKE2b, and updates cumulative DAG link sizes. Raw ciphertext, manifest,
AEAD scope and the generated content key stay unchanged. No encryption is run,
no nonce ledger is copied/reset, and the source fixture is never modified.
The new target must not exist; retain the original permanent ledger. This tool
is an isolated comparison, not a production migration or a new publisher.

```sh
npm run prepare:blake-aac -- /private/tmp/EXISTING_GENERATED_AAC /private/tmp/NEW_BLAKE_AAC
npm run canary -- check /private/tmp/NEW_BLAKE_AAC
# Publish only after approval of this separate exact budget and signer activation.
npm run host -- /private/tmp/NEW_BLAKE_AAC
```

The prepared macOS target has 16 blocks / 713,229 bytes (30 more directory bytes
than SHA-256), with a full 16-renewal reserve checked before its 16 planned
stores. Local verification authenticates all nine audio objects. The [native AAC report](../../docs/backlog/implementation/evidence/bulletin-blake-aac-canary-2026-10-30.md)
now records all 16 stores, nine authenticated readback objects, and actual
Desktop playback ending at eight seconds. First playing event: 2,052 ms, with
unknown Host caches and no physical audibility claim. The signer was removed;
27 transactions remain. Mobile, cold first sound, longer listening and scalable
publication remain gates. Production storage is unchanged.

## Opt-in bounded publication

`pipeline-canary.mjs` builds on the native AAC reader merged in
[#355](https://github.com/knzeng-e/dotify/pull/355). It does not activate an
app storage adapter.

The pipeline overlaps **two direct transactions by default**, at most four,
with at most 512 KiB in flight by default (hard ceiling 1 MiB). Each account
nonce is explicit and written to the durable journal **before** submission.
Parent directories wait for verified child receipts; the root waits for the
whole graph. Parent admission rechecks the remaining retention margin. CID,
codec, size, finalized storage coordinates and raw bytes must all verify.
The `Stored` event supplies the storage index; the extrinsic's index is not
interchangeable with it.

The CLI owns one fixture lease and a local account lease shared by its own
invocations. `--exclusive-account` confirms the operator has stopped other
wallets, DotNS publishers and the old sequential command using that account.
The local lock cannot control those external writers. A separately owned
storage signer remains the production direction; this tool never loads an
environment phrase or selects a fallback signer.

On any uncertain write, stop new admissions, drain already-started writes and
retain every unresolved CID/nonce intent. Admission checks for sibling failure
after its retention lookup and journal persistence. If the latest intent was
persisted but its store was never invoked, only that reservation is removed
and the nonce cursor is restored durably. If that save fails, the journal may
conservatively retain the unsent intent; stop for operator reconciliation.
Restart rechecks finalized chain
metadata and raw bytes. A missing CID, a rejected nonce or a timeout is **not**
permission to resend or fill a nonce gap. Even a definitive pre-submission
error can leave later nonces in flight; this prototype leaves the gap for
explicit operator reconciliation. There is no automatic retry/re-signing.
Never erase a journal or start a fresh one to bypass an unresolved outcome.

The pipeline uses `pipeline-checkpoint/` and schema
`dotify.bulletin.pipeline.v1`; sequential/renewal tools reject this journal.
The old `checkpoint/` and `publish` behavior are preserved. Do not switch
modes on an unfinished graph. Recurring renewal and pipeline-journal renewal
are not implemented; retain encrypted source data and verified public receipt
coordinates, and keep this a short bounded experiment.

```sh
npm run test:pipeline --prefix research/bulletin-prototype
npm run measure:pipeline --prefix research/bulletin-prototype
npm run pipeline --prefix research/bulletin-prototype -- plan PRIVATE_DIRECTORY
npm run pipeline --prefix research/bulletin-prototype -- check PRIVATE_DIRECTORY
```

`plan` is offline. `check` reads quota and the finalized account nonce, without
signing; it does not declare pending outcomes resolved. Both initial publication
and retry validate the full graph's storage plus one-renewal budget. The
`reconcile` command is strictly read-only and refuses missing/unresolved data.
For an explicitly authorized manual write, from this package directory:

```sh
# Activate the owner-selected signer locally first; never paste it into chat.
trap 'launchctl unsetenv MNEMONIC' EXIT HUP INT TERM
node --import tsx pipeline-canary.mjs publish PRIVATE_DIRECTORY \
  --concurrency 2 --exclusive-account --signer-fd 3 \
  3< <(launchctl getenv MNEMONIC)
```

Run Node directly: npm does not preserve the private descriptor. A hard exit
leaves leases/intents for manual audit; remove a stale lock only after proving
its process is stopped and reconciling every pending transaction. Normal exits
release locks, but they do not claim a timed-out signed transaction was cancelled.

Atomic `Utility.batch_all` was considered and rejected for storage: the
[inspected upstream extension](https://github.com/paritytech/polkadot-bulletin-chain/blob/e0190de902b41b820844ec530ec21f5af04d1f11/pallets/transaction-storage/src/extension.rs#L167)
rejects nested store calls because node-side indexing expects the data at the
end of a direct extrinsic. Metadata exposing a batch call does not establish
storage compatibility. `inspect:pipeline` is a read-only inventory; it neither
signs nor attempts a rejected batch.

The [evidence and mobile handoff](../../docs/backlog/implementation/evidence/bulletin-bounded-publication-2026-10-30.md)
distinguish offline overlap/recovery proof from actual network throughput.
No network speedup, native mobile playback, retention cycle, free storage,
production readiness, new domain or deployment is claimed here.

## Standalone mobile diagnostic preparation

The loopback reader above cannot reach a phone safely. `mobile-package.mjs`
instead builds a separate static Product using the **already generated BLAKE2b
AAC fixture**. It authenticates the manifest and all playback objects, decrypts
the archival master locally and compares its exact bytes with `generatedWav()`.
A label claiming “generated audio” is insufficient. Non-generated masters,
SHA-256 graphs, loose key permissions and overwrite attempts are refused.

The build deliberately embeds that generated test key and the encrypted playback
blocks for an explicitly selected **bundled decoder control**, loaded as a
separate chunk only when that control is chosen. Archival raw
blocks, operator files, signing credentials and encryption ledgers are excluded.
The key is public test data, not an artist entitlement. Native mode always uses
Host preimage reads and has no HTTP or bundled-control fallback. Both modes use
`host/player.ts` and the unchanged production streaming player/AEAD verifier.

```sh
npm run test:mobile --prefix research/bulletin-prototype
npm run test:mobile-browser --prefix research/bulletin-prototype
npm run build:mobile --prefix research/bulletin-prototype -- \
  /private/tmp/EXISTING_GENERATED_BLAKE_AAC /private/tmp/NEW_DIAGNOSTIC_OUTPUT \
  --allow-public-generated-key
```

`NEW_DIAGNOSTIC_OUTPUT` must not exist. The command is local-only, reads no
`.env` file, requests no signer and uploads nothing. `diagnostic-build.json`
records the exact source revision/dirty state and root, with no content key.
The output is not a Dotify app release: **do not deploy it over `dotify-test01.dot`**.
The owner-approved [October 30 diagnostic publication](../../docs/backlog/implementation/evidence/bulletin-mobile-publication-2026-10-30.md)
is `dotify-bulletin-lab.dot`, Product `[0,1,0]`. Its current artifact/records are
verified. Two owner-supplied native mobile reports complete the generated clip
with audio heard (first `playing`: 1,195 / 117 ms); Host cache state is unknown.
The paired decoder control and cold audible-start evidence remain pending.
Do not republish or renew
this candidate implicitly. The research writer's PAPI 3 transaction-creator
integration needs a matching live-adapter check before a throughput trial; this
manual distribution used the deploy tool's PAPI 2.2.2 adapter.

Choose and approve a separate diagnostic address and verify its deployment/Host
profile before signing any publication. No domain is assumed available or owned.

The interface starts in native mode and offers a separately labeled decoder
control, audio pause/seek/stop and optional device/network notes. First-playing
and whole-attempt limits remain 45 and 60 seconds; deliberate pauses/background
checks must fit that bounded eight-second experiment. Background visibility is
observed without stopping healthy playback; page exit stops the test. On iOS,
suspension can delay timers. A missing event or `playing` event is not a physical
audibility measurement, and an eight-second test cannot prove prolonged listening.

Up to five reports (at most 256 KiB total) are saved only in that diagnostic origin's `localStorage`.
They record read counts/timing, media/visibility events, exact source/root,
reader choice and explicit audibility confirmation. Preparing/playing records
found on reload become interrupted with their previous observed state retained.
Reports have a bounded allowlisted projection: no key, raw audio, signer or
arbitrary metadata is persisted. Nothing is transmitted automatically. Users
can inspect/select text for manual copying when Host downloads fail, or clear
history with confirmation. Blocked/full/corrupt storage displays a warning and
keeps recording in page memory; it cannot promise persistence after the page closes.
Device notes/user agent and public CIDs are diagnostic data, so inspect before
sharing. History eviction is disclosed; keep important reports separately.

Automated browser controls test the built bundle and persistence, not installed
mobile Host support. Native mobile first sound, paired delivery measurements,
long listening and production storage activation remain open.
