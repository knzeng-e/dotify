import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createNativeReceiptService, NativeReceiptUnavailableError } from './nativeReceipts.js';
const input = { hash: `0x${'11'.repeat(32)}` as const, block: { number: 123 } };
it('disabled or unsupported networks never call the archive', async () => {
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    throw new Error('unexpected');
  }) as typeof fetch;
  for (const options of [{ chainId: 420420417 }, { chainId: 1, rpcUrl: 'https://archive.example' }]) {
    await assert.rejects(createNativeReceiptService({ ...options, fetchImpl }).read(input), NativeReceiptUnavailableError);
  }
  assert.equal(calls, 0);
});
it('rejects a different native genesis before reading the transaction', async () => {
  const methods: string[] = [];
  const fetchImpl = (async (_url, init) => {
    const rpc = JSON.parse(init!.body as string);
    methods.push(rpc.method);
    return Response.json({ id: rpc.id, result: input.hash });
  }) as typeof fetch;
  await assert.rejects(createNativeReceiptService({ chainId: 420420417, rpcUrl: 'https://archive.example', fetchImpl }).read(input), /wrong network/);
  assert.deepEqual(methods, ['chain_getBlockHash']);
});
it('rejects mismatched RPC ids and oversized responses without claiming failure', async () => {
  for (const body of [JSON.stringify({ id: -1, result: input.hash }), 'x'.repeat(8 * 1024 * 1024 + 1)]) {
    const fetchImpl = (async () => new Response(body)) as typeof fetch;
    await assert.rejects(
      createNativeReceiptService({ chainId: 420420417, rpcUrl: 'https://archive.example', fetchImpl }).read(input),
      NativeReceiptUnavailableError
    );
  }
});
