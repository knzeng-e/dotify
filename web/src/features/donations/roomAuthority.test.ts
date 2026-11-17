import { afterEach, describe, expect, it, vi } from 'vitest';
import { zeroAddress } from 'viem';
import { emptyPolicy, type ContributionPolicy } from './contributions';
import { effectiveRoomAuthority, readDotifyRoomAuthority } from './roomAuthority';

const authority = '0x0000000000000000000000000000000000000001';
afterEach(() => vi.unstubAllGlobals());
describe('artist-selected room verification', () => {
  it('inherits only when the track has no explicit authority', () => {
    const inherited: ContributionPolicy = { ...emptyPolicy, roomAttestor: authority };
    expect(effectiveRoomAuthority(emptyPolicy, inherited)).toBe(authority);
    expect(effectiveRoomAuthority({ ...inherited, roomAttestor: '0x0000000000000000000000000000000000000002' }, inherited)).not.toBe(authority);
  });
  it('accepts only a nonzero address from the configured network without credentials', async () => {
    vi.stubGlobal('window', { location: { protocol: 'https:', hostname: 'dotify.example' } });
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ chainId: 42, attestor: authority })));
    vi.stubGlobal('fetch', fetcher);
    await expect(readDotifyRoomAuthority(42)).resolves.toBe(authority);
    expect(fetcher).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ credentials: 'omit', cache: 'no-store' }));
    for (const value of [{ chainId: 43, attestor: authority }, { chainId: 42, attestor: zeroAddress }, { chainId: 42, attestor: 'not-an-address' }, null]) {
      fetcher.mockResolvedValueOnce(new Response(JSON.stringify(value)));
      await expect(readDotifyRoomAuthority(42)).rejects.toThrow('unavailable');
    }
    fetcher.mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(readDotifyRoomAuthority(42)).rejects.toThrow('unavailable');
  });
});
