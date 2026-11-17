// Generated-only in-memory chain; never imports a live signer or RPC client.
import assert from 'node:assert/strict';
import type { BulletinPublisherProfile } from './bulletinPublisherProfile.js';
import type { PublisherDependencies } from './streamingPublicationStore.js';
import type { BulletinMediaTransport, BulletinSubmissionReceipt } from './bulletinMedia.js';
export type RecoveryChainCheckpoint = { head: number; nonce: number; stored: Array<{ cid: string; bytes: string; receipt: BulletinSubmissionReceipt }> };
export function recoveryPublisherFixture(profile: BulletinPublisherProfile, checkpoint?: RecoveryChainCheckpoint) {
  let signerLoads = 0,
    closed = 0,
    head = checkpoint?.head ?? 1000,
    nonce = checkpoint?.nonce ?? 10;
  let loseAck = false,
    hideSubmission = false;
  const stored = new Map<string, { bytes: Uint8Array; receipt: BulletinSubmissionReceipt }>();
  for (const entry of checkpoint?.stored ?? []) stored.set(entry.cid, { bytes: Buffer.from(entry.bytes, 'base64'), receipt: entry.receipt });
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
  return {
    publisher,
    transport,
    stored,
    writes,
    checkpoint: (): RecoveryChainCheckpoint => ({
      head,
      nonce,
      stored: [...stored].map(([cid, v]) => ({ cid, bytes: Buffer.from(v.bytes).toString('base64'), receipt: v.receipt }))
    }),
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
    set externalNonce(value: number) {
      nonce = value;
    }
  };
}
