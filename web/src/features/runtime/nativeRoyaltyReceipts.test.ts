import { expect, it, vi } from 'vitest';
import { encodeEventTopics, encodeAbiParameters } from 'viem';
import { musicRoyaltiesAbi } from '../../generated/contracts/musicRoyalties';
import { createNativeRoyaltyReceiptQueue } from './nativeRoyaltyReceipts';
const hash = `0x${'11'.repeat(32)}` as const;
const runtime = `0x${'22'.repeat(20)}` as const;
const block = { number: 100, index: 2, hash };
const genesis = '0xd6eec26135305a8ad257a20d003357284c8aa03d0bdb2b357ab0a22371e11ef2';
const apiUrl = 'https://api.example';
function fixture() {
  const values = new Map<string, string>();
  const store = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    }
  };
  return { values, store };
}
const response = () =>
  new Response(
    JSON.stringify({
      hash,
      block,
      genesisHash: genesis,
      status: 'success',
      logs: [
        {
          address: runtime,
          data: encodeAbiParameters([{ type: 'uint256' }], [1n]),
          topics: encodeEventTopics({ abi: musicRoyaltiesAbi, eventName: 'MusicRoyRoyaltyClaimed', args: { recipient: runtime } }),
          transactionHash: hash,
          logIndex: 0
        }
      ]
    })
  );
it('retains a finalized reference through API outage and reload, then verifies once without another write', async () => {
  const { values, store } = fixture();
  const queue = createNativeRoyaltyReceiptQueue(() => store);
  await queue.enqueue(apiUrl, { hash, runtime, block });
  await expect(queue.flush(apiUrl, runtime, vi.fn().mockRejectedValue(new Error('offline')))).rejects.toThrow();
  expect([...values.values()][0]).toContain(hash);
  const restored = createNativeRoyaltyReceiptQueue(() => store);
  const fetchImpl = vi.fn().mockImplementation(response);
  await restored.flush(apiUrl, runtime, fetchImpl);
  await restored.flush(apiUrl, runtime, fetchImpl);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  expect(fetchImpl.mock.calls[0][0]).toBe(`${apiUrl}/api/payments/native-receipt`);
  expect([...values.values()][0]).toBe('[]');
});
it('does not discard an unverifiable reference or substitute a missing block', async () => {
  const { store } = fixture();
  const queue = createNativeRoyaltyReceiptQueue(() => store);
  await queue.enqueue(apiUrl, { hash, runtime });
  const fetchImpl = vi.fn();
  await expect(queue.flush(apiUrl, runtime, fetchImpl)).rejects.toThrow('without its native block');
  expect(fetchImpl).not.toHaveBeenCalled();
  await queue.enqueue(apiUrl, { hash, runtime, block });
  await expect(queue.flush(apiUrl, runtime, vi.fn().mockResolvedValue(new Response(JSON.stringify({ hash, block, genesisHash: hash }))))).rejects.toThrow(
    'different network'
  );
});
it('isolates API/runtime scopes and never clears a reference before durable confirmation', async () => {
  const { store } = fixture();
  const queue = createNativeRoyaltyReceiptQueue(() => store);
  await queue.enqueue(apiUrl, { hash, runtime, block });
  const fetchImpl = vi.fn().mockImplementation(response);
  await queue.flush('https://other.example', runtime, fetchImpl);
  await queue.flush(apiUrl, `0x${'33'.repeat(20)}`, fetchImpl);
  expect(fetchImpl).not.toHaveBeenCalled();
  await queue.flush(apiUrl, runtime, fetchImpl);
  expect(fetchImpl).toHaveBeenCalledOnce();
});

it('repairs a saved hash with missing block metadata using only verified existing-receipt reads', async () => {
  const { store } = fixture();
  const queue = createNativeRoyaltyReceiptQueue(() => store);
  await queue.enqueue(apiUrl, { hash, runtime });
  const fetchImpl = vi.fn().mockImplementation(response);
  await expect(queue.flush(apiUrl, runtime, fetchImpl)).rejects.toThrow('without its native block');
  await queue.recover(apiUrl, hash, { number: block.number }, fetchImpl);
  await queue.flush(apiUrl, runtime, fetchImpl);
  expect(fetchImpl).toHaveBeenCalledOnce();
});

it('bounds sync batches and shares one deadline without discarding the next saved receipt', async () => {
  const { store } = fixture();
  const queue = createNativeRoyaltyReceiptQueue(() => store);
  for (let n = 1; n <= 5; n++) await queue.enqueue(apiUrl, { hash: `0x${n.toString(16).padStart(64, '0')}`, runtime, block });
  const signals: AbortSignal[] = [];
  const fetchImpl = vi.fn(async (_url, init) => {
    const request = JSON.parse(init.body);
    signals.push(init.signal);
    const body = await response().json();
    return new Response(
      JSON.stringify({ ...body, hash: request.hash, logs: body.logs.map((log: Record<string, unknown>) => ({ ...log, transactionHash: request.hash })) })
    );
  });
  await expect(queue.flush(apiUrl, runtime, fetchImpl)).rejects.toThrow('More saved native payments');
  expect(fetchImpl).toHaveBeenCalledTimes(4);
  expect(new Set(signals).size).toBe(1);
  await queue.flush(apiUrl, runtime, fetchImpl);
  expect(fetchImpl).toHaveBeenCalledTimes(5);
});
