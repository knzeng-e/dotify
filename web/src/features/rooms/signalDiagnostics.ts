// Turn a bare Socket.IO `connect_error` into something the person in front of
// the app can act on.
//
// The transport gives the browser no reason for the failure - a CORS rejection,
// a stopped server, and a wrong URL all arrive identically. The signaling
// server's /health endpoint is unauthenticated and reports the origin allowlist
// it is actually running, so one read distinguishes the common cases. That
// matters most inside the Polkadot Product host, where the app is served from a
// DotNS origin an operator has to add to SIGNAL_ORIGINS deliberately.
//
// This only ever widens an error message. Room access itself stays decided by
// the server.

const GENERIC_REASON = 'Room service unavailable.';

export type SignalHealth = {
  ok?: boolean;
  allowedOrigins?: string[] | '*';
};

export type SignalDiagnosisDeps = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/$/, '');
}

function explainUnreadableHealth(pageOrigin: string): string {
  const origin = normalizeOrigin(pageOrigin);
  if (origin === 'null') {
    return `${GENERIC_REASON} The signaling server did not answer from an opaque Product host origin. Check the Fly signaling logs for the actual Origin header before changing SIGNAL_ORIGINS.`;
  }
  if (origin) {
    return `${GENERIC_REASON} The signaling server did not answer from ${origin}. It may be starting up, offline, or blocked by CORS. Confirm that this exact origin is in SIGNAL_ORIGINS.`;
  }
  return `${GENERIC_REASON} The signaling server did not answer. It may be starting up, offline, or blocked by CORS.`;
}

/**
 * Build the user-facing reason from a health payload, or null when the payload
 * gives no better explanation than the generic one.
 */
export function explainSignalFailure(health: SignalHealth | null, pageOrigin: string): string {
  if (!health) {
    // /health itself is unreachable to browser JavaScript. That can be a cold
    // or down server, but it can also be CORS hiding an otherwise healthy
    // response, especially inside Product hosts with environment-specific
    // origins.
    return explainUnreadableHealth(pageOrigin);
  }

  const allowed = health.allowedOrigins;
  if (allowed === '*' || !Array.isArray(allowed)) return GENERIC_REASON;

  const origin = normalizeOrigin(pageOrigin);
  if (allowed.map(normalizeOrigin).includes(origin)) {
    // Reachable, origin is allowed - the fault is elsewhere (transport,
    // proxy, or the socket path), so do not blame configuration.
    return GENERIC_REASON;
  }

  return `${GENERIC_REASON} The signaling server is running but does not accept connections from ${origin || 'this page'}. Add that origin to SIGNAL_ORIGINS and redeploy the signaling service.`;
}

/**
 * Read the signaling server's health and describe why a connection failed.
 * Never rejects: a failed diagnosis falls back to the generic reason.
 */
export async function diagnoseSignalFailure(signalUrl: string, pageOrigin: string, deps: SignalDiagnosisDeps = {}): Promise<string> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const timeoutMs = deps.timeoutMs ?? 5_000;

  let healthUrl: string;
  try {
    healthUrl = new URL('/health', signalUrl).toString();
  } catch {
    return `${GENERIC_REASON} The configured signaling URL is not valid.`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(healthUrl, { signal: controller.signal });
    if (!response.ok) return explainSignalFailure(null, pageOrigin);
    return explainSignalFailure((await response.json()) as SignalHealth, pageOrigin);
  } catch {
    return explainSignalFailure(null, pageOrigin);
  } finally {
    clearTimeout(timeoutId);
  }
}
