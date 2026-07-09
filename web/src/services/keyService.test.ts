import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WalletClient } from 'viem';

const ADDRESS = '0x1111111111111111111111111111111111111111' as const;
const CONTENT_HASH = `0x${'ab'.repeat(32)}` as const;
const CONTENT_KEY = `0x${'cd'.repeat(32)}` as const;
const RUNTIME = '0x2222222222222222222222222222222222222222' as const;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function installLocalStorage(entries: Array<[string, string]> = []) {
  const store = new Map(entries);
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

  vi.stubGlobal('window', { localStorage });
  return { store, localStorage };
}

async function loadKeyService() {
  vi.resetModules();
  vi.stubEnv('VITE_DOTIFY_API_URL', 'https://api.test/');
  return import('./keyService');
}

function walletClient(signMessage = vi.fn(async () => `0x${'11'.repeat(65)}`)): WalletClient {
  return { account: { address: ADDRESS }, signMessage } as unknown as WalletClient;
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
});
