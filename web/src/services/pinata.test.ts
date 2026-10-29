import { afterEach, describe, expect, it, vi } from 'vitest';

const sessionMocks = vi.hoisted(() => ({
  clearStoredSession: vi.fn(),
  ensureDotifySession: vi.fn(),
  ensureDotifySessionForSigner: vi.fn()
}));

vi.mock('./keyService', () => ({
  clearStoredSession: sessionMocks.clearStoredSession,
  ensureDotifySession: sessionMocks.ensureDotifySession,
  ensureDotifySessionForSigner: sessionMocks.ensureDotifySessionForSigner
}));

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
  vi.useRealTimers();
  vi.restoreAllMocks();
  sessionMocks.clearStoredSession.mockReset();
  sessionMocks.ensureDotifySession.mockReset();
  sessionMocks.ensureDotifySessionForSigner.mockReset();
  vi.unstubAllEnvs();
});

describe('getGatewayUrlsForAssetRef', () => {
  it('expands ipfs refs into gateway fallback URLs', async () => {
    const { getGatewayUrlsForAssetRef } = await loadPinataService();
    expect(getGatewayUrlsForAssetRef('ipfs://QmCoverCid')).toEqual([
      'https://gateway.pinata.cloud/ipfs/QmCoverCid',
      'https://ipfs.io/ipfs/QmCoverCid',
      'https://dweb.link/ipfs/QmCoverCid',
      'https://devnet-ipfs.api.polkadotcommunity.foundation/ipfs/QmCoverCid'
    ]);
  });

  it('keeps an existing gateway URL first and appends other gateway fallbacks', async () => {
    const { getGatewayUrlsForAssetRef } = await loadPinataService();
    expect(getGatewayUrlsForAssetRef('https://custom.example/ipfs/QmCoverCid')).toEqual([
      'https://custom.example/ipfs/QmCoverCid',
      'https://gateway.pinata.cloud/ipfs/QmCoverCid',
      'https://ipfs.io/ipfs/QmCoverCid',
      'https://dweb.link/ipfs/QmCoverCid',
      'https://devnet-ipfs.api.polkadotcommunity.foundation/ipfs/QmCoverCid'
    ]);
  });

  it('recovers IPFS paths from retired gateway URLs without requesting their dead hosts', async () => {
    const { getGatewayUrlsForAssetRef } = await loadPinataService({
      VITE_PINATA_GATEWAY: 'https://paseo-ipfs.polkadot.io',
      VITE_IPFS_READ_GATEWAYS: 'https://bulletin-kubo.tservices.es:9443,https://ipfs.io'
    });
    expect(getGatewayUrlsForAssetRef('https://bulletin-kubo.tservices.es:9443/ipfs/QmCoverCid/cover/640.webp')).toEqual([
      'https://gateway.pinata.cloud/ipfs/QmCoverCid/cover/640.webp',
      'https://ipfs.io/ipfs/QmCoverCid/cover/640.webp',
      'https://dweb.link/ipfs/QmCoverCid/cover/640.webp',
      'https://devnet-ipfs.api.polkadotcommunity.foundation/ipfs/QmCoverCid/cover/640.webp'
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
      'https://devnet-ipfs.api.polkadotcommunity.foundation/ipfs/QmCoverCid'
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

    const response = await fetchAssetRef('https://custom.example/ipfs/QmAudioCid');

    expect(await response.text()).toBe('ok');
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['https://custom.example/ipfs/QmAudioCid', 'https://gateway.pinata.cloud/ipfs/QmAudioCid']);
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
});

describe('fetchTrackManifest', () => {
  it('accepts the strict v2 editorial manifest used by release details', async () => {
    const { fetchTrackManifest } = await loadPinataService();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          schema: 'dotify.track.v2',
          createdAt: '2026-10-11T10:00:00.000Z',
          assets: { audioCID: 'audio', coverCID: 'cover', encrypted: true },
          track: {
            contentHash: `0x${'11'.repeat(32)}`,
            title: 'Signal',
            artistName: 'Artist',
            description: 'Story',
            durationSeconds: 237.4,
            accessMode: 'free',
            priceDot: '0',
            requiredPersonhood: 'None',
            zone: 'Studio'
          },
          editorial: {
            releaseKind: 'single',
            projectTitle: 'Night lines',
            version: '',
            releaseDate: '2026',
            genres: ['Soul'],
            languages: ['French'],
            credits: [{ name: 'Artist', role: 'performer' }],
            label: '',
            productionLocation: 'Paris',
            explicitContent: false,
            isrc: '',
            copyrightNotice: '',
            masterNotice: ''
          },
          royalties: [],
          settlement: { target: 'evm', royaltyBps: 10000, pricePlanck: '0' }
        }),
        { status: 200 }
      )
    );

    await expect(fetchTrackManifest('ipfs://manifest')).resolves.toMatchObject({
      schema: 'dotify.track.v2',
      editorial: { projectTitle: 'Night lines', credits: [{ name: 'Artist', role: 'performer' }] }
    });
  });

  it('refuses obsolete or malformed editorial metadata', async () => {
    const { fetchTrackManifest } = await loadPinataService();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ schema: 'dotify.track.v1' }), { status: 200 }));
    await expect(fetchTrackManifest('ipfs://legacy')).rejects.toThrow('current Dotify metadata format');
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

