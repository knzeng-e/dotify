import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProductDonationPort, nativeDonationAsset } from './productDonation';
import { SupportNotSubmittedError } from '../payments/supportPayment';
const m = vi.hoisted(() => ({
  mapped: vi.fn(),
  toH160: vi.fn(),
  fallback: vi.fn(),
  transfer: vi.fn(),
  submit: vi.fn(),
  clientDestroy: vi.fn(),
  signerDestroy: vi.fn(),
  signer: {},
  manager: vi.fn()
}));
vi.mock('../runtime/runtimeWriterProvider', () => ({ createProductSignerManager: m.manager }));
vi.mock('@parity/product-sdk-descriptors/devnet-asset-hub', () => ({ devnet_asset_hub: {} }));
vi.mock('@parity/product-sdk/chain', () => ({
  createChainClient: async () => ({
    raw: {
      assetHub: {
        getChainSpecData: async () => ({ properties: { tokenDecimals: 10, tokenSymbol: 'PAS' }, genesisHash: `0x${'ab'.repeat(32)}` }),
        getTypedApi: () => ({ query: { Revive: { OriginalAccount: { getValue: m.mapped } } }, tx: { Balances: { transfer_keep_alive: m.transfer } } })
      }
    },
    destroy: m.clientDestroy
  })
}));
vi.mock('@parity/product-sdk/address', () => ({ ss58ToH160: m.toH160, h160ToSs58: m.fallback }));
vi.mock('@parity/product-sdk-tx', () => ({ submitAndWatch: m.submit }));
const recipient = `0x${'22'.repeat(20)}` as const;
const hash = `0x${'33'.repeat(32)}` as const;
const account = { productId: 'dotify-test01.dot', publicKey: `0x${'44'.repeat(32)}` as const, evmAddress: `0x${'11'.repeat(20)}` as const };
beforeEach(() => {
  vi.resetAllMocks();
  m.mapped.mockResolvedValue('native-artist');
  m.toH160.mockReturnValue(recipient);
  m.fallback.mockReturnValue('evm-derived-artist');
  m.transfer.mockReturnValue({});
  m.manager.mockResolvedValue({ getSigner: () => m.signer, destroy: m.signerDestroy });
  m.submit.mockResolvedValue({ ok: true, value: { ok: true, txHash: hash } });
});
describe('native Product gifts', () => {
  it('uses native units, resolves the original artist account, preserves sender balance and awaits finality', async () => {
    const port = await createProductDonationPort(account);
    expect(port.asset.decimals).toBe(10);
    await expect(port.send(recipient, 2500000000n)).resolves.toEqual({ hash, finalized: true });
    expect(m.transfer).toHaveBeenCalledWith({ dest: { type: 'Id', value: 'native-artist' }, value: 2500000000n });
    expect(m.manager).toHaveBeenCalledWith(account);
    expect(m.submit).toHaveBeenCalledWith({}, m.signer, { waitFor: 'finalized' });
    expect(m.fallback).not.toHaveBeenCalled();
    expect(m.signerDestroy).toHaveBeenCalledOnce();
    port.destroy();
    expect(m.clientDestroy).toHaveBeenCalledOnce();
  });
  it('only uses the SDK EVM-derived fallback when no original mapping exists', async () => {
    m.mapped.mockResolvedValue(undefined);
    await (await createProductDonationPort(account)).send(recipient, 1n);
    expect(m.fallback).toHaveBeenCalledWith(recipient);
    expect(m.transfer).toHaveBeenCalledWith({ dest: { type: 'Id', value: 'evm-derived-artist' }, value: 1n });
  });
  it('rejects a mismatched destination before requesting a signer', async () => {
    m.toH160.mockReturnValue(account.evmAddress);
    await expect((await createProductDonationPort(account)).send(recipient, 1n)).rejects.toBeInstanceOf(SupportNotSubmittedError);
    expect(m.manager).not.toHaveBeenCalled();
    expect(m.submit).not.toHaveBeenCalled();
  });
  it('preserves signing rejection and destroys the manager', async () => {
    const rejection = Object.assign(new Error('Rejected'), { name: 'TxSigningRejectedError' });
    m.submit.mockResolvedValue({ ok: false, error: rejection });
    await expect((await createProductDonationPort(account)).send(recipient, 1n)).rejects.toBe(rejection);
    expect(m.signerDestroy).toHaveBeenCalledOnce();
  });
  it('does not treat failed finalized dispatch as a confirmed gift', async () => {
    m.submit.mockResolvedValue({ ok: true, value: { ok: false, txHash: hash } });
    await expect((await createProductDonationPort(account)).send(recipient, 1n)).rejects.toThrow('not confirmed');
  });
  it('refuses ambiguous or missing chain currency properties', () => {
    expect(nativeDonationAsset({ tokenDecimals: [10], tokenSymbol: ['PAS'] }, hash).decimals).toBe(10);
    expect(() => nativeDonationAsset({ tokenDecimals: [10, 18], tokenSymbol: 'PAS' }, hash)).toThrow();
    expect(() => nativeDonationAsset({}, hash)).toThrow();
  });
});
