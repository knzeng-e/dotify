# Bulletin segmented-media prototype

**Isolated research. Not a deployable storage adapter.** Refs #288/#287;
follows [the feasibility study](https://github.com/knzeng-e/dotify/pull/353).
Pinata, the deployed player and native permissions remain unchanged.

This implementation builds a real named UnixFS directory with SHA-256/raw and
DAG-PB blocks. It uses the existing Dotify v3 encryptor, durable nonce reservation,
manifest validation and AEAD decoder on public synthetic byte patterns. The
patterns are not AAC and do not contain artist music. A random temporary key
is used only inside the fixture and wiped at the end; it is never checkpointed.
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
   Product SDK 0.39.0. This exercises that interface, not an actual Host.
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

## Network canary gate

The local results provide exact graph bytes/block count for a future canary.
Before any live write, explicitly select a user-owned authorized account,
verify its signer/account and the pinned DevNet genesis, and approve the graph's
storage plus one-cycle quota budget. The owner has chosen to reuse the DotNS
account for this bounded manual canary. DotNS ownership does not itself grant
Bulletin storage authorization or quota. Keep signing local; never place that
key in the frontend or a backend worker, and do not change the DotNS record.
Do not use the public deployment pool for media. A separate storage account is
recommended for unattended production renewal so it cannot control the domain;
it is not a Bulletin requirement for this manual test.
Build the missing live lookup/authorization/renewal transport against finalized
state, including pending transaction/request reconciliation; the simulation is
not that transport.

Then verify Web and physical Product raw-CID retrieval, byte/AEAD equality,
real decodable audio, cold first sound and continuity against the current
baseline. Local fixture timings are not network or audible-start measurements.
Native API support and a full live retention/renewal cycle remain unverified.
