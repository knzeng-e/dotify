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
    expect(gate.message).toContain('currently unavailable');
    expect(gate.message).toContain('does not guarantee');
    expect(gate.hint).toContain('No payment will be sent');
  });

  it('describes Classic support with the resolved asset and plain listening language', () => {
    const gate = buildAccessGate({ track: track(), connected: true, nativePaymentAsset });

    expect(gate.actionType).toBe('payment');
    expect(gate.message).toContain('0.5 PAS');
    expect(gate.message).toContain('checks your listening access');
    expect(gate.hint).toBe('Nothing is sent until you confirm.');
    expect(`${gate.message} ${gate.hint}`).not.toMatch(/runtime|registry|chain|EVM/i);
  });

  it('builds a Classic receipt with amount, conditions, and recipient disclosure', () => {
    const receipt = buildClassicAccessReceipt(track(), nativePaymentAsset);

    expect(receipt.supportAmount).toBe('0.5 PAS');
    expect(receipt.terms).toEqual([
      { label: 'You receive', value: 'A listening access record for this account' },
      {
        label: 'Playback condition',
        value: 'Full listening opens after payment is confirmed and the access check passes'
      },
      {
        label: 'Availability',
        value: 'The support record has no fixed expiry, but the artist may later withdraw the release'
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
    expect(success.message).toContain('while the release remains available');
    expect(success.facts).toContainEqual({ label: 'Amount', value: '0.5 PAS' });
    expect(success.facts).toEqual(expect.arrayContaining([expect.objectContaining({ label: 'Settlement', value: expect.stringContaining('claim') })]));
    expect(unverified).toContain('payment was included');
    expect(unverified).toContain('payment record may still exist');
    expect(unverified).toContain('protected audio stays closed');
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
