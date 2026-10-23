import { createContract } from '@parity/product-sdk/contracts';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { createProductCdmRuntimeWriter, productCdmPaymentWasNotSubmitted } from './productCdmRuntimeAdapter';
import { ProductCdmStorageDepositError, withProductPeakStorageDeposit } from './productCdmStorageDeposit';

const factory = '0x2000000000000000000000000000000000000000' as const;
const origin = '5C62Ck4UrFPiBtoCmeSrgF7x9yv9mn38446dhCpsi2mLHiFT';
const abi: Parameters<typeof createContract>[2] = [
  { type: 'function', name: 'createRuntime', stateMutability: 'nonpayable', inputs: [], outputs: [{ name: 'runtime', type: 'address' }] },
  { type: 'function', name: 'installRuntimeStep', stateMutability: 'nonpayable', inputs: [], outputs: [{ name: 'stage', type: 'uint8' }] }
];
const weight = { ref_time: 3_650_728_452n, proof_size: 294_386n };
const hash = `0x${'ab'.repeat(32)}`;
const result = () => ({
  weight_consumed: weight,
  weight_required: weight,
  storage_deposit: { type: 'Charge' as const, value: 52_800_000n },
  max_storage_deposit: { type: 'Charge' as const, value: 105_600_000n },
  gas_consumed: 6661n,
  result: { success: true as const, value: { flags: 0, data: new Uint8Array(32) } }
});

function fixture(value: unknown = result()) {
  const events = new Subject();
  const transaction = { createSubmitAndWatch: vi.fn(() => events) };
  const call = vi.fn((_args: Record<string, unknown>) => transaction);
  const dryRunCall = vi.fn(async () => value);
  const raw = { api: { tx: { Revive: { call } } }, dryRunCall } as unknown as Parameters<typeof withProductPeakStorageDeposit>[0];
  const runtime = withProductPeakStorageDeposit(raw);
  const defaults = { defaultOrigin: origin, defaultSigner: { publicKey: new Uint8Array(32), signTx: vi.fn() } };
  const contract = createContract(runtime, factory, abi, defaults as never);
  return { raw, runtime, call, dryRunCall, transaction, events, contract, defaults };
}

describe('Product CDM peak storage sizing', () => {
  it('fixes SDK preparation for bootstrap finalization with an intermediate peak and later refund', async () => {
    const f = fixture();
    await createContract(f.raw, factory, abi, f.defaults as never).installRuntimeStep.prepare();
    expect(f.call.mock.calls[0][0]).toMatchObject({ storage_deposit_limit: 52_800_000n });
    await f.contract.installRuntimeStep.prepare();
    expect(f.call.mock.calls[1][0]).toMatchObject({ storage_deposit_limit: 105_600_000n, weight_limit: weight, value: 0n });
    expect(f.call.mock.calls[1][0].data).toEqual(f.call.mock.calls[0][0].data);
    expect((await f.raw.dryRunCall(origin, factory, 0n, undefined, undefined, new Uint8Array())).storage_deposit.value).toBe(52_800_000n);
  });

  it.each([
    ['Refund', 20n, 'Charge', 80n, 80n],
    ['Charge', 0n, 'Charge', 0n, 0n],
    ['Refund', 20n, 'Refund', 10n, 0n]
  ] as const)('sizes net %s %s / peak %s %s without an unlimited deposit', async (netType, netValue, peakType, peakValue, limit) => {
    const f = fixture({ ...result(), storage_deposit: { type: netType, value: netValue }, max_storage_deposit: { type: peakType, value: peakValue } });
    await f.contract.installRuntimeStep.prepare();
    expect(f.call.mock.calls[0][0]).toMatchObject({ storage_deposit_limit: limit });
  });

  it.each([undefined, { type: 'Charge', value: -1n }, { type: 'Charge', value: 1n }, { type: 'Charge', value: '105600000' }])(
    'rejects missing or inconsistent peak evidence before constructing a transaction',
    async peak => {
      const f = fixture({ ...result(), max_storage_deposit: peak });
      await expect(f.contract.installRuntimeStep.prepare()).rejects.toBeInstanceOf(ProductCdmStorageDepositError);
      expect(f.call).not.toHaveBeenCalled();
      expect(f.transaction.createSubmitAndWatch).not.toHaveBeenCalled();
      expect(productCdmPaymentWasNotSubmitted(new ProductCdmStorageDepositError())).toBe(true);
    }
  );

  it.each([
    { success: false, value: { type: 'ContractReverted' } },
    { success: true, value: { flags: 1, data: new Uint8Array() } }
  ])('preserves dispatch and contract-revert failures without signing', async failure => {
    const f = fixture({ ...result(), result: failure, max_storage_deposit: undefined });
    const prepared = await f.contract.installRuntimeStep.prepare();
    expect(prepared.ok).toBe(false);
    expect(f.call).not.toHaveBeenCalled();
  });

  it.each(['createRuntime', 'installRuntimeStep'] as const)('waits for finality before resolving %s to onboarding', async method => {
    const f = fixture();
    const writer = createProductCdmRuntimeWriter({
      nativeTokenDecimals: 10,
      contracts: { getFactoryContract: () => f.contract, getDirectoryContract: () => ({}), getRuntimeContract: () => ({}) }
    });
    let resolved = false;
    const pending = writer[method](factory).then(value => {
      resolved = true;
      return value;
    });
    await vi.waitFor(() => expect(f.transaction.createSubmitAndWatch).toHaveBeenCalledTimes(1));
    const common = { ok: true, txHash: hash, events: [], block: { hash, number: 100, index: 0 } };
    f.events.next({ type: 'inBestBlock', ...common });
    await Promise.resolve();
    expect(resolved).toBe(false);
    f.events.next({ type: 'finalized', ...common });
    await expect(pending).resolves.toBe(hash);
  });
});
