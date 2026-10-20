import { describe, expect, it } from 'vitest';
import { summarizeReleaseEarnings } from './earnings';
import type { CatalogTrack, RoyaltyPayment } from '../../shared/types';

const artist = '0x1111111111111111111111111111111111111111';
const collaborator = '0x2222222222222222222222222222222222222222';
const runtime = '0x3333333333333333333333333333333333333333';
const hash = `0x${'aa'.repeat(32)}` as const;
const track = { id: `${runtime}:${hash}`, hash, title: 'Release' } as CatalogTrack;
function payment(patch: Partial<RoyaltyPayment> = {}): RoyaltyPayment {
  return {
    runtimeAddress: runtime,
    trackHash: hash,
    transactionHash: `0x${'bb'.repeat(32)}`,
    logIndex: 0,
    listener: collaborator,
    recipient: artist,
    amountWei: 42n,
    settlement: 'paid',
    ...patch
  } as RoyaltyPayment;
}

describe('release earnings', () => {
  it('separates generated revenue from artist receipts and counts a split payment once', () => {
    const result = summarizeReleaseEarnings(
      [track],
      [payment({ amountWei: 1764n }), payment({ recipient: collaborator, amountWei: 2436n, logIndex: 1 })],
      artist
    );
    expect(result[0]).toMatchObject({ generatedWei: 4200n, receivedWei: 1764n, pendingWei: 0n, payments: 1 });
  });
  it('does not count duplicate events or a later claim as another sale', () => {
    const paid = payment({ settlement: 'claimed', claimTransactionHash: `0x${'cc'.repeat(32)}` });
    const result = summarizeReleaseEarnings([track], [paid, paid], artist);
    expect(result[0]).toMatchObject({ generatedWei: 42n, receivedWei: 42n, payments: 1 });
  });
  it('counts pending and legacy revenue without inventing settlement', () => {
    const result = summarizeReleaseEarnings(
      [track],
      [
        payment({ settlement: 'claimable' }),
        payment({ settlement: 'legacy', recipient: `0x${'00'.repeat(20)}`, logIndex: 2, transactionHash: `0x${'dd'.repeat(32)}` })
      ],
      artist
    );
    expect(result[0]).toMatchObject({ generatedWei: 84n, receivedWei: 0n, pendingWei: 42n, payments: 2 });
  });
  it('keeps the same content hash in another runtime out of the artist total', () => {
    const result = summarizeReleaseEarnings([track], [payment({ runtimeAddress: collaborator })], artist);
    expect(result[0]).toMatchObject({ generatedWei: 0n, receivedWei: 0n, payments: 0 });
  });
});
