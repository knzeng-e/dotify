import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Blake2256 } from '@polkadot-api/substrate-bindings';
import { hexToBytes, toHex } from 'viem';
import {
  FinalizedNativeContributionFailedError,
  readNativeContributionLogs,
  type EventRecord,
  type NativeContributionProofDeps
} from './nativeContributionProof.js';
const signed = '0x01020304';
const hash = toHex(Blake2256(hexToBytes(signed)));
const blockHash = `0x${'11'.repeat(32)}` as const;
const runtime = `0x${'22'.repeat(20)}` as const;
const topic = `0x${'33'.repeat(32)}` as const;
function fixture() {
  const events: EventRecord[] = [
    { phase: { type: 'ApplyExtrinsic', value: 2 }, event: { type: 'System', value: { type: 'ExtrinsicSuccess' } } },
    {
      phase: { type: 'ApplyExtrinsic', value: 2 },
      event: { type: 'Revive', value: { type: 'ContractEmitted', value: { contract: runtime, data: '0x1234', topics: [topic] } } }
    }
  ];
  const responses: Record<string, unknown> = {
    chain_getFinalizedHead: blockHash,
    chain_getHeader: { number: '0x7d' },
    chain_getBlockHash: blockHash,
    chain_getBlock: { block: { header: { number: '0x7b' }, extrinsics: ['0x00', '0x01', signed] } },
    state_getStorage: '0x02'
  };
  const calls: Array<[string, unknown[]]> = [];
  const deps: NativeContributionProofDeps = {
    request: async <T>(method: string, params: unknown[]) => {
      calls.push([method, params]);
      return responses[method] as T;
    },
    decodeEvents: () => events,
    hashExtrinsic: bytes => toHex(Blake2256(bytes))
  };
  return { deps, responses, events, calls };
}
describe('native contribution chain proof', () => {
  it('verifies the exact hash and isolates the target extrinsic events', async () => {
    const f = fixture();
    f.events.push({ ...f.events[1], phase: { type: 'ApplyExtrinsic', value: 1 } });
    assert.deepEqual(await readNativeContributionLogs(hash, { number: 123, hash: blockHash, index: 2 }, f.deps), [
      { address: runtime, data: '0x1234', topics: [topic], transactionHash: hash, logIndex: 1 }
    ]);
    assert.ok(f.calls.some(([method, params]) => method === 'chain_getBlockHash' && params[0] === 123));
  });
  it('accepts a number hint only after finding the saved hash in that block', async () => {
    const f = fixture();
    assert.equal((await readNativeContributionLogs(hash, { number: 123 }, f.deps)).length, 1);
    f.responses.chain_getBlock = { block: { header: { number: '0x7b' }, extrinsics: ['0xff'] } };
    await assert.rejects(readNativeContributionLogs(hash, { number: 123 }, f.deps), /does not contain/);
  });
  it('rejects unfinalized, changed and mismatched blocks', async () => {
    const f = fixture();
    await assert.rejects(readNativeContributionLogs(hash, { number: 126 }, f.deps), /awaiting finality/);
    await assert.rejects(readNativeContributionLogs(hash, { number: 123, hash: topic }, f.deps), /block changed/);
    await assert.rejects(readNativeContributionLogs(hash, { number: 123, index: 1 }, f.deps), /does not contain/);
  });
  it('proves failed dispatch only after verifying native finality and hash', async () => {
    const f = fixture();
    f.events[0].event.value.type = 'ExtrinsicFailed';
    await assert.rejects(readNativeContributionLogs(hash, { number: 123 }, f.deps), FinalizedNativeContributionFailedError);
  });
  it('keeps ambiguous dispatch and missing event storage uncertain', async () => {
    const f = fixture();
    f.events.push({ phase: { type: 'ApplyExtrinsic', value: 2 }, event: { type: 'System', value: { type: 'ExtrinsicFailed' } } });
    await assert.rejects(readNativeContributionLogs(hash, { number: 123 }, f.deps), /no verified dispatch/);
    f.responses.state_getStorage = null;
    await assert.rejects(readNativeContributionLogs(hash, { number: 123 }, f.deps), /events are unavailable/);
  });
});
