export type StoredSession = { token: string; expiresAt: string };
export type SessionScope = { address: string; chainId: number; identity: string };

const REFRESH_MARGIN_MS = 60_000;

/** Identity tokens only. Access is still checked by the server for every key. */
export function createSessionCache(apiUrl: string) {
  const prefix = `dotify:session:v2:${encodeURIComponent(apiUrl)}:`;
  const memory = new Map<string, StoredSession>();
  const volatile = new Set<string>();
  const clearedKeys = new Set<string>();
  // A failed removeItem must not resurrect a rejected or signed-out token.
  const forgotten = new Set<string>();
  const addressPrefix = (address: string) => `${prefix}${address.toLowerCase()}:`;
  const keyFor = (scope: SessionScope) => `${addressPrefix(scope.address)}${scope.chainId}:${scope.identity.toLowerCase()}`;

  function valid(value: unknown, fresh: boolean): value is StoredSession {
    if (!value || typeof value !== 'object') return false;
    const session = value as StoredSession;
    if (typeof session.token !== 'string' || !session.token || typeof session.expiresAt !== 'string' || forgotten.has(session.token)) return false;
    const expires = Date.parse(session.expiresAt);
    return Number.isFinite(expires) && (!fresh || expires > Date.now() + REFRESH_MARGIN_MS);
  }

  function readKey(key: string, fresh: boolean): StoredSession | null {
    if (clearedKeys.has(key)) return null;
    // Prefer storage when readable to observe refresh/revocation in other tabs.
    let session: unknown = memory.get(key);
    if (!volatile.has(key)) {
      try {
        const raw = window.localStorage.getItem(key);
        session = raw ? JSON.parse(raw) : null;
        if (!raw) memory.delete(key);
      } catch {
        // Host storage is optional; the signed session still lasts in memory.
      }
    }
    if (!valid(session, fresh)) return null;
    memory.set(key, session);
    return session;
  }

  function entries(address: string): Array<[string, StoredSession]> {
    const keys = new Set(memory.keys());
    try {
      for (let index = 0; index < window.localStorage.length; index++) {
        const key = window.localStorage.key(index);
        if (key) keys.add(key);
      }
    } catch {
      // The memory cache remains enumerable when storage is unavailable.
    }
    return [...keys]
      .filter(key => key.startsWith(addressPrefix(address)))
      .flatMap(key => {
        const session = readKey(key, false);
        return session ? [[key, session] as [string, StoredSession]] : [];
      });
  }

  return {
    keyFor,
    read: (scope: SessionScope) => readKey(keyFor(scope), true),
    store(scope: SessionScope, session: StoredSession) {
      if (!valid(session, true)) throw new Error('The server returned an invalid listening session. Please reconnect.');
      const key = keyFor(scope);
      clearedKeys.delete(key);
      memory.set(key, session);
      try {
        window.localStorage.setItem(key, JSON.stringify(session));
        volatile.delete(key);
      } catch {
        volatile.add(key);
        // Reuse in this page even when persistent Host/browser storage fails.
      }
    },
    existing(address: string): string | null {
      return entries(address).find(([, session]) => valid(session, true))?.[1].token ?? null;
    },
    clear(address: string, expectedToken?: string): StoredSession[] {
      const removed: StoredSession[] = [];
      for (const [key, session] of entries(address)) {
        if (expectedToken && expectedToken !== session.token) continue;
        memory.delete(key);
        volatile.delete(key);
        clearedKeys.add(key);
        forgotten.add(session.token);
        removed.push(session);
        try {
          window.localStorage.removeItem(key);
        } catch {
          /* memory invalidation still applies */
        }
      }
      // Old address-only tokens cannot be reused safely across chain/API scopes,
      // but explicit sign-out still revokes them during the upgrade.
      const legacyKey = `dotify:session:${address.toLowerCase()}`;
      try {
        const raw = window.localStorage.getItem(legacyKey);
        const session: unknown = raw ? JSON.parse(raw) : null;
        if (valid(session, false) && (!expectedToken || expectedToken === session.token)) {
          forgotten.add(session.token);
          removed.push(session);
          window.localStorage.removeItem(legacyKey);
        }
      } catch {
        /* no reusable legacy token */
      }
      return removed;
    }
  };
}
