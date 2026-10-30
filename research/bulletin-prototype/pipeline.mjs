// Opt-in research writer: direct transactions, bounded concurrency, no automatic resubmission.
import assert from 'node:assert/strict';
import * as dagPB from '@ipld/dag-pb';
import { verifyBlock } from './graph.mjs';
import { publicationSession, receiptFor } from './publication.mjs';
const asError = value => (value instanceof Error ? value : new Error(value == null ? 'Unknown publication failure' : String(value)));

export function pipelineLimits({ concurrency = 2, maxInFlightBytes = 512 * 1024 } = {}) {
  assert.ok(Number.isSafeInteger(concurrency) && concurrency >= 1 && concurrency <= 4, 'Concurrency must be 1..4');
  assert.ok(Number.isSafeInteger(maxInFlightBytes) && maxInFlightBytes > 0 && maxInFlightBytes <= 1024 * 1024, 'Invalid in-flight byte bound');
  return { concurrency, maxInFlightBytes };
}

// All started reads settle before returning an error; callers may then safely release the client.
async function observedBlocks(blocks, read, concurrency) {
  const outcomes = new Array(blocks.length);
  let cursor = 0,
    failure;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, blocks.length) }, async () => {
      while (!failure && cursor < blocks.length) {
        const index = cursor++;
        try {
          outcomes[index] = await read(blocks[index]);
        } catch (error) {
          failure ??= asError(error);
        }
      }
    })
  );
  if (failure) throw failure;
  return outcomes;
}

