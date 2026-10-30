import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AsyncBulletinClient, HashAlgorithm, StoreBuilder } from '@parity/bulletin-sdk';
import { encryptedFixture } from './fixture.mjs';
import { buildDirectory, readPath, hostBlockReader, verifyBlock } from './graph.mjs';
import { publish, requestRenewal, verifyRenewal } from './publication.mjs';
import { sdkBlockStore } from './sdk-store.mjs';
import { SimulatedChain } from './simulated-chain.mjs';
import { parseStreamingManifest, verifyStreamingManifest, decryptStreamingObject } from '../../services/api/src/services/streamingFormat.ts';

const budget = { maxTransactions: 64, maxBytes: 4 * 1024 * 1024 };
async function context(t) {
  const directory = await mkdtemp(join(tmpdir(), 'dotify-bulletin-prototype-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const fixture = await encryptedFixture(directory);
  t.after(() => fixture.key.fill(0));
  const graph = await buildDirectory(fixture.files);
  const chain = new SimulatedChain();
  const checkpoint = join(directory, 'checkpoint');
  return { ...fixture, directory, graph, chain, checkpoint };
}

test('real v3 manifest and first segment decrypt through raw Host CID reads without fetching the master', async t => {
  const c = await context(t);
  await publish(c.graph, c.chain, c.checkpoint, budget);
  c.chain.reads.length = 0;
  const options = [];
  const reader = hostBlockReader({
    fetchBytes: async (cid, opts) => {
      options.push(opts);
      return { ok: true, value: await c.chain.readBlock(cid) };
    }
  });
  const m = await readPath(reader, c.graph.root, 'manifest.json');
  const manifest = parseStreamingManifest(m.bytes);
  verifyStreamingManifest(manifest, c.key, c.scope);
  for (const bitrate of [96, 160, 320]) {
    const rendition = manifest.renditions.find(r => r.bitrateKbps === bitrate);
    for (const object of [rendition.init, rendition.segments[0]]) {
      const result = await readPath(reader, c.graph.root, object.path);
      assert.deepEqual(decryptStreamingObject(result.bytes, c.key, manifest, object), c.originals.get(object.path));
    }
  }
  assert.ok(options.every(o => o.noReassemble === true && o.lookupTimeoutMs === 10_000));
  const masterReads = new Set();
  const blocks = new Map(c.graph.blocks.map(b => [b.cid, b.bytes]));
  await readPath(
    async cid => {
      masterReads.add(cid);
      return blocks.get(cid);
    },
    c.graph.root,
    'archive/master.bin'
  );
  const masterOnly = c.graph.blocks.filter(b => b.codec === 0x55 && masterReads.has(b.cid));
  assert.ok(masterOnly.length >= 2, 'Master should span multiple blocks');
  assert.ok(masterOnly.every(b => !c.chain.reads.includes(b.cid)));
});

test('directory identities are input-order independent, and children precede the root', async t => {
  const c = await context(t);
  const reversed = await buildDirectory([...c.files].reverse());
  assert.equal(c.graph.root, reversed.root);
  assert.deepEqual(
    c.graph.blocks.map(b => b.cid),
    reversed.blocks.map(b => b.cid)
  );
  assert.equal(c.graph.blocks.at(-1).cid, c.graph.root);
});

test('unsafe/duplicate paths and byte-budget exhaustion are refused', async t => {
  const c = await context(t);
  for (const path of ['../manifest.json', '/manifest.json', '96/../master.bin', '96\\segment.bin']) {
    await assert.rejects(buildDirectory([{ path, bytes: Buffer.from('x') }]));
    await assert.rejects(readPath(() => assert.fail('Must not fetch'), c.graph.root, path));
  }
  await assert.rejects(buildDirectory([c.files[0], c.files[0]]), /Duplicate/);
  await publish(c.graph, c.chain, c.checkpoint, budget);
  await assert.rejects(
    readPath(cid => c.chain.readBlock(cid), c.graph.root, 'manifest.json', { maxBytes: 1 }),
    /byte budget/
  );
  await assert.rejects(
    readPath(cid => c.chain.readBlock(cid), c.graph.root, '96/init.bin', { maxReads: 1 }),
    /block budget/
  );
});

test('CID corruption and a denied Host response fail closed', async t => {
  const c = await context(t);
  const block = c.graph.blocks[0];
  const corrupt = Buffer.from(block.bytes);
  corrupt[0] ^= 1;
  await assert.rejects(verifyBlock(block.cid, corrupt), /does not match/);
  await assert.rejects(hostBlockReader({ fetchBytes: async () => ({ ok: false }) })(block.cid), /Host could not/);
  await assert.rejects(hostBlockReader({ fetchBytes: async () => ({ ok: true, value: corrupt }) })(block.cid), /does not match/);
  const typed = Object.assign(new Error('Native lookup expired'), { name: 'CloudStorageLookupTimeoutError' });
  await assert.rejects(hostBlockReader({ fetchBytes: async () => ({ ok: false, error: typed }) })(block.cid), error => error.name === typed.name && error.message.includes('Native lookup expired'));
  assert.throws(() => hostBlockReader({}, { lookupTimeoutMs: 60_000 }), /lookup bound/);
});

test('the pinned SDK builder preserves exact codecs/hash and requests finalized single-block stores', async t => {
  const c = await context(t);
  const calls = [];
  for (const block of c.graph.blocks) {
    const executor = {
      storeWithOptions: async (bytes, options, _callback, chunker) => {
        calls.push({ bytes, options, chunker });
        return { cid: { toString: () => block.cid }, size: bytes.length, blockNumber: 500, extrinsicIndex: 1 };
      }
    };
    const receipt = await sdkBlockStore({ store: bytes => new StoreBuilder(executor, bytes) })(block);
    assert.equal(receipt.cid, block.cid);
    assert.equal(calls.at(-1).options.cidCodec, block.codec);
    assert.equal(calls.at(-1).options.hashingAlgorithm, HashAlgorithm.Sha2_256);
    assert.equal(calls.at(-1).options.waitFor, 'finalized');
    assert.equal(calls.at(-1).chunker, undefined);
  }
});

test('the actual SDK preparer computes the same raw and DAG-PB CIDs before SCALE encoding', async t => {
  const c = await context(t);
  const encoded = [];
  const api = { tx: { TransactionStorage: { store_with_cid_config: args => {
    assert.equal(args.cid.hashing.type, 'Sha2_256');
    encoded.push(args);
    return { canaryEncodedCall: true };
  } } } };
  const sdk = new AsyncBulletinClient(api, null, () => assert.fail('No broadcast in this test'));
  // Keep SDK hash preparation, CID calculation and enum/call construction real;
  // replace only transaction signing/submission with a finalized receipt.
  sdk.signAndSubmitWithProgress = async (tx, _progress, waitFor) => {
    assert.equal(tx.canaryEncodedCall, true); assert.equal(waitFor, 'finalized');
    return { blockNumber: 500, txIndex: 1 };
  };
  for (const block of [c.graph.blocks.find(b => b.codec === 0x55), c.graph.blocks.at(-1)]) {
    const receipt = await sdkBlockStore(sdk)(block);
    assert.equal(receipt.cid, block.cid);
    assert.equal(encoded.at(-1).cid.codec, BigInt(block.codec));
    assert.deepEqual(encoded.at(-1).data, block.bytes);
  }
});

test('wrong SDK CID, chunk replacement and incomplete storage coordinates cannot be checkpointed', async t => {
  const c = await context(t);
  const block = c.graph.blocks[0];
  const valid = { cid: { toString: () => block.cid }, size: block.bytes.length, blockNumber: 500, extrinsicIndex: 1 };
  for (const change of [{ cid: { toString: () => c.graph.root } }, { chunks: { numChunks: 1 } }, { blockNumber: undefined }, { extrinsicIndex: -1 }]) {
    const client = { store: bytes => new StoreBuilder({ storeWithOptions: async () => ({ ...valid, ...change }) }, bytes) };
    await assert.rejects(sdkBlockStore(client)(block));
  }
});

test('partial definitive rejection resumes with unchanged ciphertext and no duplicate finalized stores', async t => {
  const c = await context(t);
  const store = c.chain.store.bind(c.chain);
  c.chain.store = async block => {
    if (c.chain.stores.length === 3) throw Object.assign(new Error('Quota refusal before submission'), { definitelyNotSubmitted: true });
    return store(block);
  };
  await assert.rejects(publish(c.graph, c.chain, c.checkpoint, budget), /Quota refusal/);
  assert.ok(!c.chain.stores.includes(c.graph.root));
  c.chain.store = store;
  const done = await publish(c.graph, c.chain, c.checkpoint, budget);
  assert.equal(done.reusedBlocks, 3);
  assert.equal(new Set(c.chain.stores).size, c.graph.blocks.length);
  assert.equal(c.chain.stores.length, c.graph.blocks.length);
  assert.equal(c.chain.stores.at(-1), c.graph.root);
  const journal = await readFile(join(c.checkpoint, 'receipts.json'), 'utf8');
  assert.ok(!journal.includes(c.key.toString('hex')));
  assert.ok(!journal.includes('AAAA')); // no encoded source/ciphertext payload
});

test('lost acknowledgement recovers through finalized lookup; unknown submission is not resent', async t => {
  const c = await context(t);
  const store = c.chain.store.bind(c.chain);
  c.chain.store = async block => {
    await store(block);
    throw new Error('Connection lost after inclusion');
  };
  await assert.rejects(publish(c.graph, c.chain, c.checkpoint, budget));
  c.chain.store = store;
  const result = await publish(c.graph, c.chain, c.checkpoint, budget);
  assert.equal(result.reusedBlocks, 1);
  assert.equal(c.chain.stores.length, c.graph.blocks.length);
  const second = join(c.directory, 'uncertain');
  const empty = new SimulatedChain();
  let submissions = 0;
  empty.store = async () => {
    submissions++;
    throw new Error('Submission state unknown');
  };
  await assert.rejects(publish(c.graph, empty, second, budget));
  await assert.rejects(publish(c.graph, empty, second, budget), /Submission unresolved/);
  assert.equal(submissions, 1);
});

test('network/account/checkpoint changes and insufficient quota fail before any write', async t => {
  const c = await context(t);
  for (const patch of [{ expiresAt: c.chain.head + 1 }, { remainingBytes: 1 }, { remainingTransactions: 1 }, { remainingRenewBytes: 1 }]) {
    const chain = new SimulatedChain();
    Object.assign(chain.authorization, patch);
    await assert.rejects(publish(c.graph, chain, c.checkpoint, budget));
    assert.equal(chain.stores.length, 0);
  }
  await assert.rejects(publish(c.graph, c.chain, c.checkpoint, { ...budget, maxTransactions: 1 }), /budget exceeded/);
  const wrong = new SimulatedChain();
  wrong.genesis = `0x${'00'.repeat(32)}`;
  await assert.rejects(publish(c.graph, wrong, c.checkpoint, budget), /Wrong Bulletin/);
  await publish(c.graph, c.chain, c.checkpoint, budget);
  c.chain.account = 'different-account';
  await assert.rejects(publish(c.graph, c.chain, c.checkpoint, budget), /another graph\/account\/network/);
});

test('remembered receipts cannot mask corrupted storage', async t => {
  const c = await context(t);
  await publish(c.graph, c.chain, c.checkpoint, budget);
  c.chain.blocks.get(c.graph.blocks[0].cid).bytes[0] ^= 1;
  await assert.rejects(publish(c.graph, c.chain, c.checkpoint, budget), /does not match/);
});

test('a renewal acknowledgement is not retained data; every child must be observed renewed', async t => {
  const c = await context(t);
  await publish(c.graph, c.chain, c.checkpoint, budget);
  const requested = await requestRenewal(c.graph, c.chain, c.checkpoint, budget);
  assert.equal(requested.retained, false);
  assert.equal(requested.requested, c.graph.blocks.length);
  await assert.rejects(verifyRenewal(c.graph, c.chain, c.checkpoint), /not extended/);
  await requestRenewal(c.graph, c.chain, c.checkpoint, budget);
  assert.equal(c.chain.renewals.length, c.graph.blocks.length, 'Must not duplicate renewal requests');
  c.chain.advance(100);
  c.chain.settleRenewals();
  const result = await verifyRenewal(c.graph, c.chain, c.checkpoint);
  assert.deepEqual(result, { retained: true, verifiedBlocks: c.graph.blocks.length });
});

test('renewing just the directory root leaves expired children unavailable', async t => {
  const c = await context(t);
  await publish(c.graph, c.chain, c.checkpoint, budget);
  await c.chain.requestRenewal(await c.chain.lookup(c.graph.root));
  c.chain.advance(100);
  c.chain.settleRenewals();
  c.chain.advance(101);
  assert.ok(await c.chain.lookup(c.graph.root));
  await assert.rejects(
    readPath(cid => c.chain.readBlock(cid), c.graph.root, 'manifest.json'),
    /unavailable or expired/
  );
  await assert.rejects(verifyRenewal(c.graph, c.chain, c.checkpoint));
});

test('an incomplete or incorrectly ordered graph is refused before transport writes', async t => {
  const c = await context(t);
  const variants = [
    { ...c.graph, blocks: c.graph.blocks.slice(1) },
    { ...c.graph, blocks: [...c.graph.blocks].reverse() },
    { ...c.graph, bytes: 1 }
  ];
  for (const graph of variants) await assert.rejects(publish(graph, c.chain, c.checkpoint, budget));
  assert.equal(c.chain.stores.length, 0);
});

test('unfinalized or substituted lookup coordinates never produce a ready publication', async t => {
  const c = await context(t);
  const lookup = c.chain.lookup.bind(c.chain);
  c.chain.lookup = async cid => {
    const receipt = await lookup(cid);
    return receipt ? { ...receipt, finalized: false } : null;
  };
  await assert.rejects(publish(c.graph, c.chain, c.checkpoint, budget), /not finalized/);
  assert.ok(!c.chain.stores.includes(c.graph.root));
  c.chain.lookup = lookup;
  await publish(c.graph, c.chain, c.checkpoint, budget);
});

test('the same checkpoint refuses a second in-process writer', async t => {
  const c = await context(t);
  const status = c.chain.status.bind(c.chain);
  let unblock;
  const started = new Promise(resolve => {
    c.chain.status = () => {
      resolve();
      return new Promise(done => {
        unblock = () => done(status());
      });
    };
  });
  const first = publish(c.graph, c.chain, c.checkpoint, budget);
  await started;
  await assert.rejects(publish(c.graph, c.chain, c.checkpoint, budget), /already has a writer/);
  c.chain.status = status;
  unblock();
  await first;
});

for (const lostAck of [false, true]) {
  test(`a fresh Node process resumes ${lostAck ? 'a lost acknowledgement' : 'a partial publication'} from durable receipts`, async t => {
    const c = await context(t);
    const store = c.chain.store.bind(c.chain);
    c.chain.store = async block => {
      if (lostAck) {
        await store(block);
        throw new Error('Connection lost after inclusion');
      }
      if (c.chain.stores.length === 3) throw Object.assign(new Error('Not submitted'), { definitelyNotSubmitted: true });
      return store(block);
    };
    await assert.rejects(publish(c.graph, c.chain, c.checkpoint, budget));
    const snapshot = {
      graph: { ...c.graph, blocks: c.graph.blocks.map(block => ({ ...block, bytes: Buffer.from(block.bytes).toString('base64') })) },
      stores: c.chain.stores,
      blocks: [...c.chain.blocks].map(([cid, block]) => [cid, { ...block, bytes: block.bytes.toString('base64') }])
    };
    const fixture = join(c.directory, 'public-synthetic-ciphertext.json');
    await writeFile(fixture, JSON.stringify(snapshot), { mode: 0o600 });
    const child = spawnSync(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./resume-fixture.mjs', import.meta.url)), fixture, c.checkpoint], {
      cwd: fileURLToPath(new URL('.', import.meta.url)),
      encoding: 'utf8',
      timeout: 30_000,
      // The subprocess receives no caller credentials or deployment variables.
      env: { PATH: process.env.PATH, TMPDIR: tmpdir() }
    });
    assert.equal(child.status, 0, child.stderr || String(child.error));
    const result = JSON.parse(child.stdout);
    assert.equal(result.root, c.graph.root);
    assert.equal(result.reusedBlocks, lostAck ? 1 : 3);
    assert.equal(result.totalStoreCalls, c.graph.blocks.length);
    assert.equal(result.networkWrites, 0);
  });
}
