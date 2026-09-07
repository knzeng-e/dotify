import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadPinataService(env: Record<string, string> = {}) {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('VITE_DOTIFY_API_URL', '');
  vi.stubEnv('VITE_PINATA_GATEWAY', '');
  vi.stubEnv('VITE_IPFS_READ_GATEWAYS', '');
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return import('./pinata');
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('getGatewayUrlsForAssetRef', () => {
  it('expands ipfs refs into gateway fallback URLs', async () => {
    const { getGatewayUrlsForAssetRef } = await loadPinataService();
    expect(getGatewayUrlsForAssetRef('ipfs://QmCoverCid')).toEqual([
      'https://gateway.pinata.cloud/ipfs/QmCoverCid',
      'https://ipfs.io/ipfs/QmCoverCid',
      'https://dweb.link/ipfs/QmCoverCid',
      'https://paseo-ipfs.polkadot.io/ipfs/QmCoverCid'
    ]);
  });

  it('keeps an existing gateway URL first and appends other gateway fallbacks', async () => {
    const { getGatewayUrlsForAssetRef } = await loadPinataService();
    expect(getGatewayUrlsForAssetRef('https://paseo-ipfs.polkadot.io/ipfs/QmCoverCid')).toEqual([
      'https://paseo-ipfs.polkadot.io/ipfs/QmCoverCid',
      'https://gateway.pinata.cloud/ipfs/QmCoverCid',
      'https://ipfs.io/ipfs/QmCoverCid',
      'https://dweb.link/ipfs/QmCoverCid'
    ]);
  });

  it('leaves non-IPFS image refs untouched', async () => {
    const { getGatewayUrlsForAssetRef } = await loadPinataService();
    expect(getGatewayUrlsForAssetRef('data:image/svg+xml,cover')).toEqual(['data:image/svg+xml,cover']);
  });

  it('tries the Pinata gateway immediately after a configured primary gateway', async () => {
    const { getGatewayUrlsForAssetRef } = await loadPinataService({
      VITE_PINATA_GATEWAY: 'https://ipfs.io',
      VITE_IPFS_READ_GATEWAYS: 'https://dweb.link'
    });

    expect(getGatewayUrlsForAssetRef('ipfs://QmCoverCid')).toEqual([
      'https://ipfs.io/ipfs/QmCoverCid',
      'https://gateway.pinata.cloud/ipfs/QmCoverCid',
      'https://dweb.link/ipfs/QmCoverCid',
      'https://paseo-ipfs.polkadot.io/ipfs/QmCoverCid'
    ]);
  });
});

describe('getAudioGatewayUrls', () => {
  it('uses the Pinata gateway for browser audio byte reads by default', async () => {
    const { getAudioGatewayUrls } = await loadPinataService();

    expect(getAudioGatewayUrls('QmAudioCid')).toEqual(['https://gateway.pinata.cloud/ipfs/QmAudioCid']);
  });

  it('keeps custom Pinata gateways and skips public generic fallbacks for audio', async () => {
    const { getAudioGatewayUrls } = await loadPinataService({
      VITE_PINATA_GATEWAY: 'https://artist-space.mypinata.cloud/',
      VITE_IPFS_READ_GATEWAYS: 'https://ipfs.io,https://gateway.pinata.cloud,https://dweb.link'
    });

    expect(getAudioGatewayUrls('QmAudioCid')).toEqual(['https://artist-space.mypinata.cloud/ipfs/QmAudioCid', 'https://gateway.pinata.cloud/ipfs/QmAudioCid']);
  });
});

describe('fetchAssetRef', () => {
  it('falls back to the next gateway when the first IPFS gateway fails', async () => {
    const { fetchAssetRef } = await loadPinataService();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(new Response('ok'));

    const response = await fetchAssetRef('https://paseo-ipfs.polkadot.io/ipfs/QmAudioCid');

    expect(await response.text()).toBe('ok');
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://paseo-ipfs.polkadot.io/ipfs/QmAudioCid',
      'https://gateway.pinata.cloud/ipfs/QmAudioCid'
    ]);
  });

  it('stops IPFS fallback reads when the caller aborts', async () => {
    const { fetchIpfsCid } = await loadPinataService();
    const controller = new AbortController();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
        })
    );

    const responsePromise = fetchIpfsCid('QmAudioCid', { signal: controller.signal });
    controller.abort();

    await expect(responsePromise).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry encrypted audio through public non-Pinata gateways', async () => {
    const { fetchAudioIpfsCid } = await loadPinataService({
      VITE_IPFS_READ_GATEWAYS: 'https://ipfs.io,https://dweb.link'
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(fetchAudioIpfsCid('QmAudioCid')).rejects.toThrow('Failed to fetch');
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['https://gateway.pinata.cloud/ipfs/QmAudioCid']);
  });
});

describe('formatBackendUploadError', () => {
  it('keeps manifest validation issue details from the backend', async () => {
    const { formatBackendUploadError } = await loadPinataService();
    expect(
      formatBackendUploadError(
        {
          error: 'Invalid Dotify track manifest',
          issues: [{ path: 'assets.audioCID', message: 'String must contain at least 1 character(s)' }]
        },
        'Metadata upload failed (400)'
      )
    ).toBe('Invalid Dotify track manifest: assets.audioCID: String must contain at least 1 character(s)');
  });

  it('falls back when the backend error body is malformed', async () => {
    const { formatBackendUploadError } = await loadPinataService();
    expect(formatBackendUploadError({ error: 400, issues: [{ path: ['assets'], message: null }] }, 'Metadata upload failed (400)')).toBe(
      'Metadata upload failed (400)'
    );
  });
});
