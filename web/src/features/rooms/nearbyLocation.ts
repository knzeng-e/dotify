import { coarseNearbyCell } from '../../../shared/nearby-v2.mjs';
import { requiresExplicitProductRoomEntry } from '../productHost/productHost';
import { authorizeProductNearbyLocation } from '../productHost/productNearbyLocation';

export function canUseNearbyDeviceLocation(): boolean {
  return window.isSecureContext && typeof navigator.geolocation?.watchPosition === 'function' && typeof navigator.geolocation?.clearWatch === 'function';
}

/** Every Product fix passes the Host permission gate, including foreground renewals. */
export async function authorizeNearbyDeviceLocation(signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw new Error('STOPPED');
  if (!canUseNearbyDeviceLocation()) throw new Error('UNAVAILABLE');
  if (requiresExplicitProductRoomEntry()) await authorizeProductNearbyLocation(signal);
}

// Product renewals re-check the async Host grant before each bounded native fix.
// Browsers without an observable permission state remain snapshot-only.
export function canRefreshNearbyDeviceLocation(): boolean {
  return requiresExplicitProductRoomEntry() || typeof navigator.permissions?.query === 'function';
}

export function queryNearbyLocationPermission(signal: AbortSignal): Promise<PermissionStatus | null> {
  if (signal.aborted) return Promise.reject(new Error('STOPPED'));
  // Electron's Product sandbox intentionally reports false in synchronous
  // permission checks. The async Host request and geolocation call enforce
  // consent. Treating this query as a denial prevents that native request.
  // The async Host gate is repeated before foreground renewals.
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
/** onCoarseFix runs once when the device answers, but not precisely enough yet. */
export function locateNearbyCell(signal: AbortSignal, onCoarseFix?: () => void): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('STOPPED'));
      return;
    }
    // Assigned after callbacks are registered; synchronous test implementations
    // may complete before watchPosition returns its handle.
    const watch = { id: undefined as number | undefined };
    let finished = false;
    // A device that only ever returns coarse fixes is imprecise, not slow.
    let sawCoarseFix = false;
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
    const timer = setTimeout(() => finish(undefined, sawCoarseFix ? 'INACCURATE' : 'TIMEOUT'), 32_000);
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
          if (!sawCoarseFix) {
            sawCoarseFix = true;
            onCoarseFix?.();
          }
          return;
        }
        finish(coarseNearbyCell(latitude, longitude) ?? undefined);
      },
      error => finish(undefined, error.code === 1 ? 'DENIED' : error.code === 3 ? (sawCoarseFix ? 'INACCURATE' : 'TIMEOUT') : 'UNAVAILABLE'),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000 }
    );
    if (finished) navigator.geolocation.clearWatch(watch.id);
  });
}
