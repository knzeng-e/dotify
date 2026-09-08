import { describe, expect, it } from 'vitest';
import type { CatalogTrack } from '../../shared/types';
import { buildAccessGate, buildClassicAccessReceipt, buildClassicAccessVerifiedFeedback, buildIncludedPaymentUnverifiedMessage } from './accessPromise';

const nativePaymentAsset = { symbol: 'PAS' } as const;

function track(overrides: Partial<CatalogTrack> = {}): CatalogTrack {
  return {
    id: '0xRuntime:0xHash',
    zone: 'Registry',
    title: 'Signal',
    artist: 'Nova',
    artistAddress: '0x2222222222222222222222222222222222222222',
    audioRef: 'dotify:enc:ipfs://cid',
    imageRef: 'ipfs://cover',
    priceDot: '0.5',
    pricePlanck: 500_000_000_000_000_000n,
    duration: 180,
    hash: `0x${'ab'.repeat(32)}`,
    description: 'A protected song',
    bulletinRef: '',
    metadataRef: 'ipfs://meta',
    royaltyBps: 10_000,
    durationLabel: '3:00',
    accessMode: 'classic',
    active: true,
    source: 'artist',
    royaltySplits: [
      {
        label: 'Producer',
        recipient: '0x1111111111111111111111111111111111111111',
        bps: 2_500
      }
    ],
    personhoodLevel: 'DIM1',
    encrypted: true,
    registeredAtBlock: 1,
    ...overrides
  };
}

describe('access promise copy', () => {
  it('shows inactive releases as unavailable without a payment action', () => {
    const gate = buildAccessGate({ track: track({ active: false }), connected: true, nativePaymentAsset });

    expect(gate.actionType).toBe('none');
    expect(gate.title).toBe('Release unavailable');
    expect(gate.message).toContain('inactive');
    expect(gate.message).toContain('not a guarantee of perpetual media availability');
    expect(gate.hint).toContain('No payment will be sent');
  });

  it('describes Classic support with the resolved runtime asset and a fresh runtime check', () => {
    const gate = buildAccessGate({ track: track(), connected: true, nativePaymentAsset });

    expect(gate.actionType).toBe('payment');
    expect(gate.message).toContain('0.5 PAS');
    expect(gate.message).toContain('fresh runtime access check');
    expect(gate.hint).toContain('opens protected audio');
  });

  it('builds a Classic receipt with amount, conditions, and recipient disclosure', () => {
    const receipt = buildClassicAccessReceipt(track(), nativePaymentAsset);

    expect(receipt.supportAmount).toBe('0.5 PAS');
    expect(receipt.terms).toEqual([
      { label: 'You receive', value: 'A paid Classic access record for this wallet' },
      {
        label: 'Playback condition',
        value: 'Full audio opens only while the release remains active and the runtime confirms access'
      },
      {
        label: 'Availability',
        value: 'No fixed expiry is written here, but this is not a perpetual media availability guarantee'
      }
    ]);
    expect(receipt.recipients).toEqual([
      { label: 'Producer', value: '25% to 0x111111...111111' },
      { label: 'Original artist remainder', value: '75% to 0x222222...222222' }
    ]);
  });

  it('keeps success and included-but-unverified payment states distinct', () => {
    const success = buildClassicAccessVerifiedFeedback(track(), `0x${'cd'.repeat(32)}`);
    const unverified = buildIncludedPaymentUnverifiedMessage({ attempts: 3, error: 'still denies access', productCdm: false });

    expect(success.title).toBe('Access verified');
    expect(success.message).toContain('while the release remains active');
    expect(unverified).toContain('payment transaction was included');
    expect(unverified).toContain('payment record may still exist');
    expect(unverified).toContain('will not open protected audio');
  });
});
