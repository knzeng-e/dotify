import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAssetRef, getGatewayUrlsForAssetRef } from './pinata';

describe('getGatewayUrlsForAssetRef', () => {
  it('expands ipfs refs into gateway fallback URLs', () => {
    expect(getGatewayUrlsForAssetRef('ipfs://QmCoverCid')).toEqual([
      'https://paseo-ipfs.polkadot.io/ipfs/QmCoverCid',
      'https://ipfs.io/ipfs/QmCoverCid',
      'https://dweb.link/ipfs/QmCoverCid'
    ]);
  });

  it('keeps an existing gateway URL first and appends other gateway fallbacks', () => {
    expect(getGatewayUrlsForAssetRef('https://paseo-ipfs.polkadot.io/ipfs/QmCoverCid')).toEqual([
      'https://paseo-ipfs.polkadot.io/ipfs/QmCoverCid',
      'https://ipfs.io/ipfs/QmCoverCid',
      'https://dweb.link/ipfs/QmCoverCid'
    ]);
  });

  it('leaves non-IPFS image refs untouched', () => {
    expect(getGatewayUrlsForAssetRef('data:image/svg+xml,cover')).toEqual(['data:image/svg+xml,cover']);
  });
});

describe('fetchAssetRef', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to the next gateway when the first IPFS gateway fails', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(new Response('ok'));

    const response = await fetchAssetRef('https://paseo-ipfs.polkadot.io/ipfs/QmAudioCid');

    expect(await response.text()).toBe('ok');
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['https://paseo-ipfs.polkadot.io/ipfs/QmAudioCid', 'https://ipfs.io/ipfs/QmAudioCid']);
  });
});
