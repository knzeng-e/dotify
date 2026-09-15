import { describe, expect, it } from 'vitest';
import type { CatalogTrack } from '../../shared/types';
import {
  buildAccessGate,
  buildClassicAccessReceipt,
  buildClassicAccessVerifiedFeedback,
  buildClassicSupportFacts,
  buildIncludedPaymentUnverifiedMessage,
  isUserRejectedSupportError
} from './accessPromise';

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

  it('shows the authoritative payment amount even when a display price is stale', () => {
    const release = track({ priceDot: '99', pricePlanck: 500000000000000000n });
    expect(buildClassicAccessReceipt(release, nativePaymentAsset).supportAmount).toBe('0.5 PAS');
    expect(buildAccessGate({ track: release, connected: true, nativePaymentAsset }).message).toContain('0.5 PAS');
  });

  it('keeps success and included-but-unverified payment states distinct', () => {
    const success = buildClassicAccessVerifiedFeedback(track(), `0x${'cd'.repeat(32)}`, nativePaymentAsset);
    const unverified = buildIncludedPaymentUnverifiedMessage({ attempts: 3, error: 'still denies access', productCdm: false });

    expect(success.title).toBe('Access verified');
    expect(success.message).toContain('while the release remains active');
    expect(success.facts).toContainEqual({ label: 'Amount', value: '0.5 PAS' });
    expect(success.facts).toEqual(expect.arrayContaining([expect.objectContaining({ label: 'Settlement', value: expect.stringContaining('claimable') })]));
    expect(unverified).toContain('payment transaction was included');
    expect(unverified).toContain('payment record may still exist');
    expect(unverified).toContain('will not open protected audio');
  });

  it('builds support facts for pending, unverified, failed, and canceled states', () => {
    expect(buildClassicSupportFacts(track(), nativePaymentAsset, 'pending')).toContainEqual({
      label: 'Settlement',
      value: 'Pending until the transaction is included and verified.'
    });
    expect(buildClassicSupportFacts(track(), nativePaymentAsset, 'included-unverified')).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: 'Access', value: expect.stringContaining('stays closed') })])
    );
    expect(buildClassicSupportFacts(track(), nativePaymentAsset, 'failed')).toContainEqual({
      label: 'Settlement',
      value: 'No completed support is recorded by Dotify from this attempt.'
    });
    expect(buildClassicSupportFacts(track(), nativePaymentAsset, 'canceled')).toContainEqual({
      label: 'Settlement',
      value: 'No support transaction was completed from this attempt.'
    });
  });

  it('recognizes wallet cancellation errors without treating them as chain receipts', () => {
    expect(isUserRejectedSupportError(new Error('User rejected the request.'))).toBe(true);
    expect(isUserRejectedSupportError(new Error('Timed out while waiting for transaction'))).toBe(false);
  });
});
