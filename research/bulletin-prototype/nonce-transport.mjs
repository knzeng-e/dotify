// Direct, explicitly nonced Bulletin transactions. No SDK retry or wrapper batch.
import assert from 'node:assert/strict';
import { verifyBlock, MAX_BLOCK_BYTES } from './graph.mjs';
import { fixtureProfile } from './fixture-profile.mjs';
import { liveTransport, CANARY_ACCOUNT } from './live-transport.mjs';

import { watchFinalized } from './finalized-store.mjs';
export { watchFinalized } from './finalized-store.mjs';

export function nonceTransport(client, signer, account, options = {}) {
  assert.ok(signer == null || typeof signer === 'function', 'PAPI 3 transaction creator required');
  const budget = fixtureProfile(options.profile).budget;
  const read = liveTransport(client, null, account, options);
  const api = client.getUnsafeApi();
  const issued = new Map();
  let attempts = 0,
    writtenBytes = 0,
    reservation = Promise.resolve();
  const within = (fn, timeoutMs = 30_000) => {
    let timer;
    return Promise.race([
      Promise.resolve().then(fn),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Finalized nonce read timed out')), timeoutMs);
      })
    ]).finally(() => clearTimeout(timer));
  };
  const reserve = (bytes, nonce) => {
    const operation = reservation.then(async () => {
      assert.ok(signer && account === CANARY_ACCOUNT, 'Explicit owner-selected local signer required');
      assert.ok(!issued.has(nonce), 'Nonce already issued by this transport');
      assert.ok(attempts < budget.maxTransactions && writtenBytes + bytes <= budget.maxBytes, 'Live session budget exceeded');
      const { authorization, head } = await read.status();
      // Subtract only attempts not yet reflected in this finalized snapshot.
      const outstanding = [...issued.values()].filter(r => r.finalizedBlock === null || r.finalizedBlock > head);
      const reservedBytes = outstanding.reduce((sum, r) => sum + r.bytes, 0);
      assert.ok(
        authorization.remainingTransactions >= outstanding.length + 1 && authorization.remainingBytes >= BigInt(reservedBytes + bytes),
        'Live quota does not cover reserved attempts'
      );
      issued.set(nonce, { bytes, finalizedBlock: null });
      attempts++;
      writtenBytes += bytes;
    });
    reservation = operation.catch(() => {});
    return operation;
  };
  return {
    ...read,
    writable: Boolean(signer),
    async nextNonce() {
      const head = await within(() => client.getFinalizedBlock());
      const release = client.hodlBlock(head.hash);
      try {
        const nonce = await within(() => api.apis.AccountNonceApi.account_nonce(account, { at: head.hash }));
        assert.ok(Number.isSafeInteger(nonce) && nonce >= 0 && nonce <= 0xffffffff, 'Unsupported finalized account nonce');
        return nonce;
      } finally {
        release();
      }
    },
    async store(block, { nonce } = {}) {
      assert.ok(Number.isSafeInteger(nonce) && nonce >= 0 && nonce <= 0xffffffff, 'Explicit nonce required');
      const cid = await verifyBlock(block.cid, block.bytes);
      assert.ok(block.bytes.length <= MAX_BLOCK_BYTES);
      await reserve(block.bytes.length, nonce);
      const hashing = cid.multihash.code === 0x12 ? 'Sha2_256' : cid.multihash.code === 0xb220 ? 'Blake2b256' : null;
      assert.ok(hashing, 'Unsupported hash algorithm');
      // Direct call only. The node indexes the data at the end of this extrinsic.
      const tx = api.tx.TransactionStorage.store_with_cid_config({
        data: block.bytes,
        cid: { codec: BigInt(cid.code), hashing: { type: hashing, value: undefined } }
      });
      const receipt = await watchFinalized(tx, signer, nonce, options);
      issued.get(nonce).finalizedBlock = receipt.block;
      return receipt;
    },
    get attemptedTransactions() {
      return attempts;
    }
  };
}
