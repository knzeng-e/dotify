import assert from 'node:assert/strict';
import { it, type TestContext } from 'node:test';
import { mkdtemp, readFile, writeFile, readdir, mkdir, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { blake2b } from '@noble/hashes/blake2';
import { StreamingJobs } from './streamingJobs.js';
import { initializeBulletinPublisher, type BulletinPublisherProfile } from './bulletinPublisherProfile.js';
import { recoverPreparedBulletinJob } from './bulletinPreparedRecovery.js';
import { buildBulletinMediaGraph } from './bulletinGraph.js';
import type { PinataFile } from './pinata.js';
import { load, save } from './bulletinMediaState.js';
import { type PublisherDependencies } from './streamingPublicationStore.js';
import type { BulletinMediaTransport, BulletinSubmissionReceipt } from './bulletinMedia.js';
import { BULLETIN_MEDIA_GENESIS } from './bulletinHttpReader.js';

const owner = `0x${'12'.repeat(20)}`;
const signal = () => new AbortController().signal;
async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'dotify-prepared-recovery-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const queue = join(root, 'queue');
  const key = Buffer.alloc(32, 43);
  const master = Buffer.from('generated fixture only');
  const scope = {
    chainId: 420420417,
    runtimeAddress: `0x${'34'.repeat(20)}`,
    contentHash: `0x${Buffer.from(blake2b(master, { dkLen: 32 })).toString('hex')}`,
    keyVersion: 'dotify-content-key-v2'
  };
  const profile: BulletinPublisherProfile = {
    schema: 'dotify.bulletin.publisher.v1',
    genesis: BULLETIN_MEDIA_GENESIS,
    account: '5DnPdzxJWgfFuh1VYzpvz2TzU8BhPzfGKSzsDhGEkhvXEdca',
    endpoint: 'wss://bulletin.example:8443',
    directory: join(root, 'publisher'),
    seedFile: join(root, 'keys', 'test.seed'),
    budget: { maxBytes: 1024 * 1024, maxTransactions: 16, minimumLifetimeBlocks: 100 },
    pipeline: { concurrency: 2, maxInFlightBytes: 512 * 1024 },
    priorRenewalReserve: { transactions: 107, bytes: 20 * 1024 * 1024 },
    pilotScope: scope
  };
  const profileFile = join(root, 'profile.json');
  await writeFile(profileFile, JSON.stringify(profile), { mode: 0o600 });
  await initializeBulletinPublisher(queue, profile);
  let encodes = 0;
  let files: PinataFile[] = [];
  const jobs = new StreamingJobs({
    directory: queue,
    deriveKey: () => Buffer.from(key),
    authority: async () => true,
    transcode: async () => {
      encodes++;
      return {
        durationSeconds: 8,
        integratedLufs: -18,
        gainDb: 2,
        renditions: ([96, 160, 320] as const).map(bitrateKbps => ({
          bitrateKbps,
          init: Buffer.from('structural init'),
          segments: [Buffer.from('structural segment')]
        }))
      };
    },
    pin: async prepared => {
      files = prepared;
      throw new Error('reproduce pre-store admission failure');
    }
  });
  await jobs.start(false);
  const admitted = await jobs.enqueue({ owner, scope, master });
  for (let i = 0; i < 3; i++) {
    if (i) await jobs.retry(admitted.id, owner, scope.chainId);
    await jobs.runNext();
  }
  await assert.rejects(jobs.retry(admitted.id, owner, scope.chainId), /STREAMING_RETRY_LIMIT/);
  await jobs.stop();
  const graph = await buildBulletinMediaGraph(files, signal());
  const name = `stream-${admitted.id}`;
  const inventory = {
    schema: 'dotify.bulletin.media-job.v2',
    genesis: profile.genesis,
    account: profile.account,
    job: name,
    root: graph.root,
    scope,
    generation: graph.generation,
    blocks: graph.blocks.map(b => ({ cid: b.cid, bytes: b.bytes.length })),
    budget: profile.budget,
    pipeline: profile.pipeline,
    attemptedStores: 0,
    attemptedBytes: 0,
    receipts: {},
    pending: {},
    nextNonce: null,
    ready: false
  };
  await save(profile.directory, `${name}.json`, inventory);
  await save(profile.directory, 'owner.json', {
    schema: 'dotify.bulletin.media-owner.v2',
    genesis: profile.genesis,
    account: profile.account,
    jobs: [name],
    activeJob: null,
    nextNonce: null
  });
  let signerLoads = 0,
    closed = 0,
    head = 1000,
    nonce = 10;
  let loseAck = false,
    hideSubmission = false,
    authority = true;
  const stored = new Map<string, { bytes: Uint8Array; receipt: BulletinSubmissionReceipt }>();
  const writes: string[] = [];
  const transport: BulletinMediaTransport = {
    genesis: profile.genesis,
    account: profile.account,
    writable: true,
    status: async () => ({
      head,
      authorization: { expiresAt: 100000, remainingBytes: 100_000_000, remainingTransactions: 1000, remainingRenewBytes: 100_000_000 }
    }),
    nextNonce: async () => ({ head, nonce }),
    lookup: async cid => {
      const r = stored.get(cid)?.receipt;
      if (!r) return null;
      const { account: _account, nonce: _nonce, ...retained } = r;
      return retained;
    },
    readBlock: async cid => {
      assert.ok(stored.has(cid));
      return stored.get(cid)!.bytes;
    },
    lookupSubmission: async intent => (hideSubmission ? null : (stored.get(intent.cid)?.receipt ?? null)),
    store: async (block, intent) => {
      assert.ok(!stored.has(block.cid), 'must never send a duplicate block');
      const receipt: BulletinSubmissionReceipt = {
        cid: block.cid,
        bytes: block.bytes.length,
        block: ++head,
        index: writes.length,
        expiresAt: 100000,
        finalized: true,
        account: profile.account,
        nonce: intent.nonce
      };
      nonce = Math.max(nonce, intent.nonce + 1);
      writes.push(block.cid);
      stored.set(block.cid, { bytes: block.bytes, receipt });
      if (loseAck) throw new Error('lost acknowledgement after actual broadcast');
      return receipt;
    }
  };
  const publisher: PublisherDependencies = {
    loadSigner: async () => {
      signerLoads++;
      return {
        account: profile.account,
        createTransaction: {} as never,
        dispose: () => {
          closed++;
        }
      };
    },
    openSession: () => ({ transport, close: () => undefined })
  };
  const options = { queue, profileFile, jobId: admitted.id, owner, signal: signal() };
  const deps = { deriveKey: () => Buffer.from(key), authority: async () => authority, publisher };
  const inspect = () => recoverPreparedBulletinJob(options, deps);
  const execute = (executePlan: string) => recoverPreparedBulletinJob({ ...options, executePlan }, deps);
  const snapshot = async () => ({
    queue: await readFile(join(queue, 'jobs.json'), 'utf8'),
    nonce: await tree(join(queue, 'nonces')),
    files: await tree(join(queue, 'jobs')),
    publisher: await tree(profile.directory)
  });
  return {
    root,
    queue,
    key,
    profile,
    profileFile,
    options,
    deps,
    inspect,
    execute,
    snapshot,
    stored,
    writes,
    graph,
    name,
    transport,
    get encodes() {
      return encodes;
    },
    get signerLoads() {
      return signerLoads;
    },
    get closed() {
      return closed;
    },
    set loseAck(value: boolean) {
      loseAck = value;
    },
    set hideSubmission(value: boolean) {
      hideSubmission = value;
    },
    set authority(value: boolean) {
      authority = value;
    }
  };
}
async function tree(directory: string): Promise<Record<string, string>> {
  const entries: Record<string, string> = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      for (const [file, value] of Object.entries(await tree(join(directory, entry.name)))) entries[`${entry.name}/${file}`] = value;
    } else entries[entry.name] = (await readFile(join(directory, entry.name))).toString('hex');
  }
  return entries;
}
it('inspects exact saved ciphertext without a Bulletin session, signer or state changes; recovery preserves attempts and unrelated jobs', async t => {
  const c = await fixture(t);
  // An unrelated exhausted job remains completely unchanged; no queue startup/prune.
  const index = JSON.parse(await readFile(join(c.queue, 'jobs.json'), 'utf8'));
  const unrelated = { ...index.jobs[0], id: '22222222-2222-4222-8222-222222222222', owner: `0x${'99'.repeat(20)}` };
  index.jobs.push(unrelated);
  await mkdir(join(c.queue, 'jobs', unrelated.id), { mode: 0o700 });
  await writeFile(join(c.queue, 'jobs', unrelated.id, 'source.bin'), await readFile(join(c.queue, 'jobs', c.options.jobId, 'source.bin')), { mode: 0o600 });
  await save(c.queue, 'jobs.json', index);
  const before = await c.snapshot();
  const inspected = await c.inspect();
  assert.equal(inspected.mode, 'inspect');
  assert.equal(inspected.plan.root, c.graph.root);
  assert.equal(inspected.plan.attempts, 3);
  assert.equal(inspected.plan.attemptedStores, 0);
  assert.equal(c.signerLoads, 0);
  assert.deepEqual(await c.snapshot(), before);
  const completed = await c.execute(inspected.planSha256);
  assert.equal(completed.mode, 'execute');
  assert.equal(c.encodes, 1);
  assert.equal(c.signerLoads, c.closed);
  const after = JSON.parse(await readFile(join(c.queue, 'jobs.json'), 'utf8'));
  assert.equal(after.jobs[0].state, 'ready');
  assert.equal(after.jobs[0].attempts, 3);
  assert.equal(after.jobs[0].sourceGeneration, index.jobs[0].sourceGeneration);
  assert.deepEqual(after.jobs[1], unrelated);
  assert.deepEqual(await tree(join(c.queue, 'jobs')), before.files);
  assert.deepEqual(await tree(join(c.queue, 'nonces')), before.nonce);
  const audit = JSON.parse(await readFile(join(c.queue, 'recoveries', (await readdir(join(c.queue, 'recoveries')))[0]), 'utf8'));
  assert.equal(audit.state, 'ready');
  assert.deepEqual(audit.previousJob, index.jobs[0]);
  assert.equal(audit.planSha256, inspected.planSha256);
  const inventory = (await load(join(c.profile.directory, `${c.name}.json`))) as { ready: boolean; budget: unknown };
  assert.equal(inventory.ready, true);
  assert.deepEqual(inventory.budget, c.profile.budget);
  assert.equal(c.writes.length, c.graph.blocks.length);
  await assert.rejects(c.execute(inspected.planSha256), /exhausted failed/);
  // Unchanged queue code consumes the completed result after a restart. It
  // neither encodes nor republishes, and keeps the additive recovery audit.
  const restarted = new StreamingJobs({
    directory: c.queue,
    deriveKey: () => null,
    authority: async () => {
      throw new Error('ready jobs need no new authority call');
    },
    transcode: async () => {
      throw new Error('must not encode');
    },
    pin: async () => {
      throw new Error('must not republish');
    }
  });
  await restarted.start(false);
  const result = restarted.get(c.options.jobId, owner, 420420417);
  assert.equal(result?.state, 'ready');
  assert.equal(result?.attempts, 3);
  await restarted.stop();
  assert.equal((await readdir(join(c.queue, 'recoveries'))).length, 1);
});
it('reconciles lost acknowledgements using exact pending sender/nonces without duplicates or resetting cumulative limits', async t => {
  const c = await fixture(t);
  const first = await c.inspect();
  c.loseAck = true;
  await assert.rejects(c.execute(first.planSha256));
  const failed = JSON.parse(await readFile(join(c.queue, 'jobs.json'), 'utf8')).jobs[0];
  assert.equal(failed.state, 'failed');
  assert.equal(failed.attempts, 3);
  assert.ok(c.writes.length > 0);
  const second = await c.inspect();
  assert.ok(second.plan.pending > 0);
  assert.notEqual(second.planSha256, first.planSha256);
  const loads = c.signerLoads;
  await assert.rejects(c.execute(first.planSha256), /plan changed/);
  assert.equal(c.signerLoads, loads);
  c.hideSubmission = true;
  c.loseAck = false;
  const prior = c.writes.length;
  await assert.rejects(c.execute(second.planSha256), /unresolved/);
  assert.equal(c.writes.length, prior);
  c.hideSubmission = false;
  const third = await c.inspect();
  await c.execute(third.planSha256);
  assert.equal(c.writes.length, c.graph.blocks.length);
  assert.equal(new Set(c.writes).size, c.writes.length);
  const audits = await readdir(join(c.queue, 'recoveries'));
  assert.equal(audits.length, 3);
});
it('refuses active custody or crash locks and leaves the lock untouched', async t => {
  const c = await fixture(t);
  const inspected = await c.inspect();
  const file = join(c.profile.directory, 'publisher.lock');
  await writeFile(file, 'existing owner', { mode: 0o600 });
  await assert.rejects(c.inspect(), /EEXIST/);
  await assert.rejects(c.execute(inspected.planSha256), /EEXIST/);
  assert.equal(await readFile(file, 'utf8'), 'existing owner');
  assert.equal(c.signerLoads, 0);
});
it('refuses missing or changed permanent nonce reservations before loading the signer', async t => {
  const c = await fixture(t);
  const inspected = await c.inspect();
  const dir = join(c.queue, 'nonces');
  const keyDir = (await readdir(dir)).find(name => name !== 'ledger.json')!;
  await rm(join(dir, keyDir, (await readdir(join(dir, keyDir)))[0]));
  await assert.rejects(c.execute(inspected.planSha256));
  assert.equal(c.signerLoads, 0);
  assert.equal(c.writes.length, 0);
});
it('rejects corrupt and missing output instead of encoding again or changing queue state', async t => {
  for (const missing of [false, true]) {
    const c = await fixture(t);
    const inspected = await c.inspect();
    const file = join(c.queue, 'jobs', c.options.jobId, 'output', '96', 'segment-000.bin');
    if (missing) await rm(file);
    else {
      const bytes = await readFile(file);
      bytes[0] ^= 1;
      await writeFile(file, bytes);
    }
    const queue = await readFile(join(c.queue, 'jobs.json'));
    await assert.rejects(c.execute(inspected.planSha256));
    assert.equal(c.signerLoads, 0);
    assert.equal(c.encodes, 1);
    assert.deepEqual(await readFile(join(c.queue, 'jobs.json')), queue);
  }
});
it('rejects wrong owner, scope, missing inventory and changed immutable budget before signer load', async t => {
  for (const change of ['owner', 'scope', 'inventory', 'budget']) {
    const c = await fixture(t);
    const inspected = await c.inspect();
    if (change === 'owner') {
      await assert.rejects(recoverPreparedBulletinJob({ ...c.options, owner: `0x${'99'.repeat(20)}`, executePlan: inspected.planSha256 }, c.deps));
    } else {
      if (change === 'inventory') await rm(join(c.profile.directory, `${c.name}.json`));
      else if (change === 'budget') {
        const inventory = (await load(join(c.profile.directory, `${c.name}.json`))) as Record<string, unknown>;
        inventory.budget = { ...c.profile.budget, maxTransactions: 17 };
        await save(c.profile.directory, `${c.name}.json`, inventory);
      } else {
        const queue = JSON.parse(await readFile(join(c.queue, 'jobs.json'), 'utf8'));
        queue.jobs[0].scope.runtimeAddress = `0x${'99'.repeat(20)}`;
        await save(c.queue, 'jobs.json', queue);
      }
      await assert.rejects(c.execute(inspected.planSha256));
    }
    assert.equal(c.signerLoads, 0);
    assert.equal(c.writes.length, 0);
  }
});
it('refuses lost authority, stale plans and symlinked prepared directories', async t => {
  const c = await fixture(t);
  const inspected = await c.inspect();
  c.authority = false;
  await assert.rejects(c.execute(inspected.planSha256), /authority/);
  c.authority = true;
  const index = JSON.parse(await readFile(join(c.queue, 'jobs.json'), 'utf8'));
  index.jobs[0].updatedAt++;
  await save(c.queue, 'jobs.json', index);
  await assert.rejects(c.execute(inspected.planSha256), /plan changed/);
  assert.equal(c.signerLoads, 0);
  const output = join(c.queue, 'jobs', c.options.jobId, 'output', '96');
  await rm(output, { recursive: true });
  await mkdir(join(c.root, 'elsewhere'), { mode: 0o700 });
  await symlink(join(c.root, 'elsewhere'), output);
  await assert.rejects(c.inspect(), /owned private directory/);
});
it('refuses an aborted operation without signer use or queue changes', async t => {
  const c = await fixture(t);
  const inspected = await c.inspect();
  const before = await c.snapshot();
  await assert.rejects(recoverPreparedBulletinJob({ ...c.options, executePlan: inspected.planSha256, signal: AbortSignal.abort() }, c.deps));
  assert.equal(c.signerLoads, 0);
  assert.deepEqual(await c.snapshot(), before);
});
it('does not publish a ready result when queue persistence races; a new inspected plan reuses all confirmed blocks', async t => {
  const c = await fixture(t);
  const inspected = await c.inspect();
  const store = c.transport.store;
  let changed = false;
  c.transport.store = async (...args) => {
    const result = await store(...args);
    if (!changed) {
      changed = true;
      const index = JSON.parse(await readFile(join(c.queue, 'jobs.json'), 'utf8'));
      index.jobs[0].updatedAt++;
      await save(c.queue, 'jobs.json', index);
    }
    return result;
  };
  await assert.rejects(c.execute(inspected.planSha256), /Queue changed/);
  const queue = JSON.parse(await readFile(join(c.queue, 'jobs.json'), 'utf8'));
  assert.equal(queue.jobs[0].state, 'failed');
  assert.equal(queue.jobs[0].attempts, 3);
  assert.equal(c.writes.length, c.graph.blocks.length);
  const after = await c.inspect();
  assert.equal(after.plan.receipts, c.graph.blocks.length);
  await c.execute(after.planSha256);
  assert.equal(c.writes.length, c.graph.blocks.length);
});
it('preserves interrupted pending submissions and resumes them without sending the same block again', async t => {
  const c = await fixture(t);
  const inspected = await c.inspect();
  const abort = new AbortController();
  const store = c.transport.store;
  c.transport.store = async (...args) => {
    const result = await store(...args);
    abort.abort();
    return result;
  };
  await assert.rejects(recoverPreparedBulletinJob({ ...c.options, executePlan: inspected.planSha256, signal: abort.signal }, c.deps));
  const queue = JSON.parse(await readFile(join(c.queue, 'jobs.json'), 'utf8'));
  assert.equal(queue.jobs[0].state, 'failed');
  assert.equal(queue.jobs[0].attempts, 3);
  c.transport.store = store;
  const next = await c.inspect();
  await c.execute(next.planSha256);
  assert.equal(c.writes.length, c.graph.blocks.length);
});
it('refuses an orphaned writer lock without removing it or loading the signer', async t => {
  const c = await fixture(t);
  const inspected = await c.inspect();
  const file = join(c.profile.directory, 'writer.lock');
  await writeFile(file, 'unresolved writer', { mode: 0o600 });
  await assert.rejects(c.inspect(), /writer lock/);
  await assert.rejects(c.execute(inspected.planSha256), /writer lock/);
  assert.equal(await readFile(file, 'utf8'), 'unresolved writer');
  assert.equal(c.signerLoads, 0);
});
it('does not write through an unsafe recovery audit directory', async t => {
  const c = await fixture(t);
  const inspected = await c.inspect();
  const outside = join(c.root, 'outside');
  await mkdir(outside, { mode: 0o700 });
  await symlink(outside, join(c.queue, 'recoveries'));
  await assert.rejects(c.execute(inspected.planSha256), /owned private directory/);
  assert.deepEqual(await readdir(outside), []);
  assert.equal(c.writes.length, 0);
});
it('keeps cumulative store limits exhausted instead of replenishing them during recovery', async t => {
  const c = await fixture(t);
  const file = `${c.name}.json`;
  const inventory = (await load(join(c.profile.directory, file))) as Record<string, unknown>;
  inventory.attemptedStores = c.profile.budget.maxTransactions;
  await save(c.profile.directory, file, inventory);
  const inspected = await c.inspect();
  await assert.rejects(c.execute(inspected.planSha256));
  assert.equal(c.writes.length, 0);
  const after = (await load(join(c.profile.directory, file))) as typeof inventory;
  assert.equal(after.attemptedStores, c.profile.budget.maxTransactions);
  assert.deepEqual(after.budget, c.profile.budget);
});
