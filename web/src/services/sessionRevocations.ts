import type { StoredSession } from './sessionCache';

type PendingRevocation = StoredSession & { address: string };

/** Inactive credentials, used exclusively for idempotent logout retries. */
export function createSessionRevocations(apiUrl: string) {
  const prefix = `dotify:logout:v1:${encodeURIComponent(apiUrl)}:`;
  const activePrefix = `dotify:session:v2:${encodeURIComponent(apiUrl)}:`;
  const memory = new Map<string, PendingRevocation>();
  const acknowledged = new Set<string>();

  function entries(): Array<[string, PendingRevocation]> {
    const records = new Map(memory);
    try {
      for (let index = 0; index < window.localStorage.length; index++) {
        const key = window.localStorage.key(index);
        if (!key?.startsWith(prefix)) continue;
        try {
          const record = JSON.parse(window.localStorage.getItem(key) ?? 'null') as PendingRevocation | null;
          if (
            record &&
            typeof record.token === 'string' &&
            record.token &&
            typeof record.address === 'string' &&
            typeof record.expiresAt === 'string' &&
            Number.isFinite(Date.parse(record.expiresAt))
          ) {
            records.set(key, record);
          }
        } catch {
          // One unreadable entry must not discard the other pending logouts.
        }
      }
    } catch {
      // A blocked Host store still permits retries during this page's lifetime.
    }
    for (const [key, record] of records) {
      // Retain past local expiry to allow for modest server/client clock skew.
      if (Date.parse(record.expiresAt) + 300_000 <= Date.now()) {
        memory.delete(key);
        records.delete(key);
        try {
          window.localStorage.removeItem(key);
        } catch {
          /* An expired record cannot reactivate a session. */
        }
      } else {
        memory.set(key, record);
      }
    }
    return [...records];
  }

  return {
    entries: () =>
      entries()
        .map(([, record]) => record)
        .filter(record => !acknowledged.has(record.token)),
    has: (token: string) => entries().some(([, record]) => record.token === token),
    add(address: string, session: StoredSession) {
      if (entries().some(([, record]) => record.token === session.token)) return;
      const key = `${prefix}${crypto.randomUUID()}`;
      const record = { ...session, address: address.toLowerCase() };
      memory.set(key, record);
      try {
        window.localStorage.setItem(key, JSON.stringify(record));
      } catch {
        // The caller reports incomplete logout when the server also fails.
      }
    },
    complete(token: string) {
      acknowledged.add(token);
      for (const [key, record] of entries()) {
        if (record.token !== token) continue;
        try {
          // Do not drop the durable inactive marker while a failed earlier
          // removal could leave the same token in an active cache slot.
          const activeKeys: string[] = [];
          for (let index = 0; index < window.localStorage.length; index++) {
            const activeKey = window.localStorage.key(index);
            if (!activeKey || (!activeKey.startsWith(activePrefix) && activeKey !== `dotify:session:${record.address}`)) continue;
            const active = JSON.parse(window.localStorage.getItem(activeKey) ?? 'null') as StoredSession | null;
            if (active?.token === token) activeKeys.push(activeKey);
          }
          for (const activeKey of activeKeys) window.localStorage.removeItem(activeKey);
          window.localStorage.removeItem(key);
          memory.delete(key);
        } catch {
          // Keep retrying if removal fails; logout is safe to repeat.
        }
      }
    }
  };
}
