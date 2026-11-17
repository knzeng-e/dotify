// Deterministic fault-injection model, not an emulator of Bulletin economics.
import assert from 'node:assert/strict';
import { GENESIS, verifyBlock } from './graph.mjs';

export class SimulatedChain {
  genesis = GENESIS;
  account = 'synthetic-research-account';
  head = 1000;
  retention = 200;
  authorization = { expiresAt: 100_000, remainingBytes: 8 * 1024 * 1024, remainingTransactions: 256, remainingRenewBytes: 8 * 1024 * 1024 };
  blocks = new Map();
  pendingRenewals = new Map();
  stores = [];
  renewals = [];
  reads = [];
  async status() {
    return { head: this.head, authorization: { ...this.authorization } };
  }
  async lookup(cid) {
    const stored = this.blocks.get(cid);
    return stored && stored.receipt.expiresAt > this.head ? { ...stored.receipt } : null;
  }
  async store(block) {
    await verifyBlock(block.cid, block.bytes);
    const receipt = {
      cid: block.cid,
      bytes: block.bytes.length,
      block: this.head,
      index: this.stores.length,
      expiresAt: this.head + this.retention,
      finalized: true
    };
    this.authorization.remainingBytes -= block.bytes.length;
    this.authorization.remainingTransactions--;
    this.blocks.set(block.cid, { bytes: Buffer.from(block.bytes), receipt });
    this.stores.push(block.cid);
    return { ...receipt };
  }
  async readBlock(cid) {
    this.reads.push(cid);
    assert.ok(await this.lookup(cid), 'Block is unavailable or expired');
    return Buffer.from(this.blocks.get(cid).bytes);
  }
  async requestRenewal(receipt) {
    assert.ok(!this.pendingRenewals.has(receipt.cid), 'Renewal already pending');
    this.pendingRenewals.set(receipt.cid, receipt);
    this.renewals.push(receipt.cid);
    this.authorization.remainingTransactions--;
  }
  advance(blocks) {
    this.head += blocks;
  }
  settleRenewals() {
    for (const [cid] of this.pendingRenewals) {
      const stored = this.blocks.get(cid);
      stored.receipt = { ...stored.receipt, block: this.head, expiresAt: this.head + this.retention };
      this.authorization.remainingRenewBytes -= stored.bytes.length;
    }
    this.pendingRenewals.clear();
  }
}
