// Opt-in custody storage seam. Transport/signing are supplied explicitly; the
// default app continues using Pinata. No SDK, credentials or network defaults.
import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { open, mkdir, rename, rm, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { buildBulletinMediaGraph, verifyBulletinBlock, BULLETIN_GRAPH_MAX, BULLETIN_BLOCK_COUNT_MAX, type BulletinBlock } from './bulletinGraph.js';
import type { PinataFile } from './pinata.js';

export type BulletinReceipt = { cid: string; bytes: number; block: number; index: number; expiresAt: number; finalized: true };
export type BulletinBudget = { maxBytes: number; maxTransactions: number; minimumLifetimeBlocks: number };
export type BulletinStatus = {
  head: number;
  authorization: { expiresAt: number; remainingBytes: number | bigint; remainingTransactions: number; remainingRenewBytes: number | bigint };
};
export type BulletinMediaTransport = {
  genesis: string;
  account: string;
  writable?: boolean;
  status(signal: AbortSignal): Promise<BulletinStatus>;
  lookup(cid: string, signal: AbortSignal): Promise<BulletinReceipt | null>;
  readBlock(cid: string, signal: AbortSignal): Promise<Uint8Array>;
  store(block: BulletinBlock, signal: AbortSignal): Promise<BulletinReceipt>;
};
export type BulletinStoreIdentity = { genesis: string; account: string };
const jobId = z.string().regex(/^stream-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const budgetSchema = z
  .object({ maxBytes: integer.min(1).max(BULLETIN_GRAPH_MAX * 2), maxTransactions: integer.min(1).max(8192), minimumLifetimeBlocks: integer.min(100) })
  .strict();
const identitySchema = z.object({ genesis: z.string().regex(/^0x[0-9a-f]{64}$/), account: z.string().min(1).max(128) }).strict();
const ownerSchema = identitySchema
  .extend({ schema: z.literal('dotify.bulletin.media-owner.v1'), activeJob: jobId.nullable(), jobs: z.array(jobId).max(4096) })
  .strict();
const receiptSchema = z
  .object({ cid: z.string(), bytes: integer.min(1), block: integer, index: integer, expiresAt: integer, finalized: z.literal(true) })
  .strict();
const jobSchema = z
  .object({
    schema: z.literal('dotify.bulletin.media-job.v1'),
    genesis: z.string(),
    account: z.string(),
    job: jobId,
    root: z.string(),
    scope: z.object({ chainId: integer.min(1), runtimeAddress: z.string(), contentHash: z.string(), keyVersion: z.string() }).strict(),
    generation: z.string(),
    blocks: z
      .array(z.object({ cid: z.string(), bytes: integer.min(1) }).strict())
      .min(1)
      .max(BULLETIN_BLOCK_COUNT_MAX),
    budget: budgetSchema,
    attemptedBytes: integer,
    attemptedStores: integer,
    receipts: z.record(receiptSchema),
    pending: z.string().nullable(),
    ready: z.boolean()
  })
  .strict();
export type BulletinMediaInventory = z.infer<typeof jobSchema>;

async function sync(directory: string) {
  const handle = await open(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}
async function privateDirectory(directory: string) {
  const info = await lstat(directory);
  assert.ok(
    info.isDirectory() && !info.isSymbolicLink() && !(info.mode & 0o077) && info.uid === process.getuid?.(),
    'Bulletin state must be an owned private directory'
  );
}
async function load(file: string): Promise<unknown> {
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = await handle.stat();
    assert.ok(
      info.isFile() && info.nlink === 1 && info.size <= 2 * 1024 * 1024 && !(info.mode & 0o077) && info.uid === process.getuid?.(),
      'Invalid Bulletin state file'
    );
    return JSON.parse(await handle.readFile('utf8'));
  } finally {
    await handle.close();
  }
}
async function save(directory: string, name: string, data: unknown) {
  const temporary = `${name}.${randomUUID()}.tmp`;
  const file = await open(join(directory, temporary), 'wx', 0o600);
  try {
    await file.writeFile(JSON.stringify(data));
    await file.sync();
  } finally {
    await file.close();
  }
  try {
    await rename(join(directory, temporary), join(directory, name));
    await sync(directory);
  } finally {
    await rm(join(directory, temporary), { force: true });
  }
}

/** Explicit first provisioning only; missing custody state is never recreated. */
export async function initializeBulletinMediaStore(directory: string, selected: BulletinStoreIdentity): Promise<void> {
  const identity = identitySchema.parse(selected);
  await mkdir(directory, { mode: 0o700 });
  await privateDirectory(directory);
  await save(directory, 'owner.json', { schema: 'dotify.bulletin.media-owner.v1', ...identity, activeJob: null, jobs: [] });
  await sync(join(directory, '..'));
}

function receiptFor(block: BulletinBlock, value: BulletinReceipt | null, head: number, lifetime: number): BulletinReceipt {
  const receipt = receiptSchema.parse(value);
  assert.equal(receipt.cid, block.cid, 'Receipt CID mismatch');
  assert.equal(receipt.bytes, block.bytes.length, 'Receipt byte count mismatch');
  assert.ok(receipt.block <= head && receipt.expiresAt > head + lifetime, 'Insufficient finalized retention');
  return receipt;
}
const nonnegative = (value: number | bigint): bigint => {
  assert.ok(typeof value === 'bigint' || Number.isSafeInteger(value), 'Invalid quota counter');
  const result = BigInt(value);
  assert.ok(result >= 0n, 'Negative quota counter');
  return result;
};

export function createBulletinMediaStore(options: {
  directory: string;
  identity: BulletinStoreIdentity;
  transport: BulletinMediaTransport;
  budget: BulletinBudget;
}) {
  const selected = identitySchema.parse(options.identity);
  const budget = budgetSchema.parse(options.budget);
  const { directory, transport } = options;
  const owns = () => assert.ok(transport.genesis === selected.genesis && transport.account === selected.account, 'Bulletin transport identity mismatch');
  owns();
  // A timed-out broadcast stays uncertain. The account barrier below survives
  // process restart and prevents any different job using that signer meanwhile.
  const call = async <T>(signal: AbortSignal, action: (bounded: AbortSignal) => Promise<T>): Promise<T> => {
    signal.throwIfAborted();
    const bounded = AbortSignal.any([signal, AbortSignal.timeout(30_000)]);
    let abort: () => void = () => undefined;
    try {
      return await Promise.race([
        action(bounded),
        new Promise<never>((_, reject) => {
          abort = () => reject(bounded.reason);
          bounded.addEventListener('abort', abort, { once: true });
          if (bounded.aborted) abort();
        })
      ]);
    } finally {
      bounded.removeEventListener('abort', abort);
    }
  };
  const owner = async () => {
    await privateDirectory(directory);
    const state = ownerSchema.parse(await load(join(directory, 'owner.json')));
    assert.equal(state.genesis, selected.genesis, 'Bulletin state network mismatch');
    assert.equal(state.account, selected.account, 'Bulletin state account mismatch');
    assert.equal(new Set(state.jobs).size, state.jobs.length, 'Duplicate Bulletin job ownership');
    assert.ok(state.activeJob === null || state.jobs.includes(state.activeJob), 'Unknown active Bulletin job');
    owns();
    return state;
  };
  return {
    /** Inventory persists after StreamingJobs removes its completed job files.
     * It is a retention duty, never a promise that stored blocks still exist. */
    async inventory(job: string): Promise<BulletinMediaInventory> {
      jobId.parse(job);
      const custody = await owner();
      assert.ok(custody.jobs.includes(job), 'Bulletin job ownership missing');
      const state = jobSchema.parse(await load(join(directory, `${job}.json`)));
      assert.equal(state.job, job);
      assert.equal(state.account, selected.account);
      assert.equal(state.genesis, selected.genesis);
      return state;
    },
    async pin(files: PinataFile[], name: string, signal: AbortSignal): Promise<string> {
      jobId.parse(name);
      signal.throwIfAborted();
      const initialOwner = await owner();
      assert.ok(!initialOwner.activeJob || initialOwner.activeJob === name, 'A previous Bulletin job needs reconciliation');
      // Exclusive create covers other processes sharing this custody volume.
      // A process crash leaves the lock: operator recovery must establish that
      // no writer/broadcast survives before removing it. Never expire by time.
      const lock = await open(join(directory, 'writer.lock'), 'wx', 0o600);
      try {
        await lock.writeFile(JSON.stringify({ pid: process.pid, job: name }));
        await lock.sync();
        await sync(directory);
        const custody = await owner();
        assert.ok(!custody.activeJob || custody.activeJob === name, 'A previous Bulletin job needs reconciliation');
        const graph = await buildBulletinMediaGraph(files, signal);
        const binding = {
          schema: 'dotify.bulletin.media-job.v1' as const,
          ...selected,
          job: name,
          root: graph.root,
          scope: graph.scope,
          generation: graph.generation,
          blocks: graph.blocks.map(b => ({ cid: b.cid, bytes: b.bytes.length })),
          budget
        };
        let state: BulletinMediaInventory;
        try {
          state = jobSchema.parse(await load(join(directory, `${name}.json`)));
          assert.ok(custody.jobs.includes(name), 'Bulletin job ownership missing');
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
          assert.ok(!custody.activeJob, 'Missing journal for unresolved Bulletin job');
          assert.ok(!custody.jobs.includes(name), 'Recorded Bulletin job journal is missing');
          assert.ok(custody.jobs.length < 4096, 'Bulletin inventory capacity reached');
          custody.jobs.push(name);
          await save(directory, 'owner.json', custody);
          state = { ...binding, attemptedBytes: 0, attemptedStores: 0, receipts: {}, pending: null, ready: false };
          await save(directory, `${name}.json`, state);
        }
        for (const key of Object.keys(binding) as (keyof typeof binding)[])
          assert.deepEqual(state[key], binding[key], 'Bulletin job identity or budget changed');
        assert.ok(state.pending === null || graph.blocks.some(b => b.cid === state.pending), 'Unknown pending block');
        assert.ok(state.attemptedStores <= budget.maxTransactions && state.attemptedBytes <= budget.maxBytes, 'Invalid cumulative submission accounting');
        const observeStatus = async () => {
          owns();
          const status = await call(signal, s => transport.status(s));
          assert.ok(
            Number.isSafeInteger(status.head) &&
              status.head >= 0 &&
              Number.isSafeInteger(status.authorization.expiresAt) &&
              status.authorization.expiresAt > status.head + budget.minimumLifetimeBlocks,
            'Bulletin authorization unavailable or expiring'
          );
          nonnegative(status.authorization.remainingTransactions);
          nonnegative(status.authorization.remainingBytes);
          nonnegative(status.authorization.remainingRenewBytes);
          return status;
        };
        const status = await observeStatus();
        const missing: BulletinBlock[] = [];
        state.receipts = {};
        state.ready = false;
        for (const block of graph.blocks) {
          const found = await call(signal, s => transport.lookup(block.cid, s));
          if (found) {
            state.receipts[block.cid] = receiptFor(block, found, status.head, budget.minimumLifetimeBlocks);
            verifyBulletinBlock(block.cid, await call(signal, s => transport.readBlock(block.cid, s)));
            if (state.pending === block.cid) state.pending = null;
          } else {
            assert.notEqual(state.pending, block.cid, 'Submission unresolved; a missing block does not authorize retry');
            missing.push(block);
          }
        }
        await save(directory, `${name}.json`, state);
        assert.ok(transport.writable !== false || !missing.length, 'Bulletin transport is read-only');
        const neededBytes = missing.reduce((sum, b) => sum + b.bytes.length, 0);
        const transactions = missing.length + graph.blocks.length;
        assert.ok(
          state.attemptedStores + transactions <= budget.maxTransactions && state.attemptedBytes + neededBytes <= budget.maxBytes,
          'Bulletin job allowance exhausted'
        );
        const auth = status.authorization;
        assert.ok(
          nonnegative(auth.remainingTransactions) >= BigInt(transactions) &&
            nonnegative(auth.remainingBytes) >= BigInt(neededBytes) &&
            nonnegative(auth.remainingRenewBytes) >= BigInt(graph.bytes),
          'Insufficient Bulletin quota including renewal reserve'
        );
        for (const block of missing) {
          signal.throwIfAborted();
          const before = await observeStatus();
          assert.ok(
            nonnegative(before.authorization.remainingTransactions) >= BigInt(1 + graph.blocks.length) &&
              nonnegative(before.authorization.remainingBytes) >= BigInt(block.bytes.length) &&
              nonnegative(before.authorization.remainingRenewBytes) >= BigInt(graph.bytes),
            'Bulletin quota changed before submission'
          );
          custody.activeJob = name;
          await save(directory, 'owner.json', custody);
          state.pending = block.cid;
          state.attemptedStores++;
          state.attemptedBytes += block.bytes.length;
          await save(directory, `${name}.json`, state);
          let submitted: BulletinReceipt;
          try {
            submitted = await call(signal, s => transport.store(block, s));
          } catch (error) {
            if ((error as { definitelyNotSubmitted?: boolean }).definitelyNotSubmitted === true && !signal.aborted) {
              state.pending = null;
              await save(directory, `${name}.json`, state);
              custody.activeJob = null;
              await save(directory, 'owner.json', custody);
            }
            throw error;
          }
          const current = await observeStatus();
          const receipt = receiptFor(block, await call(signal, s => transport.lookup(block.cid, s)), current.head, budget.minimumLifetimeBlocks);
          assert.ok(
            submitted?.finalized === true &&
              submitted.cid === block.cid &&
              submitted.bytes === block.bytes.length &&
              submitted.block === receipt.block &&
              submitted.index === receipt.index,
            'Finalized readback differs from submitted receipt'
          );
          verifyBulletinBlock(block.cid, await call(signal, s => transport.readBlock(block.cid, s)));
          state.receipts[block.cid] = receipt;
          state.pending = null;
          await save(directory, `${name}.json`, state);
        }
        signal.throwIfAborted();
        const final = await observeStatus();
        assert.ok(
          nonnegative(final.authorization.remainingTransactions) >= BigInt(graph.blocks.length) &&
            nonnegative(final.authorization.remainingRenewBytes) >= BigInt(graph.bytes),
          'Bulletin renewal reserve unavailable'
        );
        for (const block of graph.blocks) {
          state.receipts[block.cid] = receiptFor(block, await call(signal, s => transport.lookup(block.cid, s)), final.head, budget.minimumLifetimeBlocks);
          verifyBulletinBlock(block.cid, await call(signal, s => transport.readBlock(block.cid, s)));
        }
        owns();
        assert.equal(Object.keys(state.receipts).length, graph.blocks.length, 'Incomplete Bulletin publication');
        // All blocks are freshly checked above. This durable receipt inventory
        // survives the upstream job's ready-state staging cleanup.
        state.ready = true;
        await save(directory, `${name}.json`, state);
        custody.activeJob = null;
        await save(directory, 'owner.json', custody);
        return graph.root;
      } finally {
        await lock.close();
        await rm(join(directory, 'writer.lock'));
        await sync(directory);
      }
    }
  };
}
