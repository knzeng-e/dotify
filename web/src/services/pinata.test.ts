import { describe, expect, it } from 'vitest';
import { getGatewayUrlsForAssetRef } from './pinata';

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
