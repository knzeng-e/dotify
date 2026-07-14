# Registry owner-guard remediation

## Purpose

This runbook repairs the legacy `musicRegRegister` authorization boundary
without moving existing SmartRuntime proxies or their storage.

> Active deployment status, 2026-07-12: new artist publication has moved to the
> fresh factory `0x9337287a194dfd8b53939eee1890b3f4ec0f8b0d` and directory
> `0xda2761fea6f0871ed44ec719860fddb51b115be8`. Read-only audit at finalized
> block `10904607` verified the corrected registry facet hash and found zero
> finalized or pending runtimes. The legacy deployment below remains documented
> for historical evidence and should not be reused for new publication.

The legacy Paseo system is **quarantined for artist publication** until all
three gates are complete:

1. every existing runtime routes `musicRegRegister` to the corrected facet;
2. a new factory and directory create future runtimes from the corrected facet;
3. the existing catalog remains discoverable after the directory cutover.

Listening and room playback do not depend on registering a new work and may
remain available while publication is paused.

## Confirmed state

Read-only audit at Paseo block `10877675` on 2026-07-12:

| Surface                    | Current state                                                        |
| -------------------------- | -------------------------------------------------------------------- |
| Chain ID                   | `420420417`                                                          |
| Legacy factory             | `0x824ea33000e5e2ca9ddad030befa7331b38c41ce`                         |
| Legacy directory           | `0x7f90d15b5ec5f3a668e4dc14def3fe1c876dde0c`                         |
| Factory registry facet     | `0xfd24ad42d86f71852e6ce40ac455a560060a4d8d`                         |
| Deployed facet code hash   | `0xb22fe0b30db36cd8afdabe1ec8a9abff5259fc71d965c884911c8ea2e302adec` |
| Corrected source code hash | `0xa509d4ccc5206974069bb858faba07e42b1f7b9b3fd217adc7bb40a8f714d788` |
| Finalized runtimes         | 2, both still vulnerable                                             |
| Pending runtimes found     | 0                                                                    |
| Existing tracks            | 3/3 owned by their runtime owner; no obvious outsider injection      |

An outsider `eth_call` can still simulate a successful registration on both
finalized runtimes. The call is read-only and was never broadcast.

## Safety model

- The hotfix replaces only selector `0xfcb6cd7e` (`musicRegRegister`).
- The other nine registry selectors remain on their current facet, reducing the
  upgrade blast radius.
- `action = Replace (1)`, `init = address(0)`, and `initCalldata = 0x`.
- Every runtime owner signs only their own cut. Never collect artist keys.
- The target bytecode must exactly match the locally compiled corrected
  `MusicRegistryPallet` artifact.
- Dry-run, plan digest, owner simulation, state snapshot, and post-cut checks are
  mandatory.
- The tools never rewrite `deployments.json` during facet remediation. Changing
  that file cannot change the immutable facet stored in the current factory.

## 1. Quarantine publication

Before deploying anything:

- pause artist runtime creation and release publication in hosted interfaces;
- communicate that existing listening and rooms remain available;
- do not advance any pending runtime through the old factory;
- record the current block, factory, directory, runtime owners, track hashes,
  token owners, and selector routes.

The current production build reads a checked-in deployment safety attestation
and disables runtime creation and release registration while this gate is open.
It does not impose a blanket freeze on management of existing releases. Direct
on-chain calls cannot be paused by the frontend: an outsider can still register
directly through an unpatched runtime, and the old factory can still create
another vulnerable runtime. Monitor the catalog against the recorded snapshot
throughout the remediation, investigate any new record, and treat the old
factory as legacy.

The attestation reopens publication only when it contains a captured block hash,
verified factory/directory pairing, complete pending-runtime discovery, exact
corrected registry bytecode for the future factory, full existing-runtime and
track coverage, and catalog-cutover evidence. A missing field fails closed.

## 2. Run the read-only audit

```bash
cd contracts/evm
npm run compile
npm run registry:audit:testnet
```

Compile from the reviewed source before trusting any artifact hash. Repeat the
compile if the source tree, compiler configuration, or locked dependencies
change between audit and deployment; never approve a facet from a stale
`artifacts/` directory. Each remediation task also runs Hardhat compilation
before reading an artifact, so a compile failure stops the task.

The command:

- needs no wallet;
- pins all reads to one block and checks the configured facet bytecode;
- checks that the factory and directory point to each other;
- enumerates finalized runtimes from `ArtistDirectory`;
- discovers pending runtimes from factory events;
- verifies directory artist/runtime ownership and all ten live registry routes;
- audits track artists against the runtime owner;
- simulates outsider registration using `eth_call` only.

Pending-runtime discovery is mandatory and fails closed when the RPC cannot
serve the historical reads or event range. Exit code `2` is expected while the
configured factory, pairing, pending-runtime evidence, or any runtime remains
unsafe. Preserve the JSON output as pre-change evidence.

## 3. Deploy only the corrected facet

First obtain the expected chain and code hash without broadcasting:

```bash
npm run compile
npm run registry:deploy-facet:testnet
```

Then explicitly confirm both values:

```bash
npx hardhat vars set PRIVATE_KEY
npm run registry:deploy-facet:testnet -- \
  --execute \
  --confirm-chain-id 420420417 \
  --confirm-code-hash 0xa509d4ccc5206974069bb858faba07e42b1f7b9b3fd217adc7bb40a8f714d788 \
  --out ../../deployments/upgrades/registry-owner-guard-420420417.json
```

This is the only step the system deployer performs for existing runtimes. It
deploys a stateless facet but does not activate it anywhere. Verify the address,
deployment transaction, bytecode hash, and explorer source before sharing the
address with artists. The checked-in task validates the bytecode hash but source
verification is a separate explorer operation:

