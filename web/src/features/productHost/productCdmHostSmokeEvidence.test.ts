import { describe, expect, it, vi } from 'vitest';

import {
  PRODUCT_CDM_HOST_SMOKE_STORAGE_KEY,
  appendProductCdmHostSmokeEvent,
  bindProductCdmHostSmokeCandidate,
  buildProductCdmHostSmokeEvidence,
  getProductCdmHostSmokeSessionCandidate,
  normalizeProductHostKeySmokeDetail,
  readProductCdmHostSmokeEvents,
  recordProductCdmHostSmokeEvent,
  serializeProductCdmHostSmokeEvidence,
  type ProductCdmHostSmokeContext,
  type ProductCdmHostSmokeEvent
} from './productCdmHostSmokeEvidence';

const ADDRESS = '0x1111111111111111111111111111111111111111' as const;
const RUNTIME = '0x2222222222222222222222222222222222222222' as const;
const PRODUCT_PUBLIC_KEY = `0x${'33'.repeat(32)}` as const;
const CONTENT_HASH = `0x${'ab'.repeat(32)}` as const;
const TX_HASH = `0x${'cd'.repeat(32)}` as const;
const CONTENT_KEY = `0x${'ef'.repeat(32)}` as const;
const PRODUCT_SIGNATURE = `0x${'44'.repeat(64)}` as const;
const BUILD_SHA = '1234567890abcdef1234567890abcdef12345678';
const DEPLOYED_CID = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3ooqb5x4nqyd7bkhzbr6f5o4e';
const OTHER_DEPLOYED_CID = 'QmYwAPJzv5CZsnAzt8auVZRnGi2C19Rhdm9zYgC5xA7a7H';

function memoryStorage(entries: Array<[string, string]> = []) {
  const store = new Map(entries);
  return {
    store,
    storage: {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        store.delete(key);
      })
    }
  };
}

function smokeContext(overrides: Partial<ProductCdmHostSmokeContext> = {}): ProductCdmHostSmokeContext {
  return {
    buildSha: BUILD_SHA,
    productAppVersion: '[0, 1, 20]',
    deployedCid: DEPLOYED_CID,
    productId: 'dotify-test01.dot',
    publicAppUrl: 'https://dotify-test01.dev-dot.li',
    cdmRegistry: '0x05662b3dbd5dd9f2ff92d67630477e84b0b37c1f',
    productHostMode: 'required',
    productHostStatus: 'available',
    runtimeAdapterKind: 'product-cdm',
    walletMethod: 'product-host',
    listenerAddress: ADDRESS,
    substrateAddress: '5ProductAccount',
    productPublicKey: PRODUCT_PUBLIC_KEY,
    expectedChainId: 420420417,
    apiConfigured: true,
    ...overrides
  };
}

function completeEvents(): ProductCdmHostSmokeEvent[] {
  return [
    { kind: 'operator-observation', observation: 'host-approval-explicit', ok: true, timestamp: 1_000 },
    {
      kind: 'payment',
      txHash: TX_HASH,
      runtimeAddress: RUNTIME,
      contentHash: CONTENT_HASH,
      listenerAddress: ADDRESS,
      amountPlanck: '250000000000',
      hasPaid: true,
      canAccess: true,
      attempts: 2,
      ok: true,
      error: null,
      timestamp: 2_000
    },
    {
      kind: 'key',
      phase: 'session-created',
      path: 'session',
      signatureScheme: 'product-sr25519-v1',
      address: ADDRESS,
      productPublicKey: PRODUCT_PUBLIC_KEY,
      chainId: 420420417,
      timestamp: 2_500
    },
    {
      kind: 'key',
      phase: 'key-allowed',
      path: 'session',
      signatureScheme: 'product-sr25519-v1',
      address: ADDRESS,
      productPublicKey: PRODUCT_PUBLIC_KEY,
      chainId: 420420417,
      purpose: 'individual',
      contentHash: CONTENT_HASH,
      access: 'allowed',
      playbackMode: 'full',
      runtime: RUNTIME,
      timestamp: 3_000
    }
  ];
}

