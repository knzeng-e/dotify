import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import Fastify from 'fastify';
import { createNativeReceiptRoutes } from './nativeReceipts.js';
import { NativeReceiptUnavailableError, PASEO_ASSET_HUB_GENESIS, type NativeReceiptRequest, type NativeReceiptResponse } from '../services/nativeReceipts.js';
const hash = `0x${'11'.repeat(32)}` as const;
describe('native receipt route', () => {
  it('returns only the verified chain response and rejects caller-selected RPC targets', async () => {
    const app = Fastify();
    let calls = 0;
    await app.register(
      createNativeReceiptRoutes({
        read: async input => {
          calls++;
          return { ...input, genesisHash: PASEO_ASSET_HUB_GENESIS, status: 'success', logs: [] };
        }
      })
    );
    const valid = { hash, block: { number: 123 } };
    const response = await app.inject({ method: 'POST', url: '/api/contributions/native-receipt', payload: valid });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().hash, hash);
    assert.equal(response.headers['cache-control'], 'no-store');
    for (const payload of [
      { ...valid, rpcUrl: 'https://evil.example' },
      { ...valid, block: { number: -1 } },
      { ...valid, hash: 'not-a-hash' }
    ]) {
      assert.equal((await app.inject({ method: 'POST', url: '/api/contributions/native-receipt', payload })).statusCode, 400);
    }
    assert.equal(calls, 1);
    await app.close();
  });
  it('does not turn archive failure into a proved failed transaction', async () => {
    const app = Fastify();
    await app.register(
      createNativeReceiptRoutes({
        read: async (_input: NativeReceiptRequest): Promise<NativeReceiptResponse> => {
          throw new NativeReceiptUnavailableError('Receipt archive unavailable');
        }
      })
    );
    const response = await app.inject({ method: 'POST', url: '/api/contributions/native-receipt', payload: { hash, block: { number: 123 } } });
    assert.equal(response.statusCode, 503);
    assert.equal(response.json().code, 'NATIVE_RECEIPT_UNAVAILABLE');
    assert.equal(response.json().status, undefined);
    await app.close();
  });
});