export async function publishPipelined(graph, transport, directory, budget, options = {}) {
  const limits = pipelineLimits(options);
  assert.ok(
    Number.isSafeInteger(budget.maxBytes) && budget.maxBytes > 0 && Number.isSafeInteger(budget.maxTransactions) && budget.maxTransactions > 0,
    'Explicit budget required'
  );
  return publicationSession(
    graph,
    transport,
    directory,
    async (state, persist) => {
      assert.ok(state.pending && typeof state.pending === 'object' && !Array.isArray(state.pending), 'Invalid pending journal');
      assert.ok(state.nextNonce === null || (Number.isSafeInteger(state.nextNonce) && state.nextNonce >= 0), 'Invalid nonce cursor');
      const byCid = new Map(graph.blocks.map(b => [b.cid, b]));
      for (const [cid, intent] of Object.entries(state.pending)) {
        assert.ok(byCid.has(cid) && intent.cid === cid && Number.isSafeInteger(intent.nonce) && intent.nonce >= 0, 'Invalid write intent');
      }
      assert.equal(new Set(Object.values(state.pending).map(p => p.nonce)).size, Object.keys(state.pending).length, 'Duplicate pending nonce');
      assert.ok(
        Object.values(state.pending).every(p => state.nextNonce !== null && p.nonce < state.nextNonce),
        'Pending nonce exceeds durable cursor'
      );
      const status = await transport.status();
      const margin = budget.minimumLifetimeBlocks ?? 100;
      assert.ok(Number.isSafeInteger(margin) && margin >= 100, 'Invalid retention safety margin');
      assert.ok(status.authorization.expiresAt > status.head + margin, 'Storage authorization expires too soon');
      const observed = await observedBlocks(
        graph.blocks,
        async block => {
          const found = await transport.lookup(block.cid);
          if (!found) return null;
          const receipt = receiptFor(block, found, status, margin);
          await verifyBlock(block.cid, await transport.readBlock(block.cid));
          return receipt;
        },
        limits.concurrency
      );
      const missing = [];
      // Remembered receipts are replaced by fresh chain and raw-byte observations.
      state.receipts = {};
      for (let i = 0; i < graph.blocks.length; i++) {
        const block = graph.blocks[i];
        if (observed[i]) {
          state.receipts[block.cid] = observed[i];
          delete state.pending[block.cid];
        } else missing.push(block);
      }
      await persist();
      assert.equal(Object.keys(state.pending).length, 0, 'Submission unresolved; missing content does not prove an earlier nonce failed');
      assert.ok(transport.writable !== false || !missing.length, 'Read-only reconciliation found missing blocks');
      const bytes = missing.reduce((sum, b) => sum + b.bytes.length, 0);
      assert.ok(bytes <= budget.maxBytes && missing.length + graph.blocks.length <= budget.maxTransactions, 'Explicit canary budget exceeded');
      assert.ok(
        status.authorization.remainingBytes >= bytes &&
          status.authorization.remainingTransactions >= missing.length + graph.blocks.length &&
          status.authorization.remainingRenewBytes >= graph.bytes,
        'Insufficient storage/renewal allowance'
      );
      assert.ok(
        missing.every(b => b.bytes.length <= limits.maxInFlightBytes),
        'A block exceeds the in-flight byte bound'
      );
      let nextNonce;
      if (missing.length) {
        assert.equal(typeof transport.nextNonce, 'function', 'Explicit finalized nonce source required');
        nextNonce = await transport.nextNonce();
        assert.ok(Number.isSafeInteger(nextNonce) && nextNonce >= 0 && nextNonce + missing.length <= 0xffffffff, 'Invalid nonce range');
        assert.ok(state.nextNonce === null || nextNonce >= state.nextNonce, 'Finalized account nonce is behind the durable cursor');
      }
      const dependencies = new Map(graph.blocks.map(b => [b.cid, b.codec === dagPB.code ? dagPB.decode(b.bytes).Links.map(l => l.Hash.toString()) : []]));
      const active = new Map(),
        started = new Set();
      let activeBytes = 0,
        peakInFlight = 0,
        peakInFlightBytes = 0,
        failure;
      const ready = block =>
        dependencies.get(block.cid).every(cid => state.receipts[cid]) &&
        (block.cid !== graph.root || Object.keys(state.receipts).length === graph.blocks.length - 1);
      const admit = async block => {
        if (block.codec === dagPB.code) {
          const current = await transport.status();
          const cids = block.cid === graph.root ? Object.keys(state.receipts) : dependencies.get(block.cid);
          for (const cid of cids) receiptFor(byCid.get(cid), state.receipts[cid], current, margin);
        }
        const nonce = nextNonce++;
        state.pending[block.cid] = { cid: block.cid, nonce };
        state.nextNonce = nextNonce;
        await persist(); // A crash after this point is reconciled, never blindly replayed.
        started.add(block.cid);
        activeBytes += block.bytes.length;
        peakInFlight = Math.max(peakInFlight, active.size + 1);
        peakInFlightBytes = Math.max(peakInFlightBytes, activeBytes);
        const task = (async () => {
          const submitted = await transport.store(block, { nonce });
          const current = await transport.status();
          const receipt = receiptFor(block, await transport.lookup(block.cid), current, margin);
          assert.equal(receipt.block, submitted.block, 'Readback differs from submitted storage position');
          assert.equal(receipt.index, submitted.index, 'Readback differs from submitted storage position');
          await verifyBlock(block.cid, await transport.readBlock(block.cid));
          return { block, receipt };
        })().catch(error => {
          failure ??= asError(error);
          return { block, error: asError(error) };
        });
        active.set(block.cid, task);
      };
      while (active.size || (!failure && started.size < missing.length)) {
        while (!failure && active.size < limits.concurrency) {
          const block = missing.find(b => !started.has(b.cid) && ready(b) && activeBytes + b.bytes.length <= limits.maxInFlightBytes);
          if (!block) break;
          try {
            await admit(block);
          } catch (error) {
            failure ??= asError(error);
            break;
          }
        }
        if (!active.size) {
          if (failure) break;
          throw new Error('No dependency-ready block fits the bounded pipeline');
        }
        const result = await Promise.race(active.values());
        active.delete(result.block.cid);
        activeBytes -= result.block.bytes.length;
        if (!result.error) {
          state.receipts[result.block.cid] = result.receipt;
          delete state.pending[result.block.cid];
          try {
            await persist();
          } catch (error) {
            failure ??= asError(error);
          }
        }
        // On any failure, stop admitting; drain every already-started write.
      }
      if (failure) throw failure;
      assert.equal(Object.keys(state.receipts).length, graph.blocks.length, 'Incomplete directory publication');
      assert.equal(Object.keys(state.pending).length, 0, 'Pending writes remain');
      return {
        root: graph.root,
        storedBlocks: started.size,
        reusedBlocks: graph.blocks.length - started.size,
        reservedRenewalTransactions: graph.blocks.length,
        ...limits,
        peakInFlight,
        peakInFlightBytes
      };
    },
    { schema: 'dotify.bulletin.pipeline.v1', initial: { pending: {}, nextNonce: null } }
  );
}
