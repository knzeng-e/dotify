import { coarseNearbyCell } from '../../../shared/nearby-v2.mjs';

// Offline starter areas, not geocoding: neither a query nor a location goes to
// a third party. The label stays on the device; only its coarse cell is sent.
export const nearbyManualAreas = [
  ['Libreville', 0.392, 9.454],
  ['Paris', 48.857, 2.352],
  ['Lisbon', 38.722, -9.139],
  ['London', 51.507, -0.128],
  ['Berlin', 52.52, 13.405],
  ['Brussels', 50.85, 4.352],
  ['Dakar', 14.717, -17.467],
  ['Abidjan', 5.36, -4.008],
  ['Douala', 4.051, 9.768],
  ['Kinshasa', -4.322, 15.307],
  ['Montreal', 45.502, -73.567],
  ['New York', 40.713, -74.006]
].map(([name, latitude, longitude]) => ({ name: String(name), cell: coarseNearbyCell(Number(latitude), Number(longitude))! }));

export function canUseNearbyDeviceLocation(): boolean {
  const host = window as Window & { __HOST_WEBVIEW_MARK__?: boolean; __HOST_API_PORT__?: MessagePort };
  // Native Product location is unverified. Do not request a new host permission
  // merely because a webview happens to expose navigator.geolocation.
  return (
    window.isSecureContext &&
    window.location.protocol !== 'polkadot:' &&
    window.self === window.top &&
    !host.__HOST_WEBVIEW_MARK__ &&
    !host.__HOST_API_PORT__ &&
    Boolean(navigator.geolocation && navigator.permissions?.query)
  );
}

/** Cancellable one-fix watch: precise values never resolve or escape here. */
export function locateNearbyCell(signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('STOPPED'));
      return;
    }
    // Assigned after callbacks are registered; synchronous test implementations
    // may complete before watchPosition returns its handle.
    const watch = { id: undefined as number | undefined };
    let finished = false;
    const finish = (cell?: string, code = 'UNAVAILABLE') => {
      if (finished) return;
      finished = true;
      if (watch.id !== undefined) navigator.geolocation.clearWatch(watch.id);
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      if (cell) resolve(cell);
      else reject(new Error(code));
    };
    const abort = () => finish(undefined, 'STOPPED');
    const timer = setTimeout(() => finish(undefined, 'TIMEOUT'), 12_000);
    signal.addEventListener('abort', abort, { once: true });
    watch.id = navigator.geolocation.watchPosition(
      position => {
        const { latitude, longitude, accuracy } = position.coords;
        if (
          !Number.isFinite(accuracy) ||
          accuracy < 0 ||
          accuracy > 1000 ||
          !Number.isFinite(position.timestamp) ||
          Math.abs(Date.now() - position.timestamp) > 30_000
        ) {
          finish(undefined, 'INACCURATE');
          return;
        }
        finish(coarseNearbyCell(latitude, longitude) ?? undefined);
      },
      error => finish(undefined, error.code === 1 ? 'DENIED' : error.code === 3 ? 'TIMEOUT' : 'UNAVAILABLE'),
      { enableHighAccuracy: false, maximumAge: 0, timeout: 10_000 }
    );
    if (finished) navigator.geolocation.clearWatch(watch.id);
  });
}