describe('protected audio upload metadata', () => {
  it('reports release-bound key versions from backend audio refs', async () => {
    const { protectedAudioUploadToKeyVersion } = await loadPinataService();

    expect(protectedAudioUploadToKeyVersion('dotify:enc:v3:key-v2:ipfs://QmEsos715F9xLtMdKNJ3thCD4skf5ZR4bKjS3RnhP3VNTf')).toBe('dotify-content-key-v2');
    expect(protectedAudioUploadToKeyVersion('dotify:enc:v3:key-v3:ipfs://QmEsos715F9xLtMdKNJ3thCD4skf5ZR4bKjS3RnhP3VNTf')).toBe('dotify-content-key-v3');
    expect(() => protectedAudioUploadToKeyVersion('dotify:enc:v1:ipfs://old')).toThrow();
  });

  it('retains backend runtime metadata on protected audio upload results', async () => {
    const { protectedAudioUploadToCID, protectedAudioUploadToKeyVersion, protectedAudioUploadToRef, protectedAudioUploadToRuntimeAddress } =
      await loadPinataService();
    const upload = {
      ref: 'dotify:enc:v3:key-v2:ipfs://QmEsos715F9xLtMdKNJ3thCD4skf5ZR4bKjS3RnhP3VNTf',
      runtimeAddress: '0x2222222222222222222222222222222222222222' as const,
      keyVersion: 'dotify-content-key-v2'
    };

    expect(protectedAudioUploadToRef(upload)).toBe(upload.ref);
    expect(protectedAudioUploadToCID(upload)).toBe(upload.ref.split('ipfs://')[1]);
    expect(protectedAudioUploadToKeyVersion(upload)).toBe('dotify-content-key-v2');
    expect(protectedAudioUploadToRuntimeAddress(upload)).toBe(upload.runtimeAddress);
    expect(protectedAudioUploadToRuntimeAddress(upload.ref)).toBeNull();
  });
});

