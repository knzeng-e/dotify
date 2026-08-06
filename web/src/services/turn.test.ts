import { afterEach, describe, expect, it, vi } from 'vitest';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function loadTurnService(env: Record<string, string> = {}) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return import('./turn');
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('TURN service', () => {
  it('parses comma-separated TURN URLs and drops malformed entries', async () => {
    const { parseTurnUrls } = await loadTurnService();

    expect(parseTurnUrls('turn:turn.example.org:3478?transport=udp, turns:turn.example.org:443?transport=tcp, https://bad.example')).toEqual([
      'turn:turn.example.org:3478?transport=udp',
      'turns:turn.example.org:443?transport=tcp'
    ]);
  });

  it('uses static Vite TURN credentials when configured', async () => {
    const { getTurnIceServers } = await loadTurnService({
      VITE_TURN_URL: 'turn:turn.example.org:3478?transport=udp,turns:turn.example.org:443?transport=tcp',
      VITE_TURN_USERNAME: 'dotify-devnet',
      VITE_TURN_CREDENTIAL: 'rotated-password'
    });

    await expect(getTurnIceServers(vi.fn())).resolves.toEqual([
      {
        urls: ['turn:turn.example.org:3478?transport=udp', 'turns:turn.example.org:443?transport=tcp'],
        username: 'dotify-devnet',
        credential: 'rotated-password'
      }
    ]);
  });

  it('fetches and caches API TURN grants when a backend API is configured', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        iceServers: [
          {
            urls: ['turn:relay.example.org:3478?transport=udp'],
            username: '1785892200:listener',
            credential: 'signed',
            credentialType: 'password'
          }
        ],
        expiresAt: '2099-01-01T00:00:00.000Z'
      })
    );
    const { clearTurnGrantCacheForTests, getTurnIceServers } = await loadTurnService({
      VITE_DOTIFY_API_URL: 'https://api.example/'
    });
    clearTurnGrantCacheForTests();

    await expect(getTurnIceServers(fetchMock as unknown as typeof fetch)).resolves.toEqual([
      {
        urls: ['turn:relay.example.org:3478?transport=udp'],
        username: '1785892200:listener',
        credential: 'signed'
      }
    ]);
    await expect(getTurnIceServers(fetchMock as unknown as typeof fetch)).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('https://api.example/api/turn/grant', expect.objectContaining({ method: 'GET' }));
  });

  it('falls back cleanly when the API grant route is unavailable', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ code: 'TURN_NOT_CONFIGURED' }, 503));
    const { getTurnIceServers } = await loadTurnService({
      VITE_DOTIFY_API_URL: 'https://api.example/'
    });

    await expect(getTurnIceServers(fetchMock as unknown as typeof fetch)).resolves.toEqual([]);
  });

  it('drops malformed API ICE servers instead of passing them to RTCPeerConnection', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        iceServers: [
          { urls: ['https://not-turn.example'], username: 'user', credential: 'secret' },
          { urls: ['turn:relay.example.org:3478'], username: '', credential: 'secret' }
        ],
        expiresAt: '2099-01-01T00:00:00.000Z'
      })
    );
    const { getTurnIceServers } = await loadTurnService({
      VITE_DOTIFY_API_URL: 'https://api.example/'
    });

    await expect(getTurnIceServers(fetchMock as unknown as typeof fetch)).resolves.toEqual([]);
  });
});
