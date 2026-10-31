// Explicit PAPI 3 composition for the prepared server adapter. Caller transfers
// ownership of a dedicated client; abort/close destroys it. No network defaults,
// environment signer, wallet selection, auto-renewal or retry.
import assert from 'node:assert/strict';
import { createBulletinRpcTransport } from '../../services/api/src/services/bulletinTransport.ts';
import { verifyBulletinBlock, BULLETIN_GRAPH_MAX } from '../../services/api/src/services/bulletinGraph.ts';
import { watchFinalized } from './finalized-store.mjs';

export function createPapiMediaTransport({ client, identity, signer = null, budget }) {
  identity = { ...identity };
  assert.ok(client && typeof client._request === 'function' && typeof client.destroy === 'function', 'Dedicated PAPI client required');
  assert.ok(
    signer === null || (signer.account === identity.account && typeof signer.createTransaction === 'function'),
    'Explicit matching transaction creator required'
  );
  assert.ok(
    budget &&
      Number.isSafeInteger(budget.maxBytes) &&
      budget.maxBytes > 0 &&
      budget.maxBytes <= 2 * BULLETIN_GRAPH_MAX &&
      Number.isSafeInteger(budget.maxTransactions) &&
      budget.maxTransactions > 0 &&
      budget.maxTransactions <= 8192,
    'Explicit bounded session allowance required'
  );
  const allowance = { ...budget },
    issued = new Map();
  let closed = false,
    requests = 0,
    attempts = 0,
    bytes = 0,
    reservation = Promise.resolve();
  const close = () => {
    if (!closed) {
      closed = true;
      client.destroy();
    }
  };
  const request = async (method, params, signal) => {
    signal.throwIfAborted();
    assert.ok(!closed, 'Bulletin client is closed; create a new transport for reconciliation');
    assert.ok(requests < 16, 'Bulletin RPC concurrency limit reached');
    requests++;
    let abort;
    try {
      return await Promise.race([
        Promise.resolve().then(() => {
          signal.throwIfAborted();
          return client._request(method, params);
        }),
        new Promise((_, reject) => {
          abort = () => {
            close();
            reject(signal.reason);
          };
          signal.addEventListener('abort', abort, { once: true });
          if (signal.aborted) abort();
        })
      ]);
    } finally {
      requests--;
      signal.removeEventListener('abort', abort);
    }
  };
  const submit =
    signer &&
    (async (block, intent, signal) => {
      const reserve = reservation.then(async () => {
        signal.throwIfAborted();
        assert.ok(!closed && !issued.has(intent.nonce), 'Closed transport or already issued nonce');
        assert.ok(attempts < allowance.maxTransactions && bytes + block.bytes.length <= allowance.maxBytes, 'Bulletin live session allowance exhausted');
        const status = await transport.status(signal);
        const outstanding = [...issued.values()].filter(entry => entry.block === null || entry.block > status.head);
        assert.ok(
          status.authorization.expiresAt > status.head + 100 &&
            status.authorization.remainingTransactions >= outstanding.length + 1 &&
            status.authorization.remainingBytes >= BigInt(block.bytes.length + outstanding.reduce((sum, entry) => sum + entry.bytes, 0)),
          'Bulletin quota does not cover outstanding reservations'
        );
        issued.set(intent.nonce, { bytes: block.bytes.length, block: null });
        attempts++;
        bytes += block.bytes.length;
      });
      reservation = reserve.catch(() => {});
      await reserve;
      const abort = () => close();
      signal.addEventListener('abort', abort, { once: true });
      try {
        signal.throwIfAborted();
        const cid = verifyBulletinBlock(block.cid, block.bytes);
        const tx = client.getUnsafeApi().tx.TransactionStorage.store_with_cid_config({
          data: block.bytes,
          cid: { codec: BigInt(cid.code), hashing: { type: 'Blake2b256', value: undefined } }
        });
        const position = await watchFinalized(tx, signer.createTransaction, intent.nonce, { timeoutMs: 25000, signal });
        issued.get(intent.nonce).block = position.block;
        const receipt = await transport.lookup(block.cid, signal);
        assert.ok(receipt && receipt.block === position.block && receipt.index === position.index, 'Finalized store differs from CID readback');
        return { ...receipt, account: identity.account, nonce: intent.nonce };
      } finally {
        signal.removeEventListener('abort', abort);
      }
    });
  const transport = createBulletinRpcTransport({ identity, request, ...(submit ? { submit } : {}) });
  return {
    transport,
    close,
    get attemptedTransactions() {
      return attempts;
    }
  };
}
