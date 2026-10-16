import { coarseNearbyCell } from '../../../shared/nearby-v2.mjs';
import { requiresExplicitProductRoomEntry } from '../productHost/productHost';
import { authorizeProductNearbyLocation } from '../productHost/productNearbyLocation';

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
  return window.isSecureContext && typeof navigator.geolocation?.watchPosition === 'function' && typeof navigator.geolocation?.clearWatch === 'function';
}

/** Product permission is asked only by an explicit Nearby start, never refresh. */
export async function authorizeNearbyDeviceLocation(signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw new Error('STOPPED');
  if (!canUseNearbyDeviceLocation()) throw new Error('UNAVAILABLE');
  if (requiresExplicitProductRoomEntry()) await authorizeProductNearbyLocation(signal);
}

// No public SDK API silently observes Product-only permission revocation.
// Use a single bounded snapshot until that boundary has host/device evidence.
export function canRefreshNearbyDeviceLocation(): boolean {
  return !requiresExplicitProductRoomEntry() && typeof navigator.permissions?.query === 'function';
}

export function queryNearbyLocationPermission(signal: AbortSignal): Promise<PermissionStatus | null> {
  if (signal.aborted) return Promise.reject(new Error('STOPPED'));
  // Electron's Product sandbox intentionally reports false in synchronous
  // permission checks. The async Host request and geolocation call enforce
  // consent. Treating this query as a denial prevents that native request.
  // Snapshot-only environments never refresh location without a new action.
  if (requiresExplicitProductRoomEntry() || typeof navigator.permissions?.query !== 'function') return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('STOPPED'));
      return;
    }
    let finished = false;
    const finish = (permission?: PermissionStatus, code = 'UNAVAILABLE') => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      if (permission && ['granted', 'prompt', 'denied'].includes(permission.state)) resolve(permission);
      else reject(new Error(code));
    };
    const abort = () => finish(undefined, 'STOPPED');
    const timer = setTimeout(() => finish(undefined, 'TIMEOUT'), 6000);
    signal.addEventListener('abort', abort, { once: true });
    try {
      void navigator.permissions.query({ name: 'geolocation' }).then(
        permission => finish(permission),
        () => finish()
      );
    } catch {
      finish();
    }
  });
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
    const timer = setTimeout(() => finish(undefined, 'TIMEOUT'), 32_000);
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
          // A mobile first fix can be coarse or stale. Keep this bounded watch
          // alive for a fresh accurate fix instead of rejecting immediately.
          return;
        }
        finish(coarseNearbyCell(latitude, longitude) ?? undefined);
      },
      error => finish(undefined, error.code === 1 ? 'DENIED' : error.code === 3 ? 'TIMEOUT' : 'UNAVAILABLE'),
      { enableHighAccuracy: false, maximumAge: 0, timeout: 30_000 }
    );
    if (finished) navigator.geolocation.clearWatch(watch.id);
  });
}
