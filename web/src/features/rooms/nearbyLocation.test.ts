import { afterEach, expect, it, vi } from 'vitest';
import { canUseNearbyDeviceLocation, locateNearbyCell } from './nearbyLocation';

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
  vi.stubGlobal('navigator', {
    geolocation: {
      clearWatch: vi.fn(),
      watchPosition: (ok: PositionCallback) => {
        queueMicrotask(() => ok({ timestamp: Date.now(), coords: { latitude: 0, longitude: 0, accuracy } } as GeolocationPosition));
        return 1;
      }
    }
  });
  await expect(locateNearbyCell(new AbortController().signal)).rejects.toThrow('INACCURATE');
});

it('times out even if the container never answers and clears its watcher', async () => {
  vi.useFakeTimers();
  const clearWatch = vi.fn();
  vi.stubGlobal('navigator', { geolocation: { clearWatch, watchPosition: () => 2 } });
  const pending = expect(locateNearbyCell(new AbortController().signal)).rejects.toThrow('TIMEOUT');
  await vi.advanceTimersByTimeAsync(12_000);
  await pending;
  expect(clearWatch).toHaveBeenCalledWith(2);
});

it('offers device location only for standalone secure browsers with observable permission state', () => {
  const page = { isSecureContext: true, location: { protocol: 'https:' }, self: {}, top: {} };
  page.top = page.self;
  vi.stubGlobal('window', page);
  vi.stubGlobal('navigator', { geolocation: {}, permissions: { query: () => {} } });
  expect(canUseNearbyDeviceLocation()).toBe(true);
  vi.stubGlobal('window', { ...page, __HOST_WEBVIEW_MARK__: true });
  expect(canUseNearbyDeviceLocation()).toBe(false);
  vi.stubGlobal('window', { ...page, location: { protocol: 'polkadot:' } });
  expect(canUseNearbyDeviceLocation()).toBe(false);
  vi.stubGlobal('window', { ...page, top: {} });
  expect(canUseNearbyDeviceLocation()).toBe(false);
});