describe('backend upload authorization', () => {
  it('obtains a purpose-scoped artist authorization before uploading', async () => {
    const { uploadCoverToBackend } = await loadPinataService({ VITE_DOTIFY_API_URL: 'https://api.test/' });
    const signer = {
      signatureScheme: 'product-sr25519-v1' as const,
      address: '0x1111111111111111111111111111111111111111' as const,
      productPublicKey: `0x${'22'.repeat(32)}` as const,
      signMessage: vi.fn()
    };
    sessionMocks.ensureDotifySessionForSigner.mockResolvedValue('artist-session');
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ uploadAuthorization: 'cover-capability' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ref: 'ipfs://cover-cid' }), { status: 200 }));
    const file = new File([new Uint8Array([1, 2, 3])], 'cover.png', { type: 'image/png' });

    await expect(uploadCoverToBackend(file, { chainId: 420420417, signer })).resolves.toBe('cover-cid');

    expect(sessionMocks.ensureDotifySessionForSigner).toHaveBeenCalledWith(signer, 420420417);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.test/api/uploads/authorize',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer artist-session' }),
        body: JSON.stringify({ purpose: 'cover', bytes: 3 })
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.test/api/uploads/cover',
      expect.objectContaining({ method: 'POST', headers: { Authorization: 'Bearer cover-capability' } })
    );
  });

  it('fails closed when no signed artist identity is supplied', async () => {
    const { uploadCoverToBackend } = await loadPinataService({ VITE_DOTIFY_API_URL: 'https://api.test' });
    const file = new File([new Uint8Array([1])], 'cover.png', { type: 'image/png' });
    await expect(uploadCoverToBackend(file)).rejects.toThrow(/Connect the artist wallet/i);
  });

  it('returns backend runtime metadata for protected audio uploads', async () => {
    const { protectedAudioUploadToRuntimeAddress, uploadProtectedAudio } = await loadPinataService({ VITE_DOTIFY_API_URL: 'https://api.test/' });
    const signer = {
      signatureScheme: 'product-sr25519-v1' as const,
      address: '0x1111111111111111111111111111111111111111' as const,
      productPublicKey: `0x${'22'.repeat(32)}` as const,
      signMessage: vi.fn()
    };
    const runtimeAddress = '0x2222222222222222222222222222222222222222' as const;
    const contentHash = `0x${'ab'.repeat(32)}` as const;
    sessionMocks.ensureDotifySessionForSigner.mockResolvedValue('artist-session');
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ uploadAuthorization: 'audio-capability' }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: '11111111-1111-4111-8111-111111111111',
            state: 'ready',
            result: {
              ref: 'dotify:enc:v3:key-v2:ipfs://Qm9pe721AGhy1HnzTKFfRSF6ojKtWutEC5MEkeYWAhQh1Y',
              runtimeAddress,
              contentHash,
              keyVersion: 'dotify-content-key-v2'
            }
          }),
          { status: 202 }
        )
      );

    const upload = await uploadProtectedAudio({ bytes: new Uint8Array([1, 2, 3]), name: 'track.mp3', mime: 'audio/mpeg' }, contentHash, {
      chainId: 420420417,
      signer
    });

    expect(upload).toMatchObject({
      ref: 'dotify:enc:v3:key-v2:ipfs://Qm9pe721AGhy1HnzTKFfRSF6ojKtWutEC5MEkeYWAhQh1Y',
      runtimeAddress,
      contentHash,
      keyVersion: 'dotify-content-key-v2'
    });
    expect(protectedAudioUploadToRuntimeAddress(upload)).toBe(runtimeAddress);
  });

  it('fails closed when the backend omits protected audio runtime metadata', async () => {
    const { uploadProtectedAudio } = await loadPinataService({ VITE_DOTIFY_API_URL: 'https://api.test/' });
    const signer = {
      signatureScheme: 'product-sr25519-v1' as const,
      address: '0x1111111111111111111111111111111111111111' as const,
      productPublicKey: `0x${'22'.repeat(32)}` as const,
      signMessage: vi.fn()
    };
    sessionMocks.ensureDotifySessionForSigner.mockResolvedValue('artist-session');
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ uploadAuthorization: 'audio-capability' }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: '11111111-1111-4111-8111-111111111111',
            state: 'ready',
            result: { ref: 'dotify:enc:v3:key-v2:ipfs://Qm9pe721AGhy1HnzTKFfRSF6ojKtWutEC5MEkeYWAhQh1Y' }
          }),
          { status: 202 }
        )
      );

    await expect(
      uploadProtectedAudio({ bytes: new Uint8Array([1, 2, 3]), name: 'track.mp3', mime: 'audio/mpeg' }, `0x${'ab'.repeat(32)}`, {
        chainId: 420420417,
        signer
      })
    ).rejects.toThrow('The backend returned an invalid audio upload runtime.');
  });

  it('opens a fresh session once when a restart invalidates the stored token', async () => {
    const { uploadCoverToBackend } = await loadPinataService({ VITE_DOTIFY_API_URL: 'https://api.test' });
    const signer = {
      address: '0x1111111111111111111111111111111111111111' as const,
      signMessage: vi.fn()
    };
    sessionMocks.ensureDotifySessionForSigner.mockResolvedValueOnce('old-session').mockResolvedValueOnce('fresh-session');
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'SESSION_RESTARTED' }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ uploadAuthorization: 'fresh-capability' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ref: 'ipfs://cover-cid' }), { status: 200 }));
    const file = new File([new Uint8Array([1, 2])], 'cover.png', { type: 'image/png' });

    await expect(uploadCoverToBackend(file, { chainId: 420420417, signer })).resolves.toBe('cover-cid');

    expect(sessionMocks.clearStoredSession).toHaveBeenCalledWith(signer.address, 'old-session');
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.test/api/uploads/authorize',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer fresh-session' }) })
    );
  });
});

it('ends a stalled audio upload with a recoverable message instead of waiting forever', async () => {
  const { uploadProtectedAudio } = await loadPinataService({ VITE_DOTIFY_API_URL: 'https://api.test/' });
  sessionMocks.ensureDotifySessionForSigner.mockResolvedValue('artist-session');
  const deadline = new AbortController();
  const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
  const send = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(Response.json({ uploadAuthorization: 'audio-capability' }))
    .mockImplementationOnce(async (_url, init) => {
      expect(init?.signal).toBe(deadline.signal);
      return new Promise<Response>((_resolve, reject) => {
        init!.signal!.addEventListener('abort', () => reject(deadline.signal.reason), { once: true });
        queueMicrotask(() => deadline.abort(new DOMException('synthetic stalled connection', 'TimeoutError')));
      });
    });
  await expect(
    uploadProtectedAudio({ bytes: new Uint8Array([1, 2, 3]), name: 'track.mp3', mime: 'audio/mpeg' }, `0x${'ab'.repeat(32)}`, {
      chainId: 420420417,
      signer: { address: `0x${'11'.repeat(20)}`, signMessage: vi.fn() }
    })
  ).rejects.toThrow('Your draft is safe');
  expect(timeout).toHaveBeenCalledWith(5 * 60_000);
  expect(send).toHaveBeenCalledTimes(2);
});
