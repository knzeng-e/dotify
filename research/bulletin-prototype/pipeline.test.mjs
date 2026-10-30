import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as dagPB from '@ipld/dag-pb';
import { buildDirectory } from './graph.mjs';
import { publish } from './publication.mjs';
import { publishPipelined } from './pipeline.mjs';
import { SimulatedChain } from './simulated-chain.mjs';
const budget = { maxBytes: 1024 * 1024, maxTransactions: 64 };
const deferred = () => {
  let resolve;
  const promise = new Promise(r => {
    resolve = r;
  });
  return { promise, resolve };
};
async function context(t) {
  const dir = await mkdtemp(join(tmpdir(), 'dotify-pipeline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const graph = await buildDirectory(Array.from({ length: 6 }, (_, i) => ({ path: `set/${i}.bin`, bytes: Buffer.alloc(10000 + i, i + 1) })));
  const chain = new SimulatedChain();
  let next = 10;
  chain.nextNonce = async () => next;
  const store = chain.store.bind(chain),
    nonces = [],
    entered = [];
  chain.store = async (block, { nonce }) => {
    nonces.push(nonce);
    entered.push(block.cid);
    next = Math.max(next, nonce + 1);
    if (block.codec === dagPB.code) for (const link of dagPB.decode(block.bytes).Links) assert.ok(await chain.lookup(link.Hash.toString()));
    if (block.cid === graph.root) assert.equal(chain.blocks.size, graph.blocks.length - 1);
    return store(block);
  };
  return { dir, graph, chain, entered, nonces, checkpoint: join(dir, 'pipeline') };
}

test('bounded pipeline overlaps direct writes only after durable nonce intents and keeps root last', async t => {
  const c = await context(t),
    gate = deferred(),
    entered = deferred();
  const store = c.chain.store;
  let active = 0,
    peak = 0;
  c.chain.store = async (block, options) => {
    active++;
    peak = Math.max(peak, active);
    if (active === 2) entered.resolve();
    await gate.promise;
    try {
      return await store(block, options);
    } finally {
      active--;
    }
  };
  const writing = publishPipelined(c.graph, c.chain, c.checkpoint, budget);
  await entered.promise;
  const pending = JSON.parse(await readFile(join(c.checkpoint, 'receipts.json'), 'utf8'));
  assert.deepEqual(
    Object.values(pending.pending).map(p => p.nonce),
    [10, 11]
  );
  assert.equal(c.entered.length, 0);
  gate.resolve();
  const result = await writing;
  assert.equal(peak, 2);
  assert.equal(result.peakInFlight, 2);
  assert.equal(c.entered.at(-1), c.graph.root);
  assert.deepEqual(
    c.nonces,
    c.graph.blocks.map((_, i) => 10 + i)
  );
  const again = await publishPipelined(c.graph, c.chain, c.checkpoint, budget);
  assert.equal(again.storedBlocks, 0);
  assert.equal(again.reusedBlocks, c.graph.blocks.length);
  assert.equal(c.entered.length, c.graph.blocks.length);
  await assert.rejects(publish(c.graph, c.chain, c.checkpoint, budget), /another graph/);
});

test('out-of-order completion never advances parents before every dependency verifies', async t => {
  const c = await context(t),
    gate = deferred(),
    secondDone = deferred();
  const store = c.chain.store;
  let calls = 0;
  c.chain.store = async (block, options) => {
    const i = calls++;
    if (i === 0) await gate.promise;
    const result = await store(block, options);
    if (i === 1) secondDone.resolve();
    return result;
  };
  const writing = publishPipelined(c.graph, c.chain, c.checkpoint, budget);
  await secondDone.promise;
  assert.ok(!c.chain.blocks.has(c.graph.root));
  gate.resolve();
  await writing;
  assert.equal(c.entered.at(-1), c.graph.root);
});

test('lost acknowledgement stops admission, drains a sibling, and resumes without duplicate writes', async t => {
  const c = await context(t),
    failed = deferred(),
    sibling = deferred(),
    entered = deferred();
  const store = c.chain.store;
  let calls = 0;
  c.chain.store = async (block, options) => {
    const i = calls++;
    if (i === 0) {
      await entered.promise;
      await store(block, options);
      failed.resolve();
      throw new Error('Lost acknowledgement');
    }
    entered.resolve();
    await sibling.promise;
    return store(block, options);
  };
  let settled = false;
  const writing = publishPipelined(c.graph, c.chain, c.checkpoint, budget).finally(() => {
    settled = true;
  });
  const rejected = assert.rejects(writing, /Lost acknowledgement/);
  await failed.promise;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, false);
  assert.equal(calls, 2);
  sibling.resolve();
  await rejected;
  const state = JSON.parse(await readFile(join(c.checkpoint, 'receipts.json'), 'utf8'));
  assert.equal(Object.keys(state.pending).length, 1);
  assert.equal(Object.keys(state.receipts).length, 1);
  c.chain.store = store;
  assert.equal((await publishPipelined(c.graph, c.chain, c.checkpoint, budget)).reusedBlocks, 2);
  assert.equal(new Set(c.entered).size, c.graph.blocks.length);
  assert.equal(c.entered.length, c.graph.blocks.length);
  assert.deepEqual(
    c.nonces,
    c.graph.blocks.map((_, i) => 10 + i)
  );
});

test('unknown submissions remain pending and cannot be replayed from a missing CID', async t => {
  const c = await context(t);
  c.chain.store = async () => {
    throw new Error('Unknown network outcome');
  };
  await assert.rejects(publishPipelined(c.graph, c.chain, c.checkpoint, budget), /Unknown network outcome/);
  const statePath = join(c.checkpoint, 'receipts.json');
  const state = JSON.parse(await readFile(statePath, 'utf8'));
  assert.ok(Object.keys(state.pending).length > 0);
  await assert.rejects(publishPipelined(c.graph, c.chain, c.checkpoint, budget), /Submission unresolved/);
  assert.deepEqual(JSON.parse(await readFile(statePath, 'utf8')).pending, state.pending);
  assert.equal(c.chain.stores.length, 0);
});

test('bounds, live quota and explicit nonce validation fail before any write', async t => {
  for (const options of [{ concurrency: 0 }, { concurrency: 5 }, { maxInFlightBytes: 100 }, { maxInFlightBytes: 2e6 }]) {
    const c = await context(t);
    await assert.rejects(publishPipelined(c.graph, c.chain, c.checkpoint, budget, options));
    assert.equal(c.entered.length, 0);
  }
  for (const change of [
    c => {
      c.chain.authorization.remainingTransactions = 0;
    },
    c => {
      c.chain.nextNonce = async () => -1;
    },
    c => {
      c.chain.authorization.expiresAt = 1001;
    }
  ]) {
    const c = await context(t);
    change(c);
    await assert.rejects(publishPipelined(c.graph, c.chain, c.checkpoint, budget));
    assert.equal(c.entered.length, 0);
  }
});

test('byte cap can serialize siblings even when concurrency permits more', async t => {
  const c = await context(t);
  const result = await publishPipelined(c.graph, c.chain, c.checkpoint, budget, { concurrency: 4, maxInFlightBytes: 15000 });
  assert.equal(result.peakInFlight, 1);
  assert.ok(result.peakInFlightBytes <= 15000);
});

test('checkpoint account corruption and unknown intents fail closed', async t => {
  const c = await context(t);
  await publishPipelined(c.graph, c.chain, c.checkpoint, budget);
  c.chain.account = 'another-account';
  await assert.rejects(publishPipelined(c.graph, c.chain, c.checkpoint, budget), /another graph/);
  c.chain.account = 'synthetic-research-account';
  const path = join(c.checkpoint, 'receipts.json'),
    state = JSON.parse(await readFile(path, 'utf8'));
  state.pending = { unexpected: { cid: 'unexpected', nonce: 1 } };
  await writeFile(path, JSON.stringify(state));
  await assert.rejects(publishPipelined(c.graph, c.chain, c.checkpoint, budget), /Invalid write intent/);
});

import { renameSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
test('journal write failure stops admission and still drains the already-submitted sibling', async t => {
  const c = await context(t),
    gate = deferred(),
    firstEntered = deferred();
  const store = c.chain.store;
  let calls = 0;
  c.chain.store = async (block, options) => {
    calls++;
    renameSync(join(c.checkpoint, 'receipts.json'), join(c.dir, 'durable-intent.json'));
    mkdirSync(join(c.checkpoint, 'receipts.json'));
    firstEntered.resolve();
    await gate.promise;
    return store(block, options);
  };
  let settled = false;
  const writing = publishPipelined(c.graph, c.chain, c.checkpoint, budget).finally(() => {
    settled = true;
  });
  const rejected = assert.rejects(writing);
  await firstEntered.promise;
  await new Promise(r => setImmediate(r));
  assert.equal(settled, false);
  assert.equal(calls, 1);
  gate.resolve();
  await rejected;
  assert.equal(calls, 1);
  assert.ok(!c.chain.blocks.has(c.graph.root));
});

test('expired dependencies cannot advance a parent or publish a ready root', async t => {
  const c = await context(t),
    store = c.chain.store;
  c.chain.store = async (block, options) => {
    const result = await store(block, options);
    c.chain.advance(30);
    return result;
  };
  await assert.rejects(publishPipelined(c.graph, c.chain, c.checkpoint, budget), /retention/);
  assert.ok(!c.chain.blocks.has(c.graph.root));
});

test('a fresh Node process reconciles multiple durable intents without duplicate remote writes', async t => {
  const c = await context(t),
    store = c.chain.store,
    entered = deferred();
  let calls = 0;
  c.chain.store = async (block, options) => {
    const i = calls++;
    if (i === 0) await entered.promise;
    else entered.resolve();
    await store(block, options);
    throw new Error('Lost acknowledgement');
  };
  await assert.rejects(publishPipelined(c.graph, c.chain, c.checkpoint, budget), /Lost acknowledgement/);
  const state = JSON.parse(await readFile(join(c.checkpoint, 'receipts.json'), 'utf8'));
  assert.equal(Object.keys(state.pending).length, 2);
  const snapshot = join(c.dir, 'model.json');
  await writeFile(
    snapshot,
    JSON.stringify({
      pipeline: true,
      nextNonce: state.nextNonce,
      graph: { ...c.graph, blocks: c.graph.blocks.map(b => ({ ...b, bytes: Buffer.from(b.bytes).toString('base64') })) },
      stores: c.chain.stores,
      blocks: [...c.chain.blocks].map(([id, b]) => [id, { ...b, bytes: b.bytes.toString('base64') }])
    })
  );
  const child = spawnSync(process.execPath, [fileURLToPath(new URL('./resume-fixture.mjs', import.meta.url)), snapshot, c.checkpoint], {
    encoding: 'utf8',
    timeout: 30000,
    env: { PATH: process.env.PATH, TMPDIR: tmpdir() }
  });
  assert.equal(child.status, 0, child.stderr || String(child.error));
  const result = JSON.parse(child.stdout);
  assert.equal(result.reusedBlocks, 2);
  assert.equal(result.totalStoreCalls, c.graph.blocks.length);
  assert.equal(result.networkWrites, 0);
});

test('a null rejection cannot erase an uncertain nonce intent', async t => {
  const c = await context(t);
  c.chain.store = async () => {
    throw null;
  };
  await assert.rejects(publishPipelined(c.graph, c.chain, c.checkpoint, budget), /Unknown publication failure/);
  const state = JSON.parse(await readFile(join(c.checkpoint, 'receipts.json'), 'utf8'));
  assert.ok(Object.keys(state.pending).length > 0);
  await assert.rejects(publishPipelined(c.graph, c.chain, c.checkpoint, budget), /Submission unresolved/);
});
