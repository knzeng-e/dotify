import { describe, expect, it, vi } from 'vitest';
import { DOTIFY_FALLBACK_NATIVE_RUNTIME_ASSET, createNativeRuntimeAccessPaymentIntent } from './paymentModel';
import { readRuntimeAccessPayment, runtimeAccessPaymentReadbackError, verifyRuntimeAccessPayment } from './paymentReadback';
import type { RuntimeReadPort } from '../runtime/runtimePorts';

const runtimeAddress = '0x3000000000000000000000000000000000000000' as const;
const contentHash = `0x${'ab'.repeat(32)}` as const;
const listenerAddress = '0x4000000000000000000000000000000000000000' as const;

const intent = createNativeRuntimeAccessPaymentIntent({
  runtimeAddress,
  contentHash,
  amountPlanck: 1n,
  asset: DOTIFY_FALLBACK_NATIVE_RUNTIME_ASSET
});

function reader(hasPaid: boolean, canAccess: boolean): RuntimeReadPort {
  return {
    ensureContract: vi.fn(),
    resolveArtistRuntime: vi.fn(),
    getArtistCount: vi.fn(),
    listArtistRuntimes: vi.fn(),
    listRuntimeTracks: vi.fn(),
    canAccess: vi.fn(async () => canAccess),
    hasPaid: vi.fn(async () => hasPaid),
    pendingRuntimeOf: vi.fn(),
    pendingRuntimeStageOf: vi.fn(),
    listRoyaltyPaymentLogs: vi.fn()
  } as unknown as RuntimeReadPort;
}

function sequencedReader(sequence: Array<{ hasPaid: boolean; canAccess: boolean } | Error>): RuntimeReadPort {
  let index = 0;
  let current: { hasPaid: boolean; canAccess: boolean } | Error | null = null;
  let readsFromCurrent = 0;
  const readCurrent = vi.fn(() => {
    current ??= sequence[Math.min(index, Math.max(0, sequence.length - 1))] ?? { hasPaid: false, canAccess: false };
    const value = current;

    readsFromCurrent += 1;
    if (readsFromCurrent >= 2) {
      current = null;
      readsFromCurrent = 0;
      index += 1;
    }

    if (value instanceof Error) throw value;
    return value;
  });

  return {
    ensureContract: vi.fn(),
    resolveArtistRuntime: vi.fn(),
    getArtistCount: vi.fn(),
    listArtistRuntimes: vi.fn(),
    listRuntimeTracks: vi.fn(),
    canAccess: vi.fn(async () => readCurrent().canAccess),
    hasPaid: vi.fn(async () => readCurrent().hasPaid),
    pendingRuntimeOf: vi.fn(),
    pendingRuntimeStageOf: vi.fn(),
    listRoyaltyPaymentLogs: vi.fn()
  } as unknown as RuntimeReadPort;
}

describe('runtime access payment read-back', () => {
  it('reads paid and access state for the exact payment intent account', async () => {
    const runtimeReader = reader(true, true);

    await expect(readRuntimeAccessPayment({ reader: runtimeReader, intent, listenerAddress })).resolves.toEqual({
      intent,
      listenerAddress,
      hasPaid: true,
      canAccess: true
    });

    expect(runtimeReader.hasPaid).toHaveBeenCalledWith(runtimeAddress, contentHash, listenerAddress);
    expect(runtimeReader.canAccess).toHaveBeenCalledWith(runtimeAddress, contentHash, listenerAddress);
  });

  it('explains a missing paid-access grant', () => {
    expect(runtimeAccessPaymentReadbackError({ intent, listenerAddress, hasPaid: false, canAccess: false })).toMatch(/did not confirm paid access/);
  });

  it('explains an inconsistent paid state', () => {
    expect(runtimeAccessPaymentReadbackError({ intent, listenerAddress, hasPaid: true, canAccess: false })).toMatch(/still denies access/);
    expect(runtimeAccessPaymentReadbackError({ intent, listenerAddress, hasPaid: false, canAccess: true })).toMatch(/not a paid Classic grant/);
    expect(runtimeAccessPaymentReadbackError({ intent, listenerAddress, hasPaid: true, canAccess: true })).toBeNull();
  });

  it('polls until the included payment is visible to the reader', async () => {
    const runtimeReader = sequencedReader([
      { hasPaid: false, canAccess: false },
      { hasPaid: false, canAccess: false },
      { hasPaid: true, canAccess: true },
      { hasPaid: true, canAccess: true },
      { hasPaid: true, canAccess: true },
      { hasPaid: true, canAccess: true }
    ]);
    const sleep = vi.fn(async () => undefined);

    await expect(verifyRuntimeAccessPayment({ reader: runtimeReader, intent, listenerAddress, attempts: 3, delayMs: 0, sleep })).resolves.toMatchObject({
      ok: true,
      attempts: 3,
      readback: { hasPaid: true, canAccess: true }
    });
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('returns a bounded failure after transient query errors', async () => {
    const runtimeReader = sequencedReader([new Error('reader is behind'), new Error('reader is still behind')]);
    const sleep = vi.fn(async () => undefined);

    await expect(verifyRuntimeAccessPayment({ reader: runtimeReader, intent, listenerAddress, attempts: 2, delayMs: 0, sleep })).resolves.toMatchObject({
      ok: false,
      attempts: 2,
      readback: null,
      error: 'Runtime access read-back query failed: reader is still behind'
    });
    expect(sleep).toHaveBeenCalledTimes(1);
  });
});
