import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fixtureProfile } from './fixture-profile.mjs';
import { generatedWav, encryptedContinuityFixture } from './aac-fixture.mjs';
import { prepare, loadFixture } from './canary.mjs';
import { prepareReaddressedAac } from './readdress-aac.mjs';
import { mobilePayload } from './mobile-package.mjs';
import { buildDirectory, verifyGraph } from './graph.mjs';
import { planPipeline } from './pipeline-plan.mjs';
import { parseArguments } from './pipeline-canary.mjs';
import { main as continuity } from './continuity.mjs';
import { readOnlyProvider, probe } from './writer-probe.mjs';
import { GENESIS } from './graph.mjs';
import { SimulatedChain } from './simulated-chain.mjs';
import { publishPipelined } from './pipeline.mjs';
const options = { profile: 'continuity' };
test('larger research limits require explicit selection; short limits and block bounds stay unchanged', async t => {
  assert.deepEqual(fixtureProfile().budget, { maxBytes: 1048576, maxTransactions: 40 });
  assert.equal(fixtureProfile().attemptLimitMs, 60000);
  assert.equal(fixtureProfile('continuity').durationSeconds, 64);
  assert.ok(Object.isFrozen(fixtureProfile('continuity').budget));
  for (const value of ['unknown', '', {}, null, '__proto__']) assert.throws(() => fixtureProfile(value));
  assert.throws(() => generatedWav(65));
  assert.equal(parseArguments(['plan', 'fixture']).profile, 'short');
  assert.equal(parseArguments(['plan', 'fixture', '--profile', 'continuity']).profile, 'continuity');
  for (const extra of [['--profile'], ['--profile', 'unknown'], ['--profile', 'short', '--profile', 'continuity']])
    assert.throws(() => parseArguments(['plan', 'fixture', ...extra]));
  const files = Array.from({ length: 25 }, (_, i) => ({ path: `${i}.bin`, bytes: Buffer.alloc(200000, i) }));
  await assert.rejects(buildDirectory(files), /graph budget/);
  const graph = await buildDirectory(files, options);
  assert.ok(graph.blocks.every(block => block.bytes.length <= 512 * 1024));
  await assert.rejects(verifyGraph(graph), /byte budget/);
  await assert.rejects(planPipeline(graph), /byte budget/);
  assert.equal((await planPipeline(graph, options)).networkWrites, 0);
  const directory = await mkdtemp(join(tmpdir(), 'dotify-continuity-pipeline-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const chain = new SimulatedChain();
  let nonce = 0;
  chain.nextNonce = async () => nonce;
  const store = chain.store.bind(chain);
  chain.store = async (block, { nonce: reserved }) => {
    nonce = Math.max(nonce, reserved + 1);
    return store(block);
  };
  await assert.rejects(publishPipelined(graph, chain, directory, fixtureProfile('continuity').budget), /byte budget/);
  await assert.rejects(publishPipelined(graph, chain, directory, fixtureProfile().budget, options), /budget/);
  assert.equal(chain.stores.length, 0);
  const published = await publishPipelined(graph, chain, directory, fixtureProfile('continuity').budget, options);
  assert.equal(published.storedBlocks, graph.blocks.length);
  assert.equal(chain.stores.at(-1), graph.root);
  assert.equal((await publishPipelined(graph, chain, directory, fixtureProfile('continuity').budget, options)).storedBlocks, 0);
});
test('64-second preparation proves source, unchanged three-rendition AEAD, explicit budgets and archive exclusion', { timeout: 60000 }, async t => {
  const parent = await mkdtemp(join(tmpdir(), 'dotify-continuity-proof-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const source = join(parent, 'source'),
    blake = join(parent, 'blake');
  await prepare(source, encryptedContinuityFixture, options);
  await assert.rejects(prepare(source, encryptedContinuityFixture, options), /EEXIST/);
  const result = await prepareReaddressedAac(source, blake, options);
  assert.equal(result.verified.masterFetched, false);
  assert.equal(result.verified.verifiedObjects, 51);
  await assert.rejects(loadFixture(blake)); // Large fixture cannot opt its caller into new limits.
  const plan = await continuity(['plan', blake]);
  assert.equal(plan.durationSeconds, 64);
  assert.deepEqual(plan.bitratesKbps, [96, 160, 320]);
  assert.equal(plan.stores, result.blocks);
  assert.equal(plan.oneRenewalReserve.transactions, result.blocks);
  assert.equal(plan.networkWrites, 0);
  assert.equal(plan.distributionBudgetIncluded, false);
  await assert.rejects(mobilePayload(blake, options), /acknowledgement|allow-public-generated-key/);
  const payload = await mobilePayload(blake, { ...options, acknowledgePublicTestKey: true });
  assert.equal(payload.session.fixtureProfile, 'continuity');
  assert.equal(payload.session.audioProof.durationSeconds, 64);
  assert.ok(payload.session.archiveRawCids.every(cid => !payload.controlBlocks[cid]));
  assert.ok(!JSON.stringify(payload).includes(parent));
  const path = join(blake, 'fixture.json'),
    saved = JSON.parse(await readFile(path, 'utf8'));
  saved.audioProof.durationSeconds = 8;
  await writeFile(path, JSON.stringify(saved));
  await assert.rejects(loadFixture(blake, options));
  saved.audioProof.durationSeconds = 64;
  saved.audioProof.sourceSha256 = 'forged';
  await writeFile(path, JSON.stringify(saved));
  await assert.rejects(loadFixture(blake, options), /source identity/);
});
test('read-only compatibility probe refuses every non-allowlisted RPC and never submits or selects a signer', async () => {
  const sent = [],
    methods = new Set();
  const connection = readOnlyProvider(() => ({ send: message => sent.push(message), disconnect() {} }), methods)(() => {});
  connection.send({ method: 'chainHead_v1_follow', params: [] });
  for (const method of ['transaction_v1_broadcast', 'author_submitExtrinsic', 'transactionWatch_v1_submitAndWatch', 'unknown'])
    assert.throws(() => connection.send({ method }), /refused RPC/);
  assert.equal(sent.length, 1);
  let creates = 0,
    released = false;
  const client = {
    _request: async () => GENESIS,
    getFinalizedBlock: async () => ({ hash: 'test', number: 42 }),
    hodlBlock: () => () => {
      released = true;
    },
    getUnsafeApi: () => ({
      apis: { AccountNonceApi: { account_nonce: async () => 17 } },
      tx: {
        TransactionStorage: {
          store_with_cid_config: input => ({
            async create(creator, options) {
              assert.equal(typeof creator, 'function'); // Actual pinned getFakeTxCreator, not a string/PAPI 2 object.
              assert.deepEqual(options, { nonce: 17 });
              assert.equal(input.cid.hashing.type, 'Blake2b256');
              creates++;
              return new Uint8Array([1, 2]);
            }
          })
        }
      }
    })
  };
  const result = await probe(client);
  assert.equal(creates, 1);
  assert.equal(released, true);
  assert.equal(result.networkWrites, 0);
  assert.equal(result.realSignatures, 0);
  assert.equal(result.storageQuotaConsumed, 0);
  await assert.rejects(probe({ ...client, _request: async () => 'wrong' }), /Wrong Bulletin/);
});
