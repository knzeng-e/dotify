import { describe, expect, it, vi } from 'vitest';
import { Blake2256 } from '@polkadot-api/substrate-bindings';
import { hexToBytes, toHex } from 'viem';
import { FinalizedNativeContributionFailedError, readNativeContributionLogs, type NativeContributionProofDeps } from './nativeContributionProof';

const signed = '0x01020304';
const hash = toHex(Blake2256(hexToBytes(signed)));
const blockHash = `0x${'11'.repeat(32)}` as const;
const runtime = `0x${'22'.repeat(20)}` as const;
const topic = `0x${'33'.repeat(32)}` as const;
function fixture() {
  const success = { phase: { type: 'ApplyExtrinsic', value: 2 }, event: { type: 'System', value: { type: 'ExtrinsicSuccess' } } };
  const emitted = {
    phase: { type: 'ApplyExtrinsic', value: 2 },
    event: { type: 'Revive', value: { type: 'ContractEmitted', value: { contract: runtime, data: '0x1234', topics: [topic] } } }
  };
  const events = [success, emitted, { ...emitted, phase: { type: 'ApplyExtrinsic', value: 1 } }];
  const responses: Record<string, unknown> = {
    chain_getFinalizedHead: blockHash,
    chain_getHeader: { number: '0x7d' },
    chain_getBlockHash: blockHash,
    chain_getBlock: { block: { header: { number: '0x7b' }, extrinsics: ['0x00', '0x01', signed] } },
    state_getStorage: '0x02'
  };
  const request = vi.fn(async <T>(method: string, _params: unknown[]) => responses[method] as T);
  const deps: NativeContributionProofDeps = {
    request: <T>(method: string, params: unknown[]) => request(method, params) as Promise<T>,
    decodeEvents: vi.fn(() => events),
    hashExtrinsic: bytes => toHex(Blake2256(bytes))
  };
  return { deps, responses, events, success, emitted, request };
}
describe('finalized native contribution proof', () => {
  it('checks the canonical block and exact native hash, isolating events to that extrinsic', async () => {
    const f = fixture();
    expect(await readNativeContributionLogs(hash, { number: 123, hash: blockHash, index: 2 }, f.deps)).toEqual([
      { address: runtime, data: '0x1234', topics: [topic], transactionHash: hash, logIndex: 1 }
    ]);
    expect(f.request).toHaveBeenCalledWith('chain_getBlockHash', [123]);
    expect(f.request).toHaveBeenCalledWith('state_getStorage', [expect.any(String), blockHash]);
    expect(f.deps.decodeEvents).toHaveBeenCalledWith(hexToBytes('0x02'));
  });
  it('accepts a block-number-only hint only after finding the saved transaction in it', async () => {
    const f = fixture();
    await expect(readNativeContributionLogs(hash, { number: 123 }, f.deps)).resolves.toHaveLength(1);
    f.responses.chain_getBlock = { block: { header: { number: '0x7b' }, extrinsics: ['0xff'] } };
    await expect(readNativeContributionLogs(hash, { number: 123 }, f.deps)).rejects.toThrow('does not contain');
  });
  it('rejects unfinalized, changed and mismatched block references', async () => {
    const f = fixture();
    await expect(readNativeContributionLogs(hash, { number: 126 }, f.deps)).rejects.toThrow('awaiting finality');
    await expect(readNativeContributionLogs(hash, { number: 123, hash: topic }, f.deps)).rejects.toThrow('block changed');
    await expect(readNativeContributionLogs(hash, { number: 123, index: 1 }, f.deps)).rejects.toThrow('does not contain');
    f.responses.chain_getBlock = { block: { header: { number: '0x7c' }, extrinsics: [signed] } };
    await expect(readNativeContributionLogs(hash, { number: 123 }, f.deps)).rejects.toThrow('does not match');
  });
  it('reports a failed dispatch only after verifying its finalized native transaction', async () => {
    const f = fixture();
    f.events[0] = { ...f.success, event: { type: 'System', value: { type: 'ExtrinsicFailed' } } };
    await expect(readNativeContributionLogs(hash, { number: 123 }, f.deps)).rejects.toBeInstanceOf(FinalizedNativeContributionFailedError);
  });
  it('keeps contradictory dispatch results uncertain instead of authorizing a new payment', async () => {
    const f = fixture();
    f.events.push({ ...f.success, event: { type: 'System', value: { type: 'ExtrinsicFailed' } } });
    await expect(readNativeContributionLogs(hash, { number: 123 }, f.deps)).rejects.toThrow('no verified dispatch');
  });
  it('fails closed on missing dispatch evidence, unavailable events or malformed contract topics', async () => {
    const f = fixture();
    f.events.shift();
    await expect(readNativeContributionLogs(hash, { number: 123 }, f.deps)).rejects.toThrow('no verified dispatch');
    f.events.unshift(f.success);
    f.responses.state_getStorage = null;
    await expect(readNativeContributionLogs(hash, { number: 123 }, f.deps)).rejects.toThrow('events are unavailable');
    f.responses.state_getStorage = '0x02';
    f.emitted.event.value.value.topics = ['0x1234' as typeof topic];
    await expect(readNativeContributionLogs(hash, { number: 123 }, f.deps)).rejects.toThrow('malformed');
  });
});
