import { afterEach, describe, expect, it, vi } from 'vitest';
import { CID } from 'multiformats/cid';
import { create as digest } from 'multiformats/hashes/digest';
import { bulletinAssetUrl, fetchBulletinPublicAsset } from './bulletinPublicAssets';
const host = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('../features/catalog/bulletinHostMedia', () => ({ readHostBulletinAsset: host.read }));
const root = CID.createV1(0x70, digest(0xb220, new Uint8Array(32))).toString();
const url = `https://api.example/api/assets/ipfs/${root}/cover/160.webp`;
afterEach(() => {
  vi.unstubAllGlobals();
  host.read.mockReset();
});
describe('Bulletin public assets', () => {
  it('uses only the configured API for Bulletin refs and rejects private paths', () => {
    expect(bulletinAssetUrl(`${root}/cover/160.webp`, 'https://api.example')).toEqual([url]);
    for (const path of ['archive/master.bin', '160/segment-000.bin', 'release.json?key=secret', '../cover/160.webp'])
      expect(bulletinAssetUrl(`${root}/${path}`, 'https://api.example')).toEqual([]);
    expect(bulletinAssetUrl('QmLegacy/cover.webp', 'https://api.example')).toBeNull();
    expect(bulletinAssetUrl(`${root}/release.json`, undefined)).toEqual([]);
  });
  it('reads authenticated Host bytes directly without an HTTP request', async () => {
    host.read.mockResolvedValue(new Uint8Array([1, 2, 3]));
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const response = await fetchBulletinPublicAsset(url);
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(fetch).not.toHaveBeenCalled();
  });
  it('ordinary Web and unavailable Host use only the credential-free API; cancellation never starts a recovery read', async () => {
    const fetch = vi.fn(async () => new Response('image'));
    vi.stubGlobal('fetch', fetch);
    host.read.mockResolvedValue(null);
    await fetchBulletinPublicAsset(url);
    expect(fetch).toHaveBeenCalledWith(url, expect.objectContaining({ credentials: 'omit', redirect: 'error' }));
    host.read.mockRejectedValue(new Error('Host unavailable'));
    await fetchBulletinPublicAsset(url);
    expect(fetch).toHaveBeenCalledTimes(2);
    const aborted = new AbortController();
    aborted.abort();
    await expect(fetchBulletinPublicAsset(url, aborted.signal)).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
