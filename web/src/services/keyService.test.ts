import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WalletClient } from 'viem';

const ADDRESS = '0x1111111111111111111111111111111111111111' as const;
const CONTENT_HASH = `0x${'ab'.repeat(32)}` as const;
const CONTENT_KEY = `0x${'cd'.repeat(32)}` as const;
const RUNTIME = '0x2222222222222222222222222222222222222222' as const;
const PRODUCT_PUBLIC_KEY = `0x${'22'.repeat(32)}` as const;
const PRODUCT_SIGNATURE = `0x${'33'.repeat(64)}` as const;

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

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('keyService sessions', () => {
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

  it('falls back to the legacy signed request without SIGN_IN when the session route is missing', async () => {
    installLocalStorage();
    const signMessage = vi.fn(async ({ message }: { message: string }) => {
      expect(message).toContain('Action: REQUEST_CONTENT_KEY');
      expect(message).not.toContain('Action: SIGN_IN');
      return `0x${'11'.repeat(65)}`;
    });
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === 'https://api.test/api/auth/session' && init?.method === 'GET') return jsonResponse({ error: 'not found' }, 404);
      if (url === 'https://api.test/api/auth/nonce') {
        return jsonResponse({ nonce: 'a'.repeat(48), expiresAt: new Date(Date.now() + 60_000).toISOString() });
      }
      if (url === `https://api.test/api/tracks/${CONTENT_HASH}/key-request`) return keyRequestResponse();
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const { requestContentKey } = await loadKeyService();

    const response = await requestContentKey({
      contentHash: CONTENT_HASH,
      purpose: 'individual',
      walletClient: walletClient(signMessage),
      chainId: 420420417
    });

    expect(response.access).toBe('allowed');
    expect(signMessage).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalledWith('https://api.test/api/auth/session', expect.objectContaining({ method: 'POST' }));
  });

  it('falls back to the legacy signed request without SIGN_IN when sessions are unconfigured', async () => {
    installLocalStorage();
    const signMessage = vi.fn(async ({ message }: { message: string }) => {
      expect(message).toContain('Action: REQUEST_CONTENT_KEY');
      expect(message).not.toContain('Action: SIGN_IN');
      return `0x${'11'.repeat(65)}`;
    });
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === 'https://api.test/api/auth/session' && init?.method === 'GET') {
        return jsonResponse({ code: 'SESSION_NOT_CONFIGURED' }, 503);
      }
      if (url === 'https://api.test/api/auth/nonce') {
        return jsonResponse({ nonce: 'b'.repeat(48), expiresAt: new Date(Date.now() + 60_000).toISOString() });
      }
      if (url === `https://api.test/api/tracks/${CONTENT_HASH}/key-request`) return keyRequestResponse();
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const { requestContentKey } = await loadKeyService();

    await requestContentKey({
      contentHash: CONTENT_HASH,
      purpose: 'individual',
      walletClient: walletClient(signMessage),
      chainId: 420420417
    });

    expect(signMessage).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalledWith('https://api.test/api/auth/session', expect.objectContaining({ method: 'POST' }));
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

    const response = await requestContentKey({
      contentHash: CONTENT_HASH,
      purpose: 'room_host',
      signer: productSigner(signMessage),
      chainId: 420420417
    });

    expect(response.access).toBe('allowed');
    expect(signMessage).toHaveBeenCalledTimes(1);

    const storedEvidence = sessionStore.get('dotify:product-cdm-host-smoke-evidence:v1') ?? '';
    expect(storedEvidence).toContain('session-created');
    expect(storedEvidence).toContain('key-allowed');
    expect(storedEvidence).toContain(PRODUCT_PUBLIC_KEY);
    expect(storedEvidence).toContain(CONTENT_HASH);
    expect(storedEvidence).not.toContain(PRODUCT_SIGNATURE);
    expect(storedEvidence).not.toContain('product-session-token');
    expect(storedEvidence).not.toContain(CONTENT_KEY);
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

  it('submits Product signature fields on the per-request fallback path', async () => {
    installLocalStorage();
    const signMessage = vi.fn(async (message: string) => {
      expect(message).toContain('Action: REQUEST_CONTENT_KEY');
      expect(message).toContain(`Requester: ${ADDRESS}`);
      return PRODUCT_SIGNATURE;
    });
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === 'https://api.test/api/auth/session' && init?.method === 'GET') return jsonResponse({ error: 'not found' }, 404);
      if (url === 'https://api.test/api/auth/nonce') {
        return jsonResponse({ nonce: 'd'.repeat(48), expiresAt: new Date(Date.now() + 60_000).toISOString() });
      }
      if (url === `https://api.test/api/tracks/${CONTENT_HASH}/key-request`) {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          requester: ADDRESS,
          signature: PRODUCT_SIGNATURE,
          signatureScheme: 'product-sr25519-v1',
          productPublicKey: PRODUCT_PUBLIC_KEY,
          purpose: 'individual'
        });
        return keyRequestResponse();
      }
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const { requestContentKey } = await loadKeyService();

    await requestContentKey({
      contentHash: CONTENT_HASH,
      purpose: 'individual',
      signer: productSigner(signMessage),
      chainId: 420420417
    });

    expect(signMessage).toHaveBeenCalledTimes(1);
  });
});
