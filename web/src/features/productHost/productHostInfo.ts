/** Public software labels reported by the Host, never identity/access authority. */
export type HostSoftwareObservation =
  | { status: 'pending' | 'unavailable' | 'timeout' }
  | { status: 'reported'; platform: 'Web' | 'Android' | 'Ios' | 'Desktop' | 'Cli' | 'Unknown'; name: string; version: string };

type InfoResult = { match: (ok: (value: unknown) => void, error: (error: unknown) => void) => PromiseLike<unknown> };
type InfoSystem = { info: (options: { signal: AbortSignal }) => InfoResult };
type SystemLoader = () => Promise<InfoSystem | null>;
const platforms = new Set(['Web', 'Android', 'Ios', 'Desktop', 'Cli', 'Unknown']);
const statuses = new Set(['pending', 'unavailable', 'timeout']);

function label(value: unknown): string | undefined {
  // Software metadata only: bound text and reject control characters/URLs.
  if (typeof value !== 'string' || value.length > 80 || !/^[\p{L}\p{N} ._()+-]+$/u.test(value)) return;
  return value.trim() || undefined;
}

function reportedSoftware(input: unknown): HostSoftwareObservation | undefined {
  if (!input || typeof input !== 'object') return;
  // Read only the three declared fields. Do not spread arbitrary Host data.
  const { platform, name: rawName, version: rawVersion } = input as Record<string, unknown>;
  if (typeof platform !== 'string' || !platforms.has(platform)) return;
  const name = label(rawName);
  const version = label(rawVersion);
  if (!name || !version) return;
  return { status: 'reported', platform: platform as Extract<HostSoftwareObservation, { status: 'reported' }>['platform'], name, version };
}

/** Re-allowlist at export too; extra Host fields and raw errors cannot escape. */
export function sanitizeHostSoftwareObservation(input: unknown): HostSoftwareObservation | undefined {
  try {
    if (!input || typeof input !== 'object') return;
    const status = (input as Record<string, unknown>).status;
    if (typeof status === 'string' && statuses.has(status)) return { status: status as 'pending' | 'unavailable' | 'timeout' };
    return status === 'reported' ? reportedSoftware(input) : undefined;
  } catch {
    return undefined;
  }
}

async function loadInstalledSystem(): Promise<InfoSystem | null> {
  const { getTruApi } = await import('@parity/product-sdk/host');
  return (await getTruApi())?.system ?? null;
}

/**
 * One outstanding read, no queue. A stalled/cancelled SDK request retains its
 * slot until it settles, so repeated About opens cannot accumulate Host calls.
 * Only this read's signal is cancelled; the shared Host transport is untouched.
 */
export function createHostInfoReader(loadSystem: SystemLoader, timeoutMs = 1_500) {
  let busy = false;
  return (signal: AbortSignal): Promise<HostSoftwareObservation | null> => {
    if (signal.aborted) return Promise.resolve(null);
    if (busy) return Promise.resolve({ status: 'unavailable' });
    busy = true;
    return new Promise(resolve => {
      let settled = false;
      const request = new AbortController();
      const finish = (result: HostSoftwareObservation | null, cancel = false) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
        resolve(result);
        if (cancel) {
          try {
            request.abort();
          } catch {
            // A broken optional Host cancellation must not withhold the report.
          }
        }
      };
      const abort = () => finish(null, true);
      const timer = setTimeout(() => finish({ status: 'timeout' }, true), timeoutMs);
      signal.addEventListener('abort', abort, { once: true });
      void Promise.resolve()
        .then(async () => {
          if (settled) return;
          const system = await loadSystem();
          if (settled) return;
          if (!system || typeof system.info !== 'function') return finish({ status: 'unavailable' });
          await system.info({ signal: request.signal }).match(
            value => finish(reportedSoftware(value) ?? { status: 'unavailable' }),
            () => finish({ status: 'unavailable' })
          );
        })
        .catch(() => finish({ status: 'unavailable' }))
        .finally(() => {
          busy = false;
        });
    });
  };
}

export const readProductHostInfo = createHostInfoReader(loadInstalledSystem);
