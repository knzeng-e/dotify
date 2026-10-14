type HostLocationDeps = {
  isInsideContainer: () => boolean | Promise<boolean>;
  requestDevicePermission: (permission: 'Location') => Promise<{ ok: true; value: boolean } | { ok: false; error: unknown }>;
};

/** A bounded permission handshake, never an account or coordinate request. */
export async function authorizeProductNearbyLocation(signal: AbortSignal, deps?: HostLocationDeps): Promise<void> {
  if (signal.aborted) throw new Error('STOPPED');
  await new Promise<void>((resolve, reject) => {
    let finished = false;
    const finish = (code?: string) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      if (code) reject(new Error(code));
      else resolve();
    };
    const abort = () => finish('STOPPED');
    const timer = setTimeout(() => finish('HOST_TIMEOUT'), 15_000);
    signal.addEventListener('abort', abort, { once: true });
    void (async () => {
      try {
        const host = deps ?? (await import('@parity/product-sdk/host'));
        if (finished) return;
        if (!(await host.isInsideContainer())) {
          finish('HOST_LOCATION_UNAVAILABLE');
          return;
        }
        if (finished) return;
        const result = await host.requestDevicePermission('Location');
        if (finished) return;
        finish(!result.ok ? 'HOST_LOCATION_UNAVAILABLE' : !result.value ? 'DENIED' : undefined);
      } catch {
        finish('HOST_LOCATION_UNAVAILABLE');
      }
    })();
  });
}
