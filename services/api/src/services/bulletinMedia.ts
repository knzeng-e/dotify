// Opt-in custody storage seam. Transport/signing are supplied explicitly; the
// default app continues using Pinata. No SDK, credentials or network defaults.
import assert from 'node:assert/strict';
import { open, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { buildBulletinMediaGraph, verifyBulletinBlock, type BulletinBlock } from './bulletinGraph.js';
import { BULLETIN_CUSTODY_READ_MS, BULLETIN_STORE_MS } from './bulletinLimits.js';
import {
  bulletinDependencies,
  bulletinWave,
  observeBulletinBlocks,
  pipelineSchema,
  publicationError,
  type BulletinPipelineLimits
} from './bulletinPipeline.js';
import {
  jobId,
  integer,
  budgetSchema,
  identitySchema,
  ownerSchema,
  receiptSchema,
  jobSchema,
  privateDirectory,
  load,
  save,
  sync,
  type BulletinMediaInventory
} from './bulletinMediaState.js';
import type { PinataFile } from './pinata.js';
export { initializeBulletinMediaStore, type BulletinMediaInventory } from './bulletinMediaState.js';

export type BulletinReceipt = { cid: string; bytes: number; block: number; index: number; expiresAt: number; finalized: true };
export type BulletinWriteIntent = { nonce: number; afterBlock: number };
export type BulletinSubmissionQuery = BulletinWriteIntent & { cid: string };
export type BulletinSubmissionReceipt = BulletinReceipt & { nonce: number; account: string };
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
  /** Both observations must come from finalized chain state. lookupSubmission
   * identifies the direct store extrinsic by sender+nonce, not just by CID. */
  nextNonce(signal: AbortSignal): Promise<{ nonce: number; head: number }>;
  lookupSubmission(intent: BulletinSubmissionQuery, signal: AbortSignal): Promise<BulletinSubmissionReceipt | null>;
  /** Invoke exactly once with this explicit nonce; never retry or choose another. */
  store(block: BulletinBlock, intent: BulletinWriteIntent, signal: AbortSignal): Promise<BulletinSubmissionReceipt>;
};
export type BulletinStoreIdentity = { genesis: string; account: string };

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
  pipeline?: Partial<BulletinPipelineLimits>;
}) {
  const selected = identitySchema.parse(options.identity);
  const budget = budgetSchema.parse(options.budget);
  const pipeline = pipelineSchema.parse({ concurrency: 2, maxInFlightBytes: 512 * 1024, ...options.pipeline });
  const { directory, transport } = options;
  const owns = () => assert.ok(transport.genesis === selected.genesis && transport.account === selected.account, 'Bulletin transport identity mismatch');
  owns();
  // A deadline stops waiting, not an already-broadcast transaction. The durable
  // account barrier and pending nonces protect retries even if it finishes late.
  const call = async <T>(signal: AbortSignal, action: (bounded: AbortSignal) => Promise<T>, timeoutMs = BULLETIN_CUSTODY_READ_MS): Promise<T> => {
    signal.throwIfAborted();
    owns();
    const bounded = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
    let abort: () => void = () => undefined;
    try {
      return await Promise.race([
        Promise.resolve().then(() => {
          bounded.throwIfAborted();
          return action(bounded);
        }),
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
    /** Last recorded inventory, not a promise of present chain retention. */
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
    async pin(files: PinataFile[], name: string, ownerSignal: AbortSignal): Promise<string> {
      const signal = AbortSignal.any([ownerSignal, AbortSignal.timeout(5 * 60_000)]);
      jobId.parse(name);
      signal.throwIfAborted();
      const initialOwner = await owner();
      assert.ok(!initialOwner.activeJob || initialOwner.activeJob === name, 'A previous Bulletin job needs reconciliation');
      // Never expire a crash lock: operator recovery must establish exclusivity.
      const lock = await open(join(directory, 'writer.lock'), 'wx', 0o600);
      try {
        await lock.writeFile(JSON.stringify({ pid: process.pid, job: name }));
        await lock.sync();
        await sync(directory);
        const custody = await owner();
        assert.ok(!custody.activeJob || custody.activeJob === name, 'A previous Bulletin job needs reconciliation');
        const graph = await buildBulletinMediaGraph(files, signal);
        assert.ok(
          graph.blocks.every(b => b.bytes.length <= pipeline.maxInFlightBytes),
          'A block exceeds the in-flight byte bound'
        );
        const binding = {
          schema: 'dotify.bulletin.media-job.v2' as const,
          ...selected,
          job: name,
          root: graph.root,
          scope: graph.scope,
          generation: graph.generation,
          blocks: graph.blocks.map(b => ({ cid: b.cid, bytes: b.bytes.length })),
          budget,
          pipeline
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
          state = { ...binding, attemptedBytes: 0, attemptedStores: 0, receipts: {}, pending: {}, nextNonce: custody.nextNonce, ready: false };
          await save(directory, `${name}.json`, state);
        }
        for (const key of Object.keys(binding) as (keyof typeof binding)[])
          assert.deepEqual(state[key], binding[key], 'Bulletin job identity, budget or pipeline changed');
        const persist = () => save(directory, `${name}.json`, state);
        const byCid = new Map(graph.blocks.map(b => [b.cid, b]));
        const intents = Object.entries(state.pending);
        assert.ok(
          intents.length <= pipeline.concurrency && intents.every(([cid, p]) => byCid.has(cid) && state.nextNonce !== null && p.nonce < state.nextNonce),
          'Invalid pending nonce intent'
        );
        assert.equal(new Set(intents.map(([, p]) => p.nonce)).size, intents.length, 'Duplicate pending nonce');
        assert.ok(!intents.length || custody.activeJob === name, 'Pending nonce lacks account barrier');
        assert.ok(state.nextNonce === null || (custody.nextNonce !== null && state.nextNonce <= custody.nextNonce), 'Invalid account nonce cursor');
        if (custody.activeJob === name) assert.equal(state.nextNonce, custody.nextNonce, 'Account/job nonce cursors differ; operator reconciliation required');
        assert.ok(state.attemptedStores <= budget.maxTransactions && state.attemptedBytes <= budget.maxBytes, 'Invalid cumulative submission accounting');
        const observeStatus = async () => {
          const status = await call(signal, s => transport.status(s));
          integer.parse(status.head);
          assert.ok(
            Number.isSafeInteger(status.authorization.expiresAt) && status.authorization.expiresAt > status.head + budget.minimumLifetimeBlocks,
            'Bulletin authorization unavailable or expiring'
          );
          nonnegative(status.authorization.remainingTransactions);
          nonnegative(status.authorization.remainingBytes);
          nonnegative(status.authorization.remainingRenewBytes);
          return status;
        };
        const nonceAt = async (head: number) => {
          const observed = await call(signal, s => transport.nextNonce(s));
          assert.ok(
            Number.isSafeInteger(observed.head) &&
              observed.head >= head &&
              Number.isSafeInteger(observed.nonce) &&
              observed.nonce >= 0 &&
              observed.nonce <= 0x100000000,
            'Invalid or stale finalized account nonce'
          );
          return observed;
        };
        const verifiedSubmission = (block: BulletinBlock, nonce: number, submitted: BulletinSubmissionReceipt | null, head: number) => {
          assert.ok(submitted && submitted.account === selected.account && submitted.nonce === nonce, 'Finalized submission identity mismatch');
          // Strip submission identity only after checking it: receiptSchema is strict.
          const { account: _account, nonce: _nonce, ...position } = submitted;
          return receiptFor(block, position, head, budget.minimumLifetimeBlocks);
        };
        const status = await observeStatus();
        state.ready = false;
        await persist();
        const observed = await observeBulletinBlocks(graph.blocks, pipeline.concurrency, async block => {
          const found = await call(signal, s => transport.lookup(block.cid, s));
          if (!found) return null;
          const receipt = receiptFor(block, found, status.head, budget.minimumLifetimeBlocks);
          verifyBulletinBlock(block.cid, await call(signal, s => transport.readBlock(block.cid, s)));
          return receipt;
        });
        state.receipts = {};
        graph.blocks.forEach((block, i) => {
          if (observed[i]) state.receipts[block.cid] = observed[i]!;
        });
        // A CID may have been stored by somebody else. Resolve our own nonce as
        // well, then require a matching finalized account cursor before writing.
        if (intents.length) {
          const nonce = await nonceAt(status.head);
          for (const [cid, intent] of intents) {
            const submitted = await call(signal, s => transport.lookupSubmission({ ...intent, cid }, s));
            assert.ok(submitted, 'Submission unresolved; a missing block does not authorize retry');
            const receipt = verifiedSubmission(byCid.get(cid)!, intent.nonce, submitted, nonce.head);
            assert.ok(nonce.nonce > intent.nonce && state.receipts[cid], 'Submission unresolved; a missing block does not authorize retry');
            assert.ok(receipt.block > intent.afterBlock, 'Submission predates its durable intent');
            assert.deepEqual(receipt, state.receipts[cid], 'Submission and CID readback differ');
            delete state.pending[cid];
          }
          await persist();
        }
        const missing = graph.blocks.filter(b => !state.receipts[b.cid]);
        await persist();
        assert.ok(transport.writable !== false || !missing.length, 'Bulletin transport is read-only');
        const neededBytes = missing.reduce((sum, b) => sum + b.bytes.length, 0);
        const transactions = missing.length + graph.blocks.length;
        assert.ok(
          state.attemptedStores + transactions <= budget.maxTransactions && state.attemptedBytes + neededBytes <= budget.maxBytes,
          'Bulletin job allowance exhausted'
        );
        const quotaFor = (current: BulletinStatus, count: number, bytes: number) => {
          assert.ok(
            nonnegative(current.authorization.remainingTransactions) >= BigInt(count + graph.blocks.length) &&
              nonnegative(current.authorization.remainingBytes) >= BigInt(bytes) &&
              nonnegative(current.authorization.remainingRenewBytes) >= BigInt(graph.bytes),
            'Insufficient Bulletin quota including renewal reserve'
          );
        };
        quotaFor(status, missing.length, neededBytes);
        if (missing.length || custody.activeJob === name) {
          const observedNonce = await nonceAt(status.head);
          assert.ok(
            custody.nextNonce === null ||
              (observedNonce.nonce >= custody.nextNonce && (custody.activeJob !== name || observedNonce.nonce === custody.nextNonce)),
            'Finalized account nonce differs from durable cursor; operator reconciliation required'
          );
          assert.ok(observedNonce.nonce + missing.length <= 0x100000000, 'Account nonce range exhausted');
          // DotNS may use this same account between fully settled jobs. A
          // monotonic advance is safe only while no owned submission is active.
          custody.nextNonce = state.nextNonce = observedNonce.nonce;
        }
        const dependencies = bulletinDependencies(graph);
        while (Object.keys(state.receipts).length < graph.blocks.length) {
          signal.throwIfAborted();
          const wave = bulletinWave(graph, state.receipts, dependencies, pipeline);
          const before = await observeStatus();
          quotaFor(
            before,
            wave.length,
            wave.reduce((sum, b) => sum + b.bytes.length, 0)
          );
          const nonce = await nonceAt(before.head);
          assert.equal(nonce.nonce, custody.nextNonce, 'Finalized account nonce differs from durable cursor; operator reconciliation required');
          assert.ok(before.authorization.expiresAt > nonce.head + budget.minimumLifetimeBlocks, 'Bulletin authorization unavailable or expiring');
          for (const block of wave) {
            const children = block.cid === graph.root ? Object.keys(state.receipts) : dependencies.get(block.cid)!;
            for (const cid of children) receiptFor(byCid.get(cid)!, state.receipts[cid], nonce.head, budget.minimumLifetimeBlocks);
          }
          let failure: Error | undefined;
          const tasks: Promise<{ block: BulletinBlock; receipt?: BulletinReceipt }>[] = [];
          for (const block of wave) {
            if (failure) break;
            try {
              signal.throwIfAborted();
              owns();
              const afterBlock = nonce.head;
              const writeNonce = custody.nextNonce!;
              custody.activeJob = name;
              custody.nextNonce = state.nextNonce = writeNonce + 1;
              state.pending[block.cid] = { nonce: writeNonce, afterBlock };
              state.attemptedStores++;
              state.attemptedBytes += block.bytes.length;
              await save(directory, 'owner.json', custody);
              await persist(); // Both durable cursors + intent precede any broadcast.
              if (failure || signal.aborted) {
                // Only this trailing reservation has never reached store(). The
                // attempt remains charged. A crash between saves fails closed.
                delete state.pending[block.cid];
                custody.nextNonce = state.nextNonce = writeNonce;
                await persist();
                await save(directory, 'owner.json', custody);
                signal.throwIfAborted();
                break;
              }
              tasks.push(
                (async () => {
                  try {
                    const submitted = await call(signal, s => transport.store(block, { nonce: writeNonce, afterBlock }, s), BULLETIN_STORE_MS);
                    const current = await observeStatus();
                    const receipt = receiptFor(block, await call(signal, s => transport.lookup(block.cid, s)), current.head, budget.minimumLifetimeBlocks);
                    assert.deepEqual(
                      verifiedSubmission(block, writeNonce, submitted, current.head),
                      receipt,
                      'Finalized readback differs from submitted receipt'
                    );
                    assert.ok(receipt.block > afterBlock, 'Submission predates its durable intent');
                    const ownReceipt = await call(signal, s => transport.lookupSubmission({ nonce: writeNonce, afterBlock, cid: block.cid }, s));
                    assert.deepEqual(verifiedSubmission(block, writeNonce, ownReceipt, current.head), receipt, 'Finalized submission and CID readback differ');
                    verifyBulletinBlock(block.cid, await call(signal, s => transport.readBlock(block.cid, s)));
                    return { block, receipt };
                  } catch (error) {
                    failure ??= publicationError(error);
                    return { block };
                  }
                })()
              );
            } catch (error) {
              failure ??= publicationError(error);
              break;
            }
          }
          // Observe all started calls before releasing the writer. Calls are
          // deadline-bounded; an unresponsive underlying broadcast stays pending.
          for (const result of await Promise.all(tasks)) {
            if (result.receipt) {
              state.receipts[result.block.cid] = result.receipt;
              delete state.pending[result.block.cid];
            }
          }
          await persist();
          if (failure) throw failure;
        }
        const final = await observeStatus();
        quotaFor(final, 0, 0);
        const receipts = await observeBulletinBlocks(graph.blocks, pipeline.concurrency, async block => {
          const receipt = receiptFor(block, await call(signal, s => transport.lookup(block.cid, s)), final.head, budget.minimumLifetimeBlocks);
          verifyBulletinBlock(block.cid, await call(signal, s => transport.readBlock(block.cid, s)));
          return receipt;
        });
        const completed = await observeStatus();
        graph.blocks.forEach((block, i) => {
          state.receipts[block.cid] = receiptFor(block, receipts[i], completed.head, budget.minimumLifetimeBlocks);
        });
        quotaFor(completed, 0, 0);
        if (custody.activeJob === name) {
          const finalNonce = await nonceAt(completed.head);
          assert.equal(finalNonce.nonce, custody.nextNonce, 'Finalized account nonce differs from durable cursor; operator reconciliation required');
          assert.ok(completed.authorization.expiresAt > finalNonce.head + budget.minimumLifetimeBlocks, 'Bulletin authorization unavailable or expiring');
          for (const block of graph.blocks) receiptFor(block, state.receipts[block.cid], finalNonce.head, budget.minimumLifetimeBlocks);
        }
        signal.throwIfAborted();
        owns();
        assert.equal(Object.keys(state.pending).length, 0, 'Pending writes remain');
        state.ready = true;
        await persist();
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
