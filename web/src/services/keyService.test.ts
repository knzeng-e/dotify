import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WalletClient } from 'viem';

const ADDRESS = '0x1111111111111111111111111111111111111111' as const;
const CONTENT_HASH = `0x${'ab'.repeat(32)}` as const;
const CONTENT_KEY = `0x${'cd'.repeat(32)}` as const;
const RUNTIME = '0x2222222222222222222222222222222222222222' as const;
const ARTIST = '0x4444444444444444444444444444444444444444' as const;
const AUDIO_REF = 'dotify:enc:v3:key-v2:ipfs://QmEsos715F9xLtMdKNJ3thCD4skf5ZR4bKjS3RnhP3VNTf';
const KEY_VERSION = 'dotify-content-key-v2' as const;
const RELEASE_ID = `${RUNTIME}:${CONTENT_HASH}`;
const PRODUCT_PUBLIC_KEY = `0x${'22'.repeat(32)}` as const;
const PRODUCT_SIGNATURE = `0x${'33'.repeat(64)}` as const;
const BUILD_SHA = '1234567890abcdef1234567890abcdef12345678';
const DEPLOYED_CID = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3ooqb5x4nqyd7bkhzbr6f5o4e';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function installLocalStorage(entries: Array<[string, string]> = []) {
  const store = new Map(entries);
  const sessionStore = new Map<string, string>();
  const localStorage = {
    get length() {
      return store.size;
    },
    clear: vi.fn(() => store.clear()),
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    })
  } satisfies Storage;
  const sessionStorage = {
    get length() {
      return sessionStore.size;
    },
    clear: vi.fn(() => sessionStore.clear()),
    getItem: vi.fn((key: string) => sessionStore.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(sessionStore.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => {
      sessionStore.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      sessionStore.set(key, value);
    })
  } satisfies Storage;

  vi.stubGlobal('window', { localStorage, sessionStorage });
  return { store, sessionStore, localStorage, sessionStorage };
}

async function loadKeyService() {
  vi.resetModules();
  vi.stubEnv('VITE_DOTIFY_API_URL', 'https://api.test/');
  return import('./keyService');
}

async function bindSmokeCandidate() {
  const { bindProductCdmHostSmokeCandidate } = await import('../features/productHost/productCdmHostSmokeEvidence');
  bindProductCdmHostSmokeCandidate({
    buildSha: BUILD_SHA,
    productAppVersion: '[0, 1, 20]',
    deployedCid: DEPLOYED_CID,
    productId: 'dotify-test01.dot',
    publicAppUrl: null,
    cdmRegistry: null,
    productHostMode: 'required',
    productHostStatus: 'available',
    runtimeAdapterKind: 'product-cdm',
    walletMethod: 'product-host',
    listenerAddress: ADDRESS,
    substrateAddress: null,
    productPublicKey: PRODUCT_PUBLIC_KEY,
    expectedChainId: 420420417,
    apiConfigured: true
  });
}

function walletClient(signMessage = vi.fn(async () => `0x${'11'.repeat(65)}`)): WalletClient {
  return { account: { address: ADDRESS }, signMessage } as unknown as WalletClient;
}

function productSigner(signMessage = vi.fn(async () => PRODUCT_SIGNATURE)) {
  return {
    signatureScheme: 'product-sr25519-v1' as const,
    address: ADDRESS,
    productPublicKey: PRODUCT_PUBLIC_KEY,
    signMessage
  };
}

function keyRequestResponse() {
  return jsonResponse({
    access: 'allowed',
    playbackMode: 'full',
    contentKey: CONTENT_KEY,
    runtime: RUNTIME
  });
}

