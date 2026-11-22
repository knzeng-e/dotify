import { afterEach, describe, expect, it, vi } from 'vitest';
import { deriveH160, ss58Encode, ss58Decode } from '@parity/product-sdk/address';
import { createAccountReader, type AccountReaderDeps } from './account';
import { accountQualificationReport } from './accountReport';
const host = { status: 'reported', platform: 'Ios', name: 'Polkadot App', version: '0.10.0 (23)', runtimeVersion: '0.31.0' };
// Public test vector only. Never a signer or fallback in the application.
const key = Uint8Array.from('d43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d'.match(/../g)!.map(byte => parseInt(byte, 16)));
const value = { dotNsIdentifier: 'dotify-test01.dot', derivationIndex: 0, publicKey: key };
const build = {
  source: 'a'.repeat(40),
  clean: true,
  configDigest: 'b'.repeat(64),
  productId: 'dotify-test01.dot',
  appVersion: '0.1.90',
  sdk: { product: '0.45.0', host: '0.34.0', truapi: '0.31.0' }
};
function fixture(input: unknown = value) {
  const getProductAccount = vi.fn(() => ({ match: async <T>(ok: (account: typeof value) => T) => ok(input as typeof value) }));
  const deps: AccountReaderDeps = { provider: { getProductAccount }, deriveH160, ss58Encode };
  return { deps, getProductAccount, load: vi.fn(async () => deps) };
}
afterEach(() => vi.useRealTimers());
describe('account qualification without signing', () => {
  it('requests only the fixed Product/index, validates the response and derives both known addresses', async () => {
    const f = fixture({ ...value, token: 'SECRET' });
    const result = await createAccountReader(f.load)(host, new AbortController().signal);
    expect(f.getProductAccount).toHaveBeenCalledExactlyOnceWith('dotify-test01.dot', 0);
    expect(result).toMatchObject({
      status: 'reported',
      accountRequested: true,
      substrateAddress: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
      evmAddress: '0x9621dde636de098b43efb0fa9b61facfe328f99d'
    });
    if (result?.status !== 'reported') throw new Error('Expected public addresses');
    expect(ss58Decode(result.substrateAddress).publicKey).toEqual(key);
    expect(JSON.stringify(result)).not.toContain('SECRET');
  });
  it('supports the separate EVM-derived 0xee-padding vector', async () => {
    const padded = new Uint8Array(32).fill(0xee);
    padded.fill(0x12, 0, 20);
    const f = fixture({ ...value, publicKey: padded });
    expect(await createAccountReader(f.load)(host, new AbortController().signal)).toMatchObject({ status: 'reported', evmAddress: `0x${'12'.repeat(20)}` });
  });
  it.each([undefined, { ...host, runtimeVersion: undefined }, { ...host, runtimeVersion: '0.26.0' }, { ...host, runtimeVersion: '0.31.0-rc.1' }])(
    'refuses an unsupported info observation without loading accounts',
    async observation => {
      const f = fixture();
      expect(await createAccountReader(f.load)(observation, new AbortController().signal)).toEqual({ status: 'unsupported-runtime', accountRequested: false });
      expect(f.load).not.toHaveBeenCalled();
    }
  );
  it.each([
    null,
    { ...value, dotNsIdentifier: 'other.dot' },
    { ...value, derivationIndex: 1 },
    { ...value, publicKey: new Uint8Array(20) },
    { ...value, publicKey: Array.from(key) },
    { ...value, publicKey: new Uint8Array(32) }
  ])('does not accept malformed or mismatched account payloads', async input => {
    const f = fixture(input);
    const result = await createAccountReader(f.load)(host, new AbortController().signal);
    expect(result?.status).not.toBe('reported');
    expect(JSON.stringify(result)).not.toContain('publicKey');
  });
  it('reports denial without raw error export or automatic retry', async () => {
    const f = fixture();
    f.deps.provider = {
      getProductAccount: vi.fn(() => ({ match: async <T>(_ok: (account: typeof value) => T, error: (reason: unknown) => T) => error('PRIVATE_DENIAL') }))
    };
    const read = createAccountReader(f.load);
    expect(await read(host, new AbortController().signal)).toEqual({ status: 'unavailable', accountRequested: true });
    expect(await read(host, new AbortController().signal)).toEqual({ status: 'unavailable', accountRequested: false });
    expect(f.load).toHaveBeenCalledTimes(1);
  });
  it('reports an absent Host without inventing a browser account', async () => {
    const f = fixture();
    f.deps.provider = null;
    expect(await createAccountReader(f.load)(host, new AbortController().signal)).toEqual({ status: 'unavailable', accountRequested: false });
  });
  it('bounds a stalled lookup, ignores its late result and refuses a second prompt', async () => {
    vi.useFakeTimers();
    const f = fixture();
    let release!: () => void;
    const waiting = new Promise<void>(resolve => {
      release = resolve;
    });
    f.deps.provider = {
      getProductAccount: vi.fn(() => ({
        match: async <T>(ok: (account: typeof value) => T) => {
          await waiting;
          return ok(value);
        }
      }))
    };
    const read = createAccountReader(f.load, 100);
    const pending = read(host, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(100);
    const result = await pending;
    expect(result).toEqual({ status: 'timeout', accountRequested: true });
    release();
    await Promise.resolve();
    expect(await read(host, new AbortController().signal)).toEqual({ status: 'unavailable', accountRequested: false });
    expect(result).not.toHaveProperty('publicKey');
  });
  it('does not request an account after unmount while loading the SDK', async () => {
    vi.useFakeTimers();
    const f = fixture();
    let release!: (deps: AccountReaderDeps) => void;
    const read = createAccountReader(
      () =>
        new Promise(resolve => {
          release = resolve;
        }),
      100
    );
    const controller = new AbortController();
    const pending = read(host, controller.signal);
    await Promise.resolve();
    controller.abort();
    expect(await pending).toBeNull();
    release(f.deps);
    await vi.advanceTimersByTimeAsync(150);
    expect(f.getProductAccount).not.toHaveBeenCalled();
  });
  it('does not start a queued lookup after its SDK-loading deadline', async () => {
    vi.useFakeTimers();
    const f = fixture();
    let release!: (deps: AccountReaderDeps) => void;
    const read = createAccountReader(
      () =>
        new Promise(resolve => {
          release = resolve;
        }),
      100
    );
    const pending = read(host, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(100);
    expect(await pending).toEqual({ status: 'timeout', accountRequested: false });
    release(f.deps);
    await vi.advanceTimersByTimeAsync(1);
    expect(f.getProductAccount).not.toHaveBeenCalled();
    expect(await read(host, new AbortController().signal)).toEqual({ status: 'unavailable', accountRequested: false });
  });
  it('does not export extra account fields or claim signing, chain mapping or automatic owner confirmation', async () => {
    const result = await createAccountReader(fixture().load)(host, new AbortController().signal);
    if (result?.status !== 'reported') throw new Error('Missing observation');
    const report = accountQualificationReport(
      build,
      host,
      '2026-11-22T00:00:00Z',
      Object.assign({}, result, { secret: 'PRIVATE' }),
      false,
      '2026-11-22T00:00:02Z'
    );
    expect(report.build).toEqual(build);
    expect(report.accountRequestedAt).toBe('2026-11-22T00:00:02Z');
    expect(JSON.stringify(report)).not.toContain('PRIVATE');
    expect(report.account).toMatchObject({ ownerConfirmed: false, addressMapping: 'local-sdk-derivation-only' });
    expect(report.boundary).toMatchObject({
      accountRequested: true,
      chainQueried: false,
      signingRequested: false,
      chainMappingVerified: false,
      signerControlVerified: false
    });
    expect(accountQualificationReport(build, host, '', result, true).account).toMatchObject({ ownerConfirmed: true });
    expect(accountQualificationReport(build, host, '', undefined, true).account).toEqual({ status: 'not-requested' });
  });
});
