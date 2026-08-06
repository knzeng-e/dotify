const API_URL = (import.meta.env.VITE_DOTIFY_API_URL as string | undefined)?.replace(/\/$/, '');
const STATIC_TURN_URL = import.meta.env.VITE_TURN_URL as string | undefined;
const STATIC_TURN_USERNAME = import.meta.env.VITE_TURN_USERNAME as string | undefined;
const STATIC_TURN_CREDENTIAL = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined;

const TURN_GRANT_TIMEOUT_MS = 1_500;
const TURN_GRANT_REFRESH_MARGIN_MS = 60_000;

type TurnGrantResponse = {
  iceServers: RTCIceServer[];
  expiresAt: string;
};

type CachedTurnGrant = {
  iceServers: RTCIceServer[];
  expiresAtMs: number;
};

let cachedTurnGrant: CachedTurnGrant | null = null;

export function parseTurnUrls(value: string | undefined): string[] {
  return Array.from(
    new Set(
      (value ?? '')
        .split(',')
        .map(url => url.trim())
        .filter(url => /^turns?:[^\s,]+$/i.test(url))
    )
  );
}

export function hasTurnIceServer(iceServers: RTCIceServer[]): boolean {
  return iceServers.some(server => {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    return urls.some(url => /^turns?:/i.test(url));
  });
}

export function getStaticTurnIceServers(): RTCIceServer[] {
  const urls = parseTurnUrls(STATIC_TURN_URL);
  if (!urls.length) return [];

  if (STATIC_TURN_USERNAME && STATIC_TURN_CREDENTIAL) {
    return [{ urls, username: STATIC_TURN_USERNAME, credential: STATIC_TURN_CREDENTIAL }];
  }

  return [{ urls }];
}

function isTurnGrantResponse(value: unknown): value is TurnGrantResponse {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TurnGrantResponse>;
  return Array.isArray(candidate.iceServers) && typeof candidate.expiresAt === 'string';
}

function normalizeTurnIceServer(value: unknown): RTCIceServer | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<RTCIceServer>;
  const rawUrls = Array.isArray(candidate.urls) ? candidate.urls : [candidate.urls];
  const urls = rawUrls.filter((url): url is string => typeof url === 'string' && /^turns?:[^\s,]+$/i.test(url));
  if (!urls.length) return null;

  const username = typeof candidate.username === 'string' ? candidate.username : undefined;
  const credential = typeof candidate.credential === 'string' ? candidate.credential : undefined;
  if (!username || !credential) return null;

  // REST grants only use password credentials. Omitting credentialType keeps
  // the default while avoiding a compatibility failure in older WKWebViews.
  return { urls, username, credential };
}

function normalizeTurnIceServers(values: unknown[]): RTCIceServer[] {
  return values.map(normalizeTurnIceServer).filter((server): server is RTCIceServer => server !== null);
}

function readFreshCachedGrant(now = Date.now()): RTCIceServer[] {
  if (!cachedTurnGrant) return [];
  if (cachedTurnGrant.expiresAtMs - TURN_GRANT_REFRESH_MARGIN_MS <= now) {
    cachedTurnGrant = null;
    return [];
  }
  return cachedTurnGrant.iceServers;
}

async function fetchTurnGrant(fetchImpl: typeof fetch): Promise<RTCIceServer[]> {
  if (!API_URL) return [];

  const cached = readFreshCachedGrant();
  if (cached.length) return cached;

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), TURN_GRANT_TIMEOUT_MS);

  try {
    const response = await fetchImpl(`${API_URL}/api/turn/grant`, {
      method: 'GET',
      signal: controller.signal,
    });
    if (!response.ok) return [];

    const body = (await response.json()) as unknown;
    if (!isTurnGrantResponse(body)) return [];

    const expiresAtMs = Date.parse(body.expiresAt);
    if (!Number.isFinite(expiresAtMs)) return [];
    const iceServers = normalizeTurnIceServers(body.iceServers);
    if (!iceServers.length) return [];
    cachedTurnGrant = { iceServers, expiresAtMs };
    return readFreshCachedGrant();
  } catch {
    return [];
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export async function getTurnIceServers(fetchImpl: typeof fetch = fetch): Promise<RTCIceServer[]> {
  return [...getStaticTurnIceServers(), ...(await fetchTurnGrant(fetchImpl))];
}

export function hasConfiguredTurnRelay(): boolean {
  return parseTurnUrls(STATIC_TURN_URL).length > 0 || Boolean(API_URL);
}

export function clearTurnGrantCacheForTests(): void {
  cachedTurnGrant = null;
}
