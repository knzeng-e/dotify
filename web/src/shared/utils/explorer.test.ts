import { describe, expect, it } from 'vitest';
import { getBlockscoutTxUrl, getSubscanExtrinsicUrl, getTransactionProofUrl } from './explorer';

const txHash = `0x${'ab'.repeat(32)}` as const;

describe('transaction explorer routing', () => {
  it('keeps ordinary EVM transactions on Blockscout', () => {
    expect(getTransactionProofUrl(txHash)).toBe(getBlockscoutTxUrl(txHash));
    expect(getTransactionProofUrl(txHash, 'evm-transaction')).toContain(`/tx/${txHash}`);
  });

  it('opens Product CDM hashes as Paseo Asset Hub extrinsics', () => {
    expect(getTransactionProofUrl(txHash, 'substrate-extrinsic')).toBe(getSubscanExtrinsicUrl(txHash));
    expect(getSubscanExtrinsicUrl(txHash)).toBe(`https://assethub-paseo.subscan.io/extrinsic/${txHash}`);
  });
});