describe('product CDM host smoke evidence', () => {
  it('summarizes a complete Product host payment and key-release smoke', () => {
    const evidence = buildProductCdmHostSmokeEvidence(smokeContext(), completeEvents(), new Date('2026-09-03T10:00:00.000Z'));

    expect(evidence.summary).toEqual({ tone: 'ok', label: 'Evidence complete', problemCount: 0 });
    expect(evidence.schemaVersion).toBe(2);
    expect(evidence.candidate).toEqual({ gitSha: BUILD_SHA, productAppVersion: '[0, 1, 20]', deployedCid: DEPLOYED_CID });
    expect(evidence.checks.map(check => [check.id, check.tone])).toEqual([
      ['candidate-identity', 'ok'],
      ['product-account', 'ok'],
      ['product-cdm-adapter', 'ok'],
      ['host-approval', 'ok'],
      ['native-value', 'ok'],
      ['payment-readback', 'ok'],
      ['backend-key', 'ok'],
      ['same-identity', 'ok']
    ]);
    expect(evidence.events).toHaveLength(4);
  });

  it('keeps candidate evidence pending until a valid deployment CID is supplied', () => {
    const missing = buildProductCdmHostSmokeEvidence(smokeContext({ deployedCid: null }), completeEvents());
    const invalid = buildProductCdmHostSmokeEvidence(smokeContext({ deployedCid: 'bafy0000000000000000' }), completeEvents());

    expect(missing.checks.find(check => check.id === 'candidate-identity')?.tone).toBe('unknown');
    expect(invalid.checks.find(check => check.id === 'candidate-identity')?.tone).toBe('error');
  });

  it('normalizes Product key events by allowlist so secrets are not persisted', () => {
    const detail = normalizeProductHostKeySmokeDetail({
      phase: 'key-allowed',
      path: 'session',
      signatureScheme: 'product-sr25519-v1',
      address: ADDRESS,
      productPublicKey: PRODUCT_PUBLIC_KEY,
      chainId: 420420417,
      purpose: 'individual',
      contentHash: CONTENT_HASH,
      access: 'allowed',
      playbackMode: 'full',
      runtime: RUNTIME,
      signature: PRODUCT_SIGNATURE,
      sessionToken: 'product-session-token',
      contentKey: CONTENT_KEY,
      nonce: 'n'.repeat(64),
      timestamp: 3_000
    });

    expect(detail).toEqual({
      phase: 'key-allowed',
      path: 'session',
      signatureScheme: 'product-sr25519-v1',
      address: ADDRESS,
      productPublicKey: PRODUCT_PUBLIC_KEY,
      chainId: 420420417,
      purpose: 'individual',
      contentHash: CONTENT_HASH,
      access: 'allowed',
      playbackMode: 'full',
      runtime: RUNTIME,
      status: undefined,
      code: undefined,
      error: null,
      timestamp: 3_000
    });

    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain(PRODUCT_SIGNATURE);
    expect(serialized).not.toContain('product-session-token');
    expect(serialized).not.toContain(CONTENT_KEY);
    expect(serialized).not.toContain('n'.repeat(64));
  });

  it('serializes evidence without content keys, signatures, nonces, or session tokens', () => {
    const evidence = buildProductCdmHostSmokeEvidence(smokeContext(), completeEvents(), new Date('2026-09-03T10:00:00.000Z'));
    const serialized = serializeProductCdmHostSmokeEvidence(evidence);

    expect(serialized).toContain('"amountPlanck": "250000000000"');
    expect(serialized).toContain(PRODUCT_PUBLIC_KEY);
    expect(serialized).not.toContain(PRODUCT_SIGNATURE);
    expect(serialized).not.toContain(CONTENT_KEY);
    expect(serialized).not.toContain('product-session-token');
    expect(serialized).not.toContain('"nonce"');
  });

  it('keeps only the most recent stored events', () => {
    const event = completeEvents()[0];
    const events = Array.from({ length: 5 }, (_, index) => ({ ...event, timestamp: index }));

    expect(appendProductCdmHostSmokeEvent(events, { ...event, timestamp: 5 }, 3).map(item => item.timestamp)).toEqual([3, 4, 5]);
  });

  it('records events only inside a candidate-bound smoke session', () => {
    const { storage, store } = memoryStorage();
    const [event] = completeEvents();

    expect(recordProductCdmHostSmokeEvent(event, storage)).toEqual([]);
    const session = bindProductCdmHostSmokeCandidate(smokeContext(), storage);
    expect(session?.events).toEqual([]);
    expect(recordProductCdmHostSmokeEvent(event, storage)).toEqual([event]);
    expect(readProductCdmHostSmokeEvents(storage)).toEqual([event]);
    expect(JSON.parse(store.get(PRODUCT_CDM_HOST_SMOKE_STORAGE_KEY) ?? '{}')).toEqual({
      schemaVersion: 2,
      startedAt: expect.any(String),
      candidate: { gitSha: BUILD_SHA, productAppVersion: '[0, 1, 20]', deployedCid: DEPLOYED_CID },
      events: [event]
    });
  });

  it('clears captured events when the deployment CID changes and ignores legacy storage', () => {
    const legacy = JSON.stringify(completeEvents());
    const { storage } = memoryStorage([[PRODUCT_CDM_HOST_SMOKE_STORAGE_KEY, legacy]]);
    expect(readProductCdmHostSmokeEvents(storage)).toEqual([]);

    bindProductCdmHostSmokeCandidate(smokeContext(), storage);
    recordProductCdmHostSmokeEvent(completeEvents()[0], storage);
    const rebound = bindProductCdmHostSmokeCandidate(smokeContext({ deployedCid: OTHER_DEPLOYED_CID }), storage);

    expect(rebound?.events).toEqual([]);
    expect(getProductCdmHostSmokeSessionCandidate(storage)?.deployedCid).toBe(OTHER_DEPLOYED_CID);
    expect(readProductCdmHostSmokeEvents(storage)).toEqual([]);
  });
});
