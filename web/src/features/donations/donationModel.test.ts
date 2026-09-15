import { describe, expect, it, vi } from 'vitest';
import type { CatalogTrack } from '../../shared/types';
import type { RuntimeReadPort } from '../runtime/runtimePorts';
import { parseDonationAmount, resolveDonationArtist } from './donationModel';
const runtime = `0x${'11'.repeat(20)}` as const;
const artist = `0x${'22'.repeat(20)}` as const;
const hash = `0x${'33'.repeat(32)}` as const;
describe('gift amount and receiving artist', () => {
  it('uses the chosen asset precision without rounding and accepts a French comma', () => {
    expect(parseDonationAmount(' 0,25 ', 10)).toBe(2500000000n);
    expect(parseDonationAmount('0.000000000000000001', 18)).toBe(1n);
  });
  it.each(['0', '-1', '1e3', '0.00000000001', '1.2.3', '', 'NaN'])('rejects invalid native amount %s', value => {
    expect(() => parseDonationAmount(value, 10)).toThrow();
  });
  it('uses the release artist, not the mutable catalog name/address', async () => {
    const listRuntimeTracks = vi.fn(async () => [{ hash, record: { active: true, artist, artistName: 'Published Artist', title: 'Release' } }]);
    const result = await resolveDonationArtist(
      { id: `${runtime}:${hash}`, hash, artist: 'Untrusted Name' } as CatalogTrack,
      { listRuntimeTracks } as unknown as RuntimeReadPort
    );
    expect(result).toEqual({ name: 'Published Artist', recipient: artist, releaseTitle: 'Release' });
    expect(listRuntimeTracks).toHaveBeenCalledWith(runtime);
  });
  it.each([
    { records: [] },
    { records: [{ hash, record: { active: false, artist } }] },
    { records: [{ hash, record: { active: true, artist: `0x${'00'.repeat(20)}` } }] }
  ])('refuses missing or invalid recipients', async ({ records }) => {
    await expect(
      resolveDonationArtist({ id: `${runtime}:${hash}`, hash } as CatalogTrack, { listRuntimeTracks: async () => records } as unknown as RuntimeReadPort)
    ).rejects.toThrow();
  });
});
