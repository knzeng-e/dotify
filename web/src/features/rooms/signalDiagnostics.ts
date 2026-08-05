// Turn a bare Socket.IO `connect_error` into something the person in front of
// the app can act on.
//
// The transport gives the browser no reason for the failure - a CORS rejection,
// a stopped server, and a wrong URL all arrive identically. The signaling
// server's /health endpoint reports the live origin allowlist; when that works,
// a fetch-based Engine.IO handshake distinguishes a blocked realtime path from
// a socket session that started and was then interrupted. That matters most
// inside the Polkadot Product host, where browser network tools are unavailable.
//
// This only ever widens an error message. Room access itself stays decided by
// the server.

const GENERIC_REASON = 'Room service unavailable.';
const REALTIME_BLOCKED_REASON = `${GENERIC_REASON} The signaling server is online, but this host blocked the realtime connection. Close and reopen Dotify, then retry.`;
const REALTIME_INTERRUPTED_REASON = `${GENERIC_REASON} The realtime endpoint answered, but this host could not keep the session open. Close and reopen Dotify, then retry.`;

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
    const healthReason = explainSignalFailure((await response.json()) as SignalHealth, pageOrigin);
    if (healthReason !== GENERIC_REASON) return healthReason;

    const handshakeUrl = new URL('/socket.io/', signalUrl);
    handshakeUrl.searchParams.set('EIO', '4');
    handshakeUrl.searchParams.set('transport', 'polling');
    handshakeUrl.searchParams.set('t', 'dotify-diagnostic');

    try {
      const handshake = await fetchImpl(handshakeUrl.toString(), { signal: controller.signal });
      if (!handshake.ok) {
        return `${GENERIC_REASON} The signaling server is online, but its realtime endpoint rejected this host (HTTP ${handshake.status}).`;
      }
      const payload = await handshake.text();
      return payload.startsWith('0{') ? REALTIME_INTERRUPTED_REASON : REALTIME_BLOCKED_REASON;
    } catch {
      return REALTIME_BLOCKED_REASON;
    }
  } catch {
    return explainSignalFailure(null, pageOrigin);
  } finally {
    clearTimeout(timeoutId);
  }
}
