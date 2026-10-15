import { afterEach, expect, it, vi } from 'vitest';
import { canRefreshNearbyDeviceLocation, canUseNearbyDeviceLocation, locateNearbyCell, queryNearbyLocationPermission } from './nearbyLocation';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('clears the device watch and returns only a coarse cell', async () => {
  const clearWatch = vi.fn();
  vi.stubGlobal('navigator', {
    geolocation: {
      clearWatch,
      watchPosition: (ok: PositionCallback) => {
        queueMicrotask(() => ok({ timestamp: Date.now(), coords: { latitude: 0.392, longitude: 9.454, accuracy: 100 } } as GeolocationPosition));
        return 1;
      }
    }
  });
  expect(await locateNearbyCell(new AbortController().signal)).toMatch(/^n2:\d+:\d+$/);
  expect(clearWatch).toHaveBeenCalledWith(1);
});

it.each([1001, NaN, Infinity, -1])('rejects inaccurate fixes (%s) without returning a cell', async accuracy => {
  vi.useFakeTimers();
  vi.stubGlobal('navigator', {
    geolocation: {
      clearWatch: vi.fn(),
      watchPosition: (ok: PositionCallback) => {
        queueMicrotask(() => ok({ timestamp: Date.now(), coords: { latitude: 0, longitude: 0, accuracy } } as GeolocationPosition));
        return 1;
      }
    }
  });
  const onCoarseFix = vi.fn();
  // Only imprecise answers arrived: report imprecision, not slowness.
  const pending = expect(locateNearbyCell(new AbortController().signal, onCoarseFix)).rejects.toThrow('INACCURATE');
  await vi.advanceTimersByTimeAsync(32_000);
  await pending;
  expect(onCoarseFix).toHaveBeenCalledOnce();
});

it('times out even if the container never answers and clears its watcher', async () => {
  vi.useFakeTimers();
  const clearWatch = vi.fn();
  vi.stubGlobal('navigator', { geolocation: { clearWatch, watchPosition: () => 2 } });
  const pending = expect(locateNearbyCell(new AbortController().signal)).rejects.toThrow('TIMEOUT');
  await vi.advanceTimersByTimeAsync(32_000);
  await pending;
  expect(clearWatch).toHaveBeenCalledWith(2);
});

it('offers device location by default in secure Web and Product surfaces with observable permission state', () => {
  const page = { isSecureContext: true, location: { protocol: 'https:' }, self: {}, top: {} };
  page.top = page.self;
  vi.stubGlobal('window', page);
  vi.stubGlobal('navigator', { geolocation: { watchPosition: () => 1, clearWatch: () => {} }, permissions: { query: () => {} } });
  expect(canUseNearbyDeviceLocation()).toBe(true);
  vi.stubGlobal('window', { ...page, __HOST_WEBVIEW_MARK__: true });
  expect(canUseNearbyDeviceLocation()).toBe(true);
  vi.stubGlobal('window', { ...page, location: { protocol: 'polkadot:' } });
  expect(canUseNearbyDeviceLocation()).toBe(true);
  vi.stubGlobal('window', { ...page, top: {} });
  expect(canUseNearbyDeviceLocation()).toBe(true);
});

it('keeps Product snapshot capability prerequisites even with default availability', () => {
  const page = { isSecureContext: true, location: { protocol: 'https:' }, self: {}, top: {}, __HOST_WEBVIEW_MARK__: true };
  page.top = page.self;
  vi.stubGlobal('window', page);
  vi.stubGlobal('navigator', { geolocation: { watchPosition: () => 1, clearWatch: () => {} }, permissions: { query: () => {} } });
  expect(canUseNearbyDeviceLocation()).toBe(true);
  expect(canRefreshNearbyDeviceLocation()).toBe(false);
  vi.stubGlobal('navigator', { geolocation: { watchPosition: () => 1, clearWatch: () => {} } });
  expect(canUseNearbyDeviceLocation()).toBe(true);
  vi.stubGlobal('window', { ...page, isSecureContext: false });
  expect(canUseNearbyDeviceLocation()).toBe(false);
});

it('bounds an unanswered permission query and ignores a late result', async () => {
  vi.useFakeTimers();
  let finish!: (value: PermissionStatus) => void;
  vi.stubGlobal('navigator', {
    permissions: {
      query: () =>
        new Promise(resolve => {
          finish = resolve;
        })
    }
  });
  const pending = expect(queryNearbyLocationPermission(new AbortController().signal)).rejects.toThrow('TIMEOUT');
  await vi.advanceTimersByTimeAsync(6000);
  await pending;
  finish({ state: 'granted' } as PermissionStatus);
  expect(vi.getTimerCount()).toBe(0);
});

it('cancels a permission query without keeping its timer alive', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('navigator', { permissions: { query: () => new Promise(() => {}) } });
  const controller = new AbortController();
  const pending = expect(queryNearbyLocationPermission(controller.signal)).rejects.toThrow('STOPPED');
  controller.abort();
  await pending;
  expect(vi.getTimerCount()).toBe(0);
});
it('rejects an unrecognized permission state rather than treating it as consent', async () => {
  vi.stubGlobal('navigator', { permissions: { query: async () => ({ state: 'unknown' }) } });
  await expect(queryNearbyLocationPermission(new AbortController().signal)).rejects.toThrow('UNAVAILABLE');
});

it('does not use Electron synchronous permission denial to block the async Host gate', async () => {
  vi.stubGlobal('window', { location: { protocol: 'polkadot:' }, __HOST_WEBVIEW_MARK__: true });
  const query = vi.fn(async () => ({ state: 'denied' }));
  vi.stubGlobal('navigator', { permissions: { query } });
  expect(await queryNearbyLocationPermission(new AbortController().signal)).toBeNull();
  expect(query).not.toHaveBeenCalled();
  expect(canRefreshNearbyDeviceLocation()).toBe(false);
});
it('waits for a fresh mobile fix after an inaccurate first fix', async () => {
  const clearWatch = vi.fn();
  vi.stubGlobal('navigator', {
    geolocation: {
      clearWatch,
      watchPosition: (ok: PositionCallback) => {
        queueMicrotask(() => {
          ok({ timestamp: Date.now(), coords: { latitude: 0, longitude: 0, accuracy: 5000 } } as GeolocationPosition);
          ok({ timestamp: Date.now(), coords: { latitude: 0, longitude: 0, accuracy: 100 } } as GeolocationPosition);
        });
        return 1;
      }
    }
  });
  expect(await locateNearbyCell(new AbortController().signal)).toMatch(/^n2:/);
  expect(clearWatch).toHaveBeenCalledWith(1);
});
