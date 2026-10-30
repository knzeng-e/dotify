import assert from 'node:assert/strict';
import { mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { GENESIS, verifyBlock, verifyGraph } from './graph.mjs';

const running = new Set();
async function save(directory, state) {
  const temporary = join(directory, `${randomUUID()}.tmp`);
  const file = await open(temporary, 'wx', 0o600);
  try {
    await file.writeFile(JSON.stringify(state));
    await file.sync();
  } finally {
    await file.close();
  }
  try {
    await rename(temporary, join(directory, 'receipts.json'));
    const dir = await open(directory, 'r');
    try {
      await dir.sync();
    } finally {
      await dir.close();
    }
  } finally {
    await rm(temporary, { force: true });
  }
}

export function receiptFor(block, receipt, status, margin) {
  assert.ok(receipt?.finalized === true, 'Storage is not finalized');
  assert.equal(receipt.cid, block.cid, 'Receipt has the wrong CID');
  assert.equal(receipt.bytes, block.bytes.length, 'Receipt has the wrong size');
  for (const key of ['block', 'index', 'expiresAt']) assert.ok(Number.isSafeInteger(receipt[key]) && receipt[key] >= 0, 'Invalid receipt coordinates');
  assert.ok(receipt.block <= status.head && receipt.expiresAt > status.head + margin, 'Stored block has insufficient retention');
  return receipt;
}

export async function publicationSession(graph, transport, directory, run, { schema = 'dotify.bulletin.prototype.v1', initial = {} } = {}) {
  await verifyGraph(graph);
  assert.equal(transport.genesis, GENESIS, 'Wrong Bulletin network');
  assert.ok(typeof transport.account === 'string' && transport.account.length > 0, 'Explicit storage account required');
  directory = resolve(directory);
  assert.ok(!running.has(directory), 'Checkpoint already has a writer');
  running.add(directory);
  try {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const identity = {
      schema,
      genesis: GENESIS,
      account: transport.account,
      root: graph.root,
      blocks: graph.blocks.map(b => b.cid)
    };
    let state;
    try {
      state = JSON.parse(await readFile(join(directory, 'receipts.json'), 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      state = { ...identity, receipts: {}, pending: null, renewals: {}, ...initial };
    }
    for (const key of Object.keys(identity)) assert.deepEqual(state[key], identity[key], 'Checkpoint belongs to another graph/account/network');
    assert.ok(state.receipts && state.renewals, 'Incomplete checkpoint');
    return await run(state, () => save(directory, state));
  } finally {
    running.delete(directory);
  }
}

/** Local research orchestration; no production client or signer is created. */
export async function publish(graph, transport, directory, budget) {
  return publicationSession(graph, transport, directory, async (state, persist) => {
    assert.ok(Number.isSafeInteger(budget.maxTransactions) && budget.maxTransactions > 0);
    assert.ok(Number.isSafeInteger(budget.maxBytes) && budget.maxBytes > 0);
    const status = await transport.status();
    const margin = budget.minimumLifetimeBlocks ?? 100;
    assert.ok(status.authorization.expiresAt > status.head + margin, 'Storage authorization expires too soon');
    const missing = [];
    // Fresh chain/read verification, never just a remembered local receipt.
    for (const block of graph.blocks) {
      await verifyBlock(block.cid, block.bytes);
      const stored = await transport.lookup(block.cid);
      if (stored) {
        state.receipts[block.cid] = receiptFor(block, stored, status, margin);
        await verifyBlock(block.cid, await transport.readBlock(block.cid));
        if (state.pending === block.cid) state.pending = null;
      } else {
        if (state.pending === block.cid) throw new Error('Submission unresolved; a missing CID alone does not prove the prior write failed');
        missing.push(block);
      }
    }
    const bytes = missing.reduce((sum, block) => sum + block.bytes.length, 0);
    assert.ok(transport.writable !== false || missing.length === 0, 'Read-only reconciliation found missing blocks');
    // Reserve one full renewal cycle, including every directory and child.
    const transactions = missing.length + graph.blocks.length;
    assert.ok(bytes <= budget.maxBytes && transactions <= budget.maxTransactions, 'Explicit canary budget exceeded');
    assert.ok(
      status.authorization.remainingBytes >= bytes &&
        status.authorization.remainingTransactions >= transactions &&
        status.authorization.remainingRenewBytes >= graph.bytes,
      'Insufficient storage/renewal allowance'
    );
    await persist();
    for (const block of missing) {
      // A crash after submission but before receipt persistence is ambiguous.
      state.pending = block.cid;
      await persist();
      let submitted;
      try {
        submitted = await transport.store(block);
      } catch (error) {
        if (error.definitelyNotSubmitted === true) {
          state.pending = null;
          await persist();
        }
        throw error;
      }
      const current = await transport.status();
      const receipt = receiptFor(block, await transport.lookup(block.cid), current, margin);
      assert.equal(receipt.block, submitted.block, 'Readback differs from submitted storage position');
      assert.equal(receipt.index, submitted.index, 'Readback differs from submitted storage position');
      await verifyBlock(block.cid, await transport.readBlock(block.cid));
      state.receipts[block.cid] = receipt;
      state.pending = null;
      await persist();
    }
    assert.equal(Object.keys(state.receipts).length, graph.blocks.length, 'Incomplete directory publication');
    return {
      root: graph.root,
      storedBlocks: missing.length,
      reusedBlocks: graph.blocks.length - missing.length,
      reservedRenewalTransactions: graph.blocks.length
    };
  });
}

/** Acknowledged renewal requests are not proof of extended data retention. */
export async function requestRenewal(graph, transport, directory, budget) {
  return publicationSession(graph, transport, directory, async (state, persist) => {
    assert.ok(!state.pending && Object.keys(state.receipts).length === graph.blocks.length, 'Publication is incomplete');
    const status = await transport.status();
    assert.ok(status.authorization.expiresAt > status.head + 100, 'Renewal authorization expires too soon');
    const needed = graph.blocks.filter(block => !state.renewals[block.cid]);
    assert.ok(needed.length <= budget.maxTransactions && graph.bytes <= budget.maxBytes, 'Renewal budget exceeded');
    assert.ok(
      status.authorization.remainingTransactions >= needed.length && status.authorization.remainingRenewBytes >= graph.bytes,
      'Renewal allowance exhausted'
    );
    for (const block of needed) {
      const before = receiptFor(block, await transport.lookup(block.cid), status, 0);
      // Journal intent first. An uncertain request is observed, never blindly
      // re-submitted just because the client did not receive acknowledgement.
      state.renewals[block.cid] = { before, requested: false };
      await persist();
      await transport.requestRenewal(before);
      state.renewals[block.cid].requested = true;
      await persist();
    }
    return { requested: Object.values(state.renewals).filter(r => r.requested).length, retained: false };
  });
}

export async function verifyRenewal(graph, transport, directory) {
  return publicationSession(graph, transport, directory, async (state, persist) => {
    const status = await transport.status();
    for (const block of graph.blocks) {
      const request = state.renewals[block.cid];
      assert.ok(request, 'Not all graph blocks have renewal requests');
      const current = receiptFor(block, await transport.lookup(block.cid), status, 0);
      assert.ok(current.block > request.before.block && current.expiresAt > request.before.expiresAt, 'Renewal has not extended retention yet');
      await verifyBlock(block.cid, await transport.readBlock(block.cid));
      state.receipts[block.cid] = current;
    }
    // Observe only one cycle in this prototype. A production scheduler needs
    // an explicit next-cycle lifecycle and cross-process lease, not this CLI.
    await persist();
    return { retained: true, verifiedBlocks: graph.blocks.length };
  });
}