function releaseIdentity() {
  return {
    releaseId: RELEASE_ID,
    runtimeAddress: RUNTIME,
    artistAddress: ARTIST,
    audioRef: AUDIO_REF,
    keyVersion: KEY_VERSION
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('keyService sessions', () => {
  it.each([200, 503])('covers same-tick queued tokens for coalesced callers without looping HTTP %s', async status => {
    const scopeKey = `dotify:session:v2:${encodeURIComponent('https://api.test')}:${ADDRESS}:420420417:eip191`;
    installLocalStorage([[scopeKey, JSON.stringify({ token: 'same-tick-logout', expiresAt: new Date(Date.now() + 3_600_000).toISOString() })]]);
    const fetchMock = vi.fn(async () => jsonResponse({ ok: status === 200 }, status));
    vi.stubGlobal('fetch', fetchMock);
    const service = await loadKeyService();
    const emptyFlush = service.retryPendingSessionRevocations();
    const signOut = service.signOutOfDotifySession(ADDRESS);
    const coalesced = service.retryPendingSessionRevocations();
    const results = await Promise.allSettled([emptyFlush, signOut, coalesced]);
    for (const result of results) {
      expect(result.status).toBe(status === 200 ? 'fulfilled' : 'rejected');
      if (result.status === 'rejected') expect(result.reason).toMatchObject({ code: 'SESSION_LOGOUT_PENDING' });
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/api/auth/logout',
      expect.objectContaining({ body: JSON.stringify({ sessionToken: 'same-tick-logout' }) })
    );
  });

  it.each(['503', 'network'])('retains inactive logout credentials across reload after %s and removes them only after acknowledgement', async failure => {
    const scopeKey = `dotify:session:v2:${encodeURIComponent('https://api.test')}:${ADDRESS}:420420417:eip191`;
    const { store } = installLocalStorage([[scopeKey, JSON.stringify({ token: 'pending-logout', expiresAt: new Date(Date.now() + 3_600_000).toISOString() })]]);
    const fetchMock = vi.fn(async () => {
      if (failure === 'network') throw new TypeError('offline');
      return jsonResponse({ code: 'SESSION_REVOCATION_UNAVAILABLE' }, 503);
    });
    vi.stubGlobal('fetch', fetchMock);
    let service = await loadKeyService();
    await expect(service.signOutOfDotifySession(ADDRESS)).rejects.toMatchObject({ code: 'SESSION_LOGOUT_PENDING' });
    expect(service.existingDotifySession({ address: ADDRESS }, 420420417)).toBeNull();
    expect(store.has(scopeKey)).toBe(false);
    expect([...store.keys()].some(key => key.startsWith('dotify:logout:v1:'))).toBe(true);

    service = await loadKeyService();
    expect(service.existingDotifySession({ address: ADDRESS }, 420420417)).toBeNull();
    fetchMock.mockImplementation(async () => jsonResponse({ ok: true }));
    await service.retryPendingSessionRevocations();
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://api.test/api/auth/logout',
      expect.objectContaining({ body: JSON.stringify({ sessionToken: 'pending-logout' }) })
    );
    expect(store.size).toBe(0);
  });

  it('keeps failed sign-out inactive across reload even if removing the old active cache entry fails', async () => {
    const scopeKey = `dotify:session:v2:${encodeURIComponent('https://api.test')}:${ADDRESS}:420420417:eip191`;
    const { localStorage } = installLocalStorage([
      [scopeKey, JSON.stringify({ token: 'still-on-disk', expiresAt: new Date(Date.now() + 3_600_000).toISOString() })]
    ]);
    localStorage.removeItem.mockImplementation(() => {
      throw new Error('remove blocked');
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({}, 503))
    );
    let service = await loadKeyService();
    await expect(service.signOutOfDotifySession(ADDRESS)).rejects.toMatchObject({ code: 'SESSION_LOGOUT_PENDING' });
    service = await loadKeyService();
    expect(service.existingDotifySession({ address: ADDRESS }, 420420417)).toBeNull();
  });

  it('retains the inactive marker after acknowledgement if only the old active cache slot cannot be removed', async () => {
    const scopeKey = `dotify:session:v2:${encodeURIComponent('https://api.test')}:${ADDRESS}:420420417:eip191`;
    const { localStorage, store } = installLocalStorage([
      [scopeKey, JSON.stringify({ token: 'blocked-slot', expiresAt: new Date(Date.now() + 3_600_000).toISOString() })]
    ]);
    localStorage.removeItem.mockImplementation(key => {
      if (key === scopeKey) throw new Error('active slot blocked');
      store.delete(key);
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ ok: true }))
    );
    let service = await loadKeyService();
    await service.signOutOfDotifySession(ADDRESS);
    service = await loadKeyService();
    expect(service.existingDotifySession({ address: ADDRESS }, 420420417)).toBeNull();
  });

  it('retains a memory-only retry when Host storage cannot be written and leaves the new account session intact', async () => {
    const { localStorage } = installLocalStorage();
    localStorage.setItem.mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    let logoutSucceeds = false;
    let sessions = 0;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/session') && init?.method === 'GET') return jsonResponse({ available: true });
      if (url.endsWith('/nonce')) return jsonResponse({ nonce: 'a'.repeat(48), expiresAt: new Date(Date.now() + 60_000).toISOString() });
      if (url.endsWith('/session')) return jsonResponse({ sessionToken: `account-${++sessions}`, expiresAt: new Date(Date.now() + 3_600_000).toISOString() });
      return jsonResponse({ ok: logoutSucceeds }, logoutSucceeds ? 200 : 503);
    });
    vi.stubGlobal('fetch', fetchMock);
    const service = await loadKeyService();
    await service.ensureDotifySessionForSigner(productSigner(), 420420417);
    await expect(service.signOutOfDotifySession(ADDRESS)).rejects.toMatchObject({ code: 'SESSION_LOGOUT_PENDING' });
    expect(service.existingDotifySession(productSigner(), 420420417)).toBeNull();
    const nextSigner = { ...productSigner(), address: ARTIST };
    await service.ensureDotifySessionForSigner(nextSigner, 420420417);
    logoutSucceeds = true;
    await Promise.all([service.retryPendingSessionRevocations(), service.retryPendingSessionRevocations()]);
    expect(service.existingDotifySession(nextSigner, 420420417)).toBe('account-2');
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/logout'))).toHaveLength(2);
  });

  it('preserves retry credentials for a late sign-in result after disconnect', async () => {
    installLocalStorage();
    let finish: (value: Response) => void = () => {};
    const response = new Promise<Response>(resolve => {
      finish = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith('/session') && init?.method === 'GET') return jsonResponse({ available: true });
        if (url.endsWith('/nonce')) return jsonResponse({ nonce: 'a'.repeat(48), expiresAt: new Date(Date.now() + 60_000).toISOString() });
        if (url.endsWith('/session')) return response;
        return jsonResponse({}, 503);
      })
    );
    const service = await loadKeyService();
    const notify = vi.fn();
    const unsubscribe = service.onSessionRevocationPending(notify);
    const pending = service.ensureDotifySessionForSigner(productSigner(), 420420417);
    const rejected = expect(pending).rejects.toMatchObject({ code: 'SESSION_CANCELLED' });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith('https://api.test/api/auth/session', expect.objectContaining({ method: 'POST' })));
    await service.signOutOfDotifySession(ADDRESS);
    finish(jsonResponse({ sessionToken: 'late-pending', expiresAt: new Date(Date.now() + 3_600_000).toISOString() }));
    await rejected;
    expect(notify).toHaveBeenCalledTimes(1);
    unsubscribe();
    expect(service.existingDotifySession(productSigner(), 420420417)).toBeNull();
    const reloaded = await loadKeyService();
    await expect(reloaded.retryPendingSessionRevocations()).rejects.toMatchObject({ code: 'SESSION_LOGOUT_PENDING' });
  });

  it('bounds the capability probe and does not sign when that probe times out', async () => {
    installLocalStorage();
    const signMessage = vi.fn(async () => PRODUCT_SIGNATURE);
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(AbortSignal.abort(new DOMException('Timed out', 'TimeoutError')));
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        init?.signal?.throwIfAborted();
        return jsonResponse({ available: true });
      })
    );
    const { ensureDotifySessionForSigner } = await loadKeyService();
    await expect(ensureDotifySessionForSigner(productSigner(signMessage), 420420417)).rejects.toMatchObject({ name: 'TimeoutError' });
    expect(timeout).toHaveBeenCalledWith(15_000);
    expect(signMessage).not.toHaveBeenCalled();
  });

  it('revokes a stored token on sign-out even inside the refresh margin', async () => {
    const sessionKey = `dotify:session:${ADDRESS}`;
    const { store } = installLocalStorage([
      [
        sessionKey,
        JSON.stringify({
          token: 'near-expiry-token',
          expiresAt: new Date(Date.now() + 30_000).toISOString()
        })
      ]
    ]);
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const { signOutOfDotifySession } = await loadKeyService();

    await signOutOfDotifySession(ADDRESS);

    expect(store.has(sessionKey)).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/api/auth/logout',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ sessionToken: 'near-expiry-token' })
      })
    );
  });

  it('keeps a concurrently refreshed session when clearing a rejected stale token', async () => {
    const sessionKey = `dotify:session:${ADDRESS}`;
    const { store, localStorage } = installLocalStorage([
      [
        sessionKey,
        JSON.stringify({
          token: 'fresh-session-token',
          expiresAt: new Date(Date.now() + 3_600_000).toISOString()
        })
      ]
    ]);
    const { clearStoredSession } = await loadKeyService();

    clearStoredSession(ADDRESS, 'stale-session-token');

    expect(store.has(sessionKey)).toBe(true);
    expect(localStorage.removeItem).not.toHaveBeenCalled();

    clearStoredSession(ADDRESS, 'fresh-session-token');

    expect(store.has(sessionKey)).toBe(false);
    expect(localStorage.removeItem).toHaveBeenCalledWith(sessionKey);
  });

  it.each([404, 503])('never signs per track when session capability is unavailable (%s)', async status => {
    installLocalStorage();
    const signMessage = vi.fn(async () => PRODUCT_SIGNATURE);
    const fetchMock = vi.fn(async () => jsonResponse({ code: 'SESSION_NOT_CONFIGURED' }, status));
    vi.stubGlobal('fetch', fetchMock);
    const { requestContentKey } = await loadKeyService();
    for (let index = 0; index < 3; index++) {
      await expect(
        requestContentKey({ walletClient: walletClient(signMessage), chainId: 420420417, purpose: 'individual', contentHash: CONTENT_HASH })
      ).rejects.toMatchObject({ code: 'SESSION_UNAVAILABLE' });
    }
    expect(signMessage).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('opens a Product-signed session and then requests the key with the session token', async () => {
    const { sessionStore } = installLocalStorage();
    const signMessage = vi.fn(async (message: string) => {
      expect(message).toContain('Action: SIGN_IN');
      return PRODUCT_SIGNATURE;
    });
    const sessionExpiresAt = new Date(Date.now() + 3_600_000).toISOString();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === 'https://api.test/api/auth/session' && init?.method === 'GET') return jsonResponse({ available: true });
      if (url === 'https://api.test/api/auth/nonce') {
        return jsonResponse({ nonce: 'c'.repeat(48), expiresAt: new Date(Date.now() + 60_000).toISOString() });
      }
      if (url === 'https://api.test/api/auth/session' && init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toMatchObject({
          address: ADDRESS,
          signature: PRODUCT_SIGNATURE,
          signatureScheme: 'product-sr25519-v1',
          productPublicKey: PRODUCT_PUBLIC_KEY
        });
        return jsonResponse({ sessionToken: 'product-session-token', expiresAt: sessionExpiresAt });
      }
      if (url === `https://api.test/api/tracks/${CONTENT_HASH}/key-request`) {
        expect(JSON.parse(String(init?.body))).toEqual({ sessionToken: 'product-session-token', purpose: 'room_host' });
        return keyRequestResponse();
      }
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const { requestContentKey } = await loadKeyService();
    await bindSmokeCandidate();

    const response = await requestContentKey({
      contentHash: CONTENT_HASH,
      purpose: 'room_host',
      signer: productSigner(signMessage),
      chainId: 420420417
    });

    expect(response.access).toBe('allowed');
    expect(signMessage).toHaveBeenCalledTimes(1);

    const storedEvidence = sessionStore.get('dotify:product-cdm-host-smoke-evidence:v2') ?? '';
    expect(storedEvidence).toContain('session-created');
    expect(storedEvidence).toContain('key-allowed');
    expect(storedEvidence).toContain(PRODUCT_PUBLIC_KEY);
    expect(storedEvidence).toContain(CONTENT_HASH);
    expect(storedEvidence).not.toContain(PRODUCT_SIGNATURE);
    expect(storedEvidence).not.toContain('product-session-token');
    expect(storedEvidence).not.toContain(CONTENT_KEY);
  });

  it('sends canonical release identity with session key requests when available', async () => {
    const sessionKey = `dotify:session:v2:${encodeURIComponent('https://api.test')}:${ADDRESS}:420420417:product-sr25519-v1:${PRODUCT_PUBLIC_KEY}`;
    installLocalStorage([
      [
        sessionKey,
        JSON.stringify({
          token: 'fresh-session-token',
          expiresAt: new Date(Date.now() + 3_600_000).toISOString()
        })
      ]
    ]);
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === `https://api.test/api/tracks/${CONTENT_HASH}/key-request`) {
        expect(JSON.parse(String(init?.body))).toEqual({
          sessionToken: 'fresh-session-token',
          purpose: 'individual',
          ...releaseIdentity()
        });
        return keyRequestResponse();
      }
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const { requestContentKey } = await loadKeyService();

    const response = await requestContentKey({
      contentHash: CONTENT_HASH,
      purpose: 'individual',
      signer: productSigner(),
      chainId: 420420417,
      release: releaseIdentity()
    });

    expect(response.access).toBe('allowed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reuses one session across tracks when persistent storage is blocked, then revokes it on logout', async () => {
    const { localStorage } = installLocalStorage();
    localStorage.getItem.mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    localStorage.setItem.mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    localStorage.removeItem.mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    const signMessage = vi.fn(async () => PRODUCT_SIGNATURE);
    const keyTokens: string[] = [];
    let sessions = 0;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/session') && init?.method === 'GET') return jsonResponse({ available: true });
      if (url.endsWith('/nonce')) return jsonResponse({ nonce: 'a'.repeat(48), expiresAt: new Date(Date.now() + 60_000).toISOString() });
      if (url.endsWith('/session')) return jsonResponse({ sessionToken: `session-${++sessions}`, expiresAt: new Date(Date.now() + 86_400_000).toISOString() });
      if (url.endsWith('/key-request')) {
        keyTokens.push(JSON.parse(String(init?.body)).sessionToken);
        return keyRequestResponse();
      }
      if (url.endsWith('/logout')) return jsonResponse({ ok: true });
      throw new Error(`Unexpected request ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const { requestContentKey, signOutOfDotifySession, existingDotifySession } = await loadKeyService();
    const signer = productSigner(signMessage);
    for (const digit of ['1', '2', '3']) await requestContentKey({ signer, chainId: 420420417, purpose: 'individual', contentHash: `0x${digit.repeat(64)}` });
    expect(signMessage).toHaveBeenCalledTimes(1);
    expect(keyTokens).toEqual(['session-1', 'session-1', 'session-1']);
    expect(existingDotifySession(signer, 420420417)).toBe('session-1');
    await signOutOfDotifySession(ADDRESS);
    expect(existingDotifySession(signer, 420420417)).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/api/auth/logout',
      expect.objectContaining({ body: JSON.stringify({ sessionToken: 'session-1' }) })
    );
    await requestContentKey({ signer, chainId: 420420417, purpose: 'individual', contentHash: CONTENT_HASH });
    expect(signMessage).toHaveBeenCalledTimes(2);
  });

  it('selects an existing session for the requested chain instead of storage order', async () => {
    installLocalStorage();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith('/session') && init?.method === 'GET') return jsonResponse({ available: true });
        if (url.endsWith('/nonce')) return jsonResponse({ nonce: 'a'.repeat(48), expiresAt: new Date(Date.now() + 60_000).toISOString() });
        if (url.endsWith('/session')) {
          const { chainId } = JSON.parse(String(init?.body)) as { chainId: number };
          return jsonResponse({ sessionToken: `session-${chainId}`, expiresAt: new Date(Date.now() + 86_400_000).toISOString() });
        }
        if (url.endsWith('/key-request')) return keyRequestResponse();
        throw new Error(`Unexpected request ${url}`);
      })
    );
    const { requestContentKey, existingDotifySession } = await loadKeyService();
    const signer = productSigner();
    await requestContentKey({ signer, chainId: 1, purpose: 'individual', contentHash: CONTENT_HASH });
    await requestContentKey({ signer, chainId: 420420417, purpose: 'individual', contentHash: `0x${'44'.repeat(32)}` });

    expect(existingDotifySession(signer, 420420417)).toBe('session-420420417');
    expect(existingDotifySession(signer, 1)).toBe('session-1');
    expect(existingDotifySession({ address: ADDRESS }, 420420417)).toBeNull();
  });

  it.each(['eip191', 'product'])('signs once across twenty tracks and key-service outages (%s)', async scheme => {
    installLocalStorage();
    const signMessage = vi.fn(async () => PRODUCT_SIGNATURE);
    let keys = 0;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/session') && init?.method === 'GET') return jsonResponse({ available: true });
      if (url.endsWith('/nonce')) return jsonResponse({ nonce: 'a'.repeat(48), expiresAt: new Date(Date.now() + 60_000).toISOString() });
      if (url.endsWith('/session')) return jsonResponse({ sessionToken: 'one-session', expiresAt: new Date(Date.now() + 86_400_000).toISOString() });
      expect(JSON.parse(String(init?.body)).sessionToken).toBe('one-session');
      return ++keys === 10 ? jsonResponse({ error: 'Temporary outage' }, 503) : keyRequestResponse();
    });
    vi.stubGlobal('fetch', fetchMock);
    const { requestContentKey } = await loadKeyService();
    const identity = scheme === 'product' ? { signer: productSigner(signMessage) } : { walletClient: walletClient(signMessage) };
    for (let index = 0; index < 20; index++) {
      const request = {
        ...identity,
        chainId: 420420417,
        purpose: 'individual' as const,
        contentHash: `0x${index.toString(16).padStart(64, '0')}` as `0x${string}`
      };
      if (index === 9) await expect(requestContentKey(request)).rejects.toThrow('Temporary outage');
      await requestContentKey(request);
    }
    expect(signMessage).toHaveBeenCalledTimes(1);
    expect(signMessage.mock.calls[0]).toBeDefined();
  });

  it.each(['KEY_SERVICE_ERROR', 'SESSION_NOT_CONFIGURED', 'SESSION_INVALID'])('retains the session without signing on an ambiguous 401 (%s)', async code => {
    installLocalStorage();
    const signMessage = vi.fn(async () => PRODUCT_SIGNATURE);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith('/session') && init?.method === 'GET') return jsonResponse({ available: true });
        if (url.endsWith('/nonce')) return jsonResponse({ nonce: 'a'.repeat(48), expiresAt: new Date(Date.now() + 60_000).toISOString() });
        if (url.endsWith('/session')) return jsonResponse({ sessionToken: 'retained', expiresAt: new Date(Date.now() + 86_400_000).toISOString() });
        return jsonResponse({ error: 'Unavailable', code }, 401);
      })
    );
    const { requestContentKey, existingDotifySession } = await loadKeyService();
    const signer = productSigner(signMessage);
    for (let i = 0; i < 3; i++)
      await expect(requestContentKey({ signer, chainId: 420420417, purpose: 'individual', contentHash: CONTENT_HASH })).rejects.toMatchObject({ code });
    expect(existingDotifySession(signer, 420420417)).toBe('retained');
    expect(signMessage).toHaveBeenCalledTimes(1);
  });

  it('does not prompt during a temporary 503 and rechecks sessions on the next attempt', async () => {
    installLocalStorage();
    const signMessage = vi.fn(async (_message: string) => PRODUCT_SIGNATURE);
    let probes = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith('/session') && init?.method === 'GET')
          return ++probes === 1 ? jsonResponse({ error: 'Service temporarily unavailable' }, 503) : jsonResponse({ available: true });
        if (url.endsWith('/nonce')) return jsonResponse({ nonce: 'a'.repeat(48), expiresAt: new Date(Date.now() + 60_000).toISOString() });
        if (url.endsWith('/session')) return jsonResponse({ sessionToken: 'restored', expiresAt: new Date(Date.now() + 86_400_000).toISOString() });
        return keyRequestResponse();
      })
    );
    const { requestContentKey } = await loadKeyService();
    const request = { signer: productSigner(signMessage), chainId: 420420417, purpose: 'individual' as const, contentHash: CONTENT_HASH };
    await expect(requestContentKey(request)).rejects.toThrow('temporarily unavailable');
    expect(signMessage).not.toHaveBeenCalled();
    await requestContentKey(request);
    await requestContentKey({ ...request, contentHash: `0x${'44'.repeat(32)}` });
    expect(probes).toBe(2);
    expect(signMessage).toHaveBeenCalledTimes(1);
    expect(signMessage.mock.calls[0][0]).toContain('Action: SIGN_IN');
  });

  it('does not cache or return a session that arrives after disconnect', async () => {
    installLocalStorage();
    let finish: (value: Response) => void = () => {};
    const pendingResponse = new Promise<Response>(resolve => {
      finish = resolve;
    });
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/session') && init?.method === 'GET') return jsonResponse({ available: true });
      if (url.endsWith('/nonce')) return jsonResponse({ nonce: 'a'.repeat(48), expiresAt: new Date(Date.now() + 60_000).toISOString() });
      if (url.endsWith('/session')) return pendingResponse;
      return jsonResponse({ ok: true });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { ensureDotifySessionForSigner, signOutOfDotifySession, existingDotifySession } = await loadKeyService();
    const pending = ensureDotifySessionForSigner(productSigner(), 420420417);
    const rejection = expect(pending).rejects.toMatchObject({ code: 'SESSION_CANCELLED' });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith('https://api.test/api/auth/session', expect.objectContaining({ method: 'POST' })));
    await signOutOfDotifySession(ADDRESS);
    finish(jsonResponse({ sessionToken: 'late-token', expiresAt: new Date(Date.now() + 86_400_000).toISOString() }));
    await rejection;
    expect(existingDotifySession(productSigner(), 420420417)).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/api/auth/logout',
      expect.objectContaining({ body: JSON.stringify({ sessionToken: 'late-token' }) })
    );
  });

  it('refreshes a revoked session only once and keeps a subsequent access denial closed', async () => {
    installLocalStorage();
    const signMessage = vi.fn(async (_message: string) => PRODUCT_SIGNATURE);
    let sessions = 0;
    let keyCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith('/session') && init?.method === 'GET') return jsonResponse({ available: true });
        if (url.endsWith('/nonce')) return jsonResponse({ nonce: 'a'.repeat(48), expiresAt: new Date(Date.now() + 60_000).toISOString() });
        if (url.endsWith('/session')) return jsonResponse({ sessionToken: `token-${++sessions}`, expiresAt: new Date(Date.now() + 86_400_000).toISOString() });
        keyCalls++;
        return keyCalls === 1
          ? jsonResponse({ error: 'Revoked', code: 'SESSION_REVOKED' }, 401)
          : jsonResponse({ error: 'No access', code: 'ACCESS_DENIED' }, 403);
      })
    );
    const { requestContentKey } = await loadKeyService();
    await expect(
      requestContentKey({ signer: productSigner(signMessage), chainId: 420420417, purpose: 'individual', contentHash: CONTENT_HASH })
    ).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
    expect(keyCalls).toBe(2);
    expect(signMessage).toHaveBeenCalledTimes(2);
    expect(signMessage.mock.calls.every(([message]) => message.includes('Action: SIGN_IN'))).toBe(true);
  });

  it('does not ask for a second signature when the session exchange returns 503', async () => {
    installLocalStorage();
    const signMessage = vi.fn(async (_message: string) => PRODUCT_SIGNATURE);
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/session') && init?.method === 'GET') return jsonResponse({ available: true });
      if (url.endsWith('/nonce')) return jsonResponse({ nonce: 'a'.repeat(48), expiresAt: new Date(Date.now() + 60_000).toISOString() });
      return jsonResponse({ error: 'Temporarily unavailable' }, 503);
    });
    vi.stubGlobal('fetch', fetchMock);
    const { requestContentKey } = await loadKeyService();
    await expect(
      requestContentKey({ signer: productSigner(signMessage), chainId: 420420417, purpose: 'individual', contentHash: CONTENT_HASH })
    ).rejects.toMatchObject({ code: 'SESSION_SIGN_IN_INTERRUPTED' });
    for (let i = 0; i < 3; i++)
      await expect(
        requestContentKey({ signer: productSigner(signMessage), chainId: 420420417, purpose: 'individual', contentHash: CONTENT_HASH })
      ).rejects.toMatchObject({ code: 'SESSION_SIGN_IN_INTERRUPTED' });
    expect(signMessage).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/key-request'))).toBe(false);
  });

  it('requires explicit sign-in after a failed exchange, then reuses the recovered session', async () => {
    installLocalStorage();
    const signMessage = vi.fn(async () => PRODUCT_SIGNATURE);
    let fail = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith('/session') && init?.method === 'GET') return jsonResponse({ available: true });
        if (url.endsWith('/nonce')) return jsonResponse({ nonce: 'a'.repeat(48), expiresAt: new Date(Date.now() + 60_000).toISOString() });
        if (url.endsWith('/session'))
          return fail
            ? jsonResponse({ error: 'Offline' }, 503)
            : jsonResponse({ sessionToken: 'recovered', expiresAt: new Date(Date.now() + 86_400_000).toISOString() });
        return keyRequestResponse();
      })
    );
    const { requestContentKey, ensureDotifySessionForSigner } = await loadKeyService();
    const signer = productSigner(signMessage);
    const input = { signer, chainId: 420420417, purpose: 'individual' as const, contentHash: CONTENT_HASH };
    await expect(requestContentKey(input)).rejects.toMatchObject({ code: 'SESSION_SIGN_IN_INTERRUPTED' });
    fail = false;
    await expect(requestContentKey(input)).rejects.toMatchObject({ code: 'SESSION_SIGN_IN_INTERRUPTED' });
    expect(signMessage).toHaveBeenCalledTimes(1);
    await ensureDotifySessionForSigner(signer, 420420417);
    await requestContentKey(input);
    expect(signMessage).toHaveBeenCalledTimes(2);
  });

  it('never loops wallet prompts when the renewed session is also rejected', async () => {
    installLocalStorage();
    const signMessage = vi.fn(async () => PRODUCT_SIGNATURE);
    let sessions = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith('/session') && init?.method === 'GET') return jsonResponse({ available: true });
        if (url.endsWith('/nonce')) return jsonResponse({ nonce: 'a'.repeat(48), expiresAt: new Date(Date.now() + 60_000).toISOString() });
        if (url.endsWith('/session')) return jsonResponse({ sessionToken: `token-${++sessions}`, expiresAt: new Date(Date.now() + 86_400_000).toISOString() });
        return jsonResponse({ code: 'SESSION_REVOKED', error: 'Revoked' }, 401);
      })
    );
    const { requestContentKey } = await loadKeyService();
    for (let i = 0; i < 3; i++)
      await expect(
        requestContentKey({ signer: productSigner(signMessage), chainId: 420420417, purpose: 'individual', contentHash: CONTENT_HASH })
      ).rejects.toMatchObject({ code: 'SESSION_SIGN_IN_INTERRUPTED' });
    expect(signMessage).toHaveBeenCalledTimes(2);
  });

  it('coalesces simultaneous session requests for parallel asset uploads', async () => {
    installLocalStorage();
    const signMessage = vi.fn(async () => PRODUCT_SIGNATURE);
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === 'https://api.test/api/auth/session' && init?.method === 'GET') return jsonResponse({ available: true });
      if (url === 'https://api.test/api/auth/nonce') {
        return jsonResponse({ nonce: 'e'.repeat(48), expiresAt: new Date(Date.now() + 60_000).toISOString() });
      }
      if (url === 'https://api.test/api/auth/session' && init?.method === 'POST') {
        await new Promise(resolve => setTimeout(resolve, 10));
        return jsonResponse({ sessionToken: 'shared-session-token', expiresAt: new Date(Date.now() + 3_600_000).toISOString() });
      }
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const { ensureDotifySessionForSigner } = await loadKeyService();
    const signer = productSigner(signMessage);

    await expect(Promise.all([ensureDotifySessionForSigner(signer, 420420417), ensureDotifySessionForSigner(signer, 420420417)])).resolves.toEqual([
      'shared-session-token',
      'shared-session-token'
    ]);

    expect(signMessage).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('W34 prepared queue keys', () => {
  function signedIn(scheme = 'eip191') {
    const key = `dotify:session:v2:${encodeURIComponent('https://api.test')}:${ADDRESS}:420420417:${scheme}`;
    return installLocalStorage([[key, JSON.stringify({ token: 'queue-session-token', expiresAt: new Date(Date.now() + 3_600_000).toISOString() })]]);
  }
  const tracks = () => [{ contentHash: CONTENT_HASH, release: releaseIdentity() }];
  const batch = () =>
    jsonResponse({
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
      tracks: [
        {
          access: 'allowed',
          playbackMode: 'full',
          contentKey: CONTENT_KEY,
          runtime: RUNTIME,
          contentHash: CONTENT_HASH,
          releaseId: RELEASE_ID
        }
      ]
    });
  it.each(['eip191', 'product-sr25519-v1'] as const)('Next uses a prepared %s grant with no key HTTP request or wallet prompt', async scheme => {
    const storage = signedIn(scheme === 'eip191' ? scheme : `${scheme}:${PRODUCT_PUBLIC_KEY}`);
    const service = await loadKeyService();
    const signer = scheme === 'eip191' ? { address: ADDRESS, signMessage: vi.fn() } : productSigner();
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => batch());
    vi.stubGlobal('fetch', fetchMock);
    await service.prepareContentKeys({ signer, chainId: 420420417, purpose: 'room_host', tracks: tracks() });
    const result = await service.requestContentKey({ signer, chainId: 420420417, purpose: 'room_host', ...tracks()[0] });
    expect(result.access).toBe('allowed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(signer.signMessage).not.toHaveBeenCalled();
    expect([...storage.store.values(), ...storage.sessionStore.values()].join('')).not.toContain(CONTENT_KEY);
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toMatchObject({ sessionToken: 'queue-session-token', purpose: 'room_host' });
  });
  it('does not sign in an anonymous visitor or renew a missing session for speculation', async () => {
    installLocalStorage();
    const service = await loadKeyService();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const signer = productSigner();
    await service.prepareContentKeys({ signer, chainId: 420420417, purpose: 'individual', tracks: tracks() });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(signer.signMessage).not.toHaveBeenCalled();
  });
  it('cannot reuse prepared keys after sign-out or an identity/chain scope cleanup', async () => {
    signedIn();
    const service = await loadKeyService();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => batch())
    );
    const signer = { address: ADDRESS, signMessage: vi.fn() };
    await service.prepareContentKeys({ signer, chainId: 420420417, purpose: 'individual', tracks: tracks() });
    expect(service.readPreparedContentKey(CONTENT_HASH, releaseIdentity(), 'individual')?.access).toBe('allowed');
    service.clearPreparedContentKeys();
    expect(service.readPreparedContentKey(CONTENT_HASH, releaseIdentity(), 'individual')).toBeNull();
    await service.prepareContentKeys({ signer, chainId: 420420417, purpose: 'individual', tracks: tracks() });
    await service.signOutOfDotifySession(ADDRESS);
    expect(service.readPreparedContentKey(CONTENT_HASH, releaseIdentity(), 'individual')).toBeNull();
  });
  it('discards a late batch after disconnect, cancellation, session replacement or expiry', async () => {
    for (const boundary of ['disconnect', 'abort', 'replace', 'expire'] as const) {
      const storage = signedIn();
      const service = await loadKeyService();
      let settle!: (response: Response) => void;
      vi.stubGlobal(
        'fetch',
        vi.fn(
          () =>
            new Promise<Response>(resolve => {
              settle = resolve;
            })
        )
      );
      const controller = new AbortController();
      const pending = service.prepareContentKeys({
        signer: { address: ADDRESS, signMessage: vi.fn() },
        chainId: 420420417,
        purpose: 'individual',
        tracks: tracks(),
        signal: controller.signal
      });
      if (boundary === 'disconnect') service.clearPreparedContentKeys();
      if (boundary === 'abort') controller.abort();
      if (boundary === 'replace') storage.store.clear();
      settle(boundary === 'expire' ? jsonResponse({ expiresAt: new Date(Date.now() - 1).toISOString(), tracks: [] }) : batch());
      await pending;
      expect(service.readPreparedContentKey(CONTENT_HASH, releaseIdentity(), 'individual')).toBeNull();
    }
  });
  it('bounds batches to five and never caches denied or wrong-runtime grants', async () => {
    signedIn();
    const service = await loadKeyService();
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const sent = JSON.parse(init?.body as string);
      expect(sent.tracks).toHaveLength(5);
      return jsonResponse({
        expiresAt: new Date(Date.now() + 30_000).toISOString(),
        tracks: sent.tracks.map((t: { contentHash: string; releaseId: string }, index: number) => ({
          ...t,
          ...(index === 0 ? { access: 'denied' } : { access: 'allowed', contentKey: CONTENT_KEY, runtime: ARTIST })
        }))
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    await service.prepareContentKeys({
      signer: { address: ADDRESS, signMessage: vi.fn() },
      chainId: 420420417,
      purpose: 'individual',
      tracks: Array.from({ length: 8 }, (_, i) => {
        const contentHash = `0x${i.toString(16).padStart(64, '0')}` as `0x${string}`;
        return { contentHash, release: { ...releaseIdentity(), releaseId: `${RUNTIME}:${contentHash}` } };
      })
    });
    expect(service.readPreparedContentKey(CONTENT_HASH, releaseIdentity(), 'individual')).toBeNull();
  });
  it('measures warm Next key wait before and after preparation with a simulated 40ms API', async () => {
    signedIn();
    const service = await loadKeyService();
    const fetchMock = vi.fn(async (url: string) => {
      await new Promise(resolve => setTimeout(resolve, 40));
      return url.endsWith('/prepare') ? batch() : keyRequestResponse();
    });
    vi.stubGlobal('fetch', fetchMock);
    const request = { signer: { address: ADDRESS, signMessage: vi.fn() }, chainId: 420420417, purpose: 'individual' as const, ...tracks()[0] };
    const before = performance.now();
    await service.requestContentKey(request);
    const cold = performance.now() - before;
    await service.prepareContentKeys({ ...request, tracks: tracks() });
    const calls = fetchMock.mock.calls.length;
    const after = performance.now();
    await service.requestContentKey(request);
    const warm = performance.now() - after;
    expect(fetchMock).toHaveBeenCalledTimes(calls);
    console.info('W34 synthetic key wait (not audible startup)', JSON.stringify({ beforeMs: cold, preparedMs: warm, simulatedApiMs: 40 }));
  });
});

it('expires prepared Free/individual keys without signing or extending the grant', async () => {
  const scopeKey = `dotify:session:v2:${encodeURIComponent('https://api.test')}:${ADDRESS}:420420417:eip191`;
  installLocalStorage([[scopeKey, JSON.stringify({ token: 'queue-session-token', expiresAt: new Date(Date.now() + 3_600_000).toISOString() })]]);
  let now = Date.now();
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  const service = await loadKeyService();
  const fetchMock = vi.fn(async (url: string) =>
    url.endsWith('/prepare')
      ? jsonResponse({
          expiresAt: new Date(now + 1000).toISOString(),
          tracks: [{ access: 'allowed', playbackMode: 'full', contentKey: CONTENT_KEY, runtime: RUNTIME, contentHash: CONTENT_HASH, releaseId: RELEASE_ID }]
        })
      : keyRequestResponse()
  );
  vi.stubGlobal('fetch', fetchMock);
  const signer = { address: ADDRESS, signMessage: vi.fn() };
  await service.prepareContentKeys({ signer, chainId: 420420417, purpose: 'individual', tracks: [{ contentHash: CONTENT_HASH, release: releaseIdentity() }] });
  expect((await service.requestFreeContentKey(CONTENT_HASH, releaseIdentity())).access).toBe('allowed');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  now += 1000;
  expect(
    (await service.requestContentKey({ signer, chainId: 420420417, purpose: 'individual', contentHash: CONTENT_HASH, release: releaseIdentity() })).access
  ).toBe('allowed');
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(signer.signMessage).not.toHaveBeenCalled();
});

it('does not invalidate a healthy session on a proxy 401 during speculative preparation', async () => {
  const scopeKey = `dotify:session:v2:${encodeURIComponent('https://api.test')}:${ADDRESS}:420420417:eip191`;
  installLocalStorage([[scopeKey, JSON.stringify({ token: 'queue-session-token', expiresAt: new Date(Date.now() + 3_600_000).toISOString() })]]);
  const service = await loadKeyService();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => jsonResponse({ error: 'Gateway unavailable' }, 401))
  );
  const signer = { address: ADDRESS, signMessage: vi.fn() };
  await service.prepareContentKeys({ signer, chainId: 420420417, purpose: 'individual', tracks: [{ contentHash: CONTENT_HASH, release: releaseIdentity() }] });
  expect(service.existingDotifySession(signer, 420420417)).toBe('queue-session-token');
  expect(signer.signMessage).not.toHaveBeenCalled();
});

it('a single key reply that arrives after wallet scope cleanup cannot return a key', async () => {
  const scopeKey = `dotify:session:v2:${encodeURIComponent('https://api.test')}:${ADDRESS}:420420417:eip191`;
  installLocalStorage([[scopeKey, JSON.stringify({ token: 'queue-session-token', expiresAt: new Date(Date.now() + 3_600_000).toISOString() })]]);
  const service = await loadKeyService();
  let settle!: (value: Response) => void;
  const fetchMock = vi.fn(
    () =>
      new Promise<Response>(resolve => {
        settle = resolve;
      })
  );
  vi.stubGlobal('fetch', fetchMock);
  const request = service.requestContentKey({
    signer: { address: ADDRESS, signMessage: vi.fn() },
    chainId: 420420417,
    purpose: 'individual',
    contentHash: CONTENT_HASH,
    release: releaseIdentity()
  });
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  service.clearPreparedContentKeys();
  const failure = expect(request).rejects.toMatchObject({ code: 'SESSION_CANCELLED' });
  settle(keyRequestResponse());
  await failure;
});

it('cannot rebind the previous identity if cleanup happens before the cached session resolves', async () => {
  const scopeKey = `dotify:session:v2:${encodeURIComponent('https://api.test')}:${ADDRESS}:420420417:eip191`;
  installLocalStorage([[scopeKey, JSON.stringify({ token: 'queue-session-token', expiresAt: new Date(Date.now() + 3_600_000).toISOString() })]]);
  const service = await loadKeyService();
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  const request = service.requestContentKey({
    signer: { address: ADDRESS, signMessage: vi.fn() },
    chainId: 420420417,
    purpose: 'individual',
    contentHash: CONTENT_HASH,
    release: releaseIdentity()
  });
  service.clearPreparedContentKeys();
  await expect(request).rejects.toMatchObject({ code: 'SESSION_CANCELLED' });
  expect(fetchMock).not.toHaveBeenCalled();
});