```bash
npx hardhat verify --network polkadotTestnet \
  --contract contracts/pallets/MusicRegistryPallet.sol:MusicRegistryPallet \
  0xCORRECTED_FACET
```

Archive the deployment transaction hash and verification result alongside the
JSON manifest. The task reserves that path before broadcasting, records the
deployer and nonce before submission, signs the transaction, persists the hash
derived from the signed bytes before broadcast, waits for the receipt block to
become finalized, reloads the canonical receipt, and then records bytecode
verification. If the file remains in a pre-broadcast, `signed-before-broadcast`,
or `broadcast` state, inspect the deployer account, nonce, transaction hash,
and chain before deciding whether a retry is safe. Remove the deployer key from
Hardhat's local variable store when this operation is complete:

```bash
npx hardhat vars delete PRIVATE_KEY
```

Do **not** use `npm run deploy:testnet` for this hotfix. That command deploys a
whole system and rewrites the active address files before catalog migration and
cutover have been approved.

## 4. Prepare one owner plan per runtime

Run this once for each runtime, substituting the newly deployed facet:

```bash
npm run registry:upgrade:testnet -- \
  --runtime 0x8E02c15D9f507b4633cEbc7175CDA44F48Ab3bb4 \
  --facet 0xCORRECTED_FACET \
  --out ../../deployments/upgrades/runtime-8e02-registry-plan.json
```

The default is dry-run. The task refuses a target whose code hash differs from
the corrected artifact, pins its catalog and routes to one block, preserves the
other nine routes, encodes the one-selector `diamondCut`, and simulates it as the
current owner. It writes the plan only after simulation succeeds. The stable
owner-confirmation digest binds the security state; a separate evidence digest
also binds the capture block and hash.

Repeat for:

- `0x8E02c15D9f507b4633cEbc7175CDA44F48Ab3bb4`, owner
  `0xC3571714248588C6E19cDECe2778B75341b2c288`;
- `0x1bc11bE8231e1F4e1668eCB1b19C4FBc77238F55`, owner
  `0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac`.

If the owner is a multisig or another contract, submit the generated calldata
through its governance. The task deliberately refuses to impersonate a
contractual owner.

## 5. Apply from the artist owner's machine

The artist configures their own key locally:

```bash
npx hardhat vars set PRIVATE_KEY
```

Then they rerun the exact fresh plan with its digest:

```bash
npm run registry:upgrade:testnet -- \
  --runtime 0xRUNTIME \
  --facet 0xCORRECTED_FACET \
  --execute \
  --confirm-plan 0xFRESH_PLAN_DIGEST \
  --out ../../deployments/upgrades/runtime-0xRUNTIME-execution.json
```

The task refuses to broadcast unless the configured signer is the current
runtime owner and a fresh evidence path is available. It simulates the exact
calldata again, records the owner nonce, persists the hash derived from the
signed bytes before broadcast, waits for the receipt block to become finalized,
reloads the canonical receipt, and verifies:

- `musicRegRegister` routes to the corrected facet;
- the nine untouched selector routes did not move;
- runtime owner, track records, token owners, and royalty splits match the
  pre-cut snapshot;
- outsider registration reverts specifically with `LibDiamond: not owner`.

Store the transaction hash, receipt block, plan, and verification output.
Then remove the artist key from Hardhat's local variable store:

```bash
npx hardhat vars delete PRIVATE_KEY
```

## 6. Re-audit existing runtimes

```bash
npm run registry:audit:testnet
```

Expected intermediate result:

- both runtime probes are `protected`;
- no foreign track appears;
- no pending runtime exists;
- the command still exits `2` because the configured factory remains bound to
  the old facet.

Do not reopen publication at this intermediate state: the old factory would
still create vulnerable future runtimes.

## 7. Replace the future-runtime generation

The current `ArtistRuntimeFactory.registryPallet` is immutable and the current
`ArtistDirectory.setFactory` is one-shot. This phase is currently blocked on a
new directory import design and candidate-only deployment tooling. Neither is
implemented by the facet-remediation tasks, and `npm run deploy:testnet` is not
a candidate command because it rewrites the active address books.

Before any active configuration changes, implement a separate workflow that can
deploy and record a candidate without modifying `deployments.json` or
`web/src/shared/config/deployments.ts`. A safe future system then needs:

1. a candidate directory and factory using the corrected registry;
2. a canary artist runtime that completes every bootstrap stage;
3. a successful owner registration and rejected outsider probe;
4. an explicit way for the new directory/catalog index to include the two
   existing upgraded runtimes;
5. only then, a coordinated, reversible configuration cutover across frontend,
   API, deployment manifests, hosted environment variables, and public
   documentation, with an explicit rollback point.

Prefer a `DirectoryV2` import/migration design with validation and idempotence.
Do not silently abandon the existing catalog by switching to an empty directory.

## 8. Legacy completion gate

Legacy publication may reopen only when all boxes are true:

- [ ] Corrected facet deployed and source-verified.
- [ ] Existing runtime `0x8E02…3bb4` upgraded and verified.
- [ ] Existing runtime `0x1bc1…8F55` upgraded and verified.
- [x] Existing tracks audited: 3/3 currently match runtime owners.
- [x] No pending runtime found at audit block `10877675`.
- [x] Fresh factory/directory deployed for new publication.
- [x] Fresh factory/directory audit verified.
- [ ] Existing catalog migration/import verified for the legacy catalog.
- [ ] Legacy active address cutover and production smoke tests completed.
- [x] Deployment safety attestation updated from verified evidence for the
      fresh active deployment.

Until then, the legacy deployment remains unsafe for new artist publication.
The fresh active deployment is covered by the checked-in publication safety
attestation.
