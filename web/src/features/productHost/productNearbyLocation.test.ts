import { afterEach, describe, expect, it, vi } from 'vitest';
import { authorizeProductNearbyLocation } from './productNearbyLocation';

function host() {
  return {
    isInsideContainer: vi.fn(async () => true),
    requestDevicePermission: vi.fn(async (_permission: 'Location') => ({ ok: true as const, value: true }))
  };
}
afterEach(() => vi.useRealTimers());
describe('Product Nearby permission boundary', () => {
  it('asks only for Location, without account or signing calls', async () => {
    const deps = host();
    await authorizeProductNearbyLocation(new AbortController().signal, deps);
    expect(deps.requestDevicePermission).toHaveBeenCalledExactlyOnceWith('Location');
  });
  it('does not request a capability outside a Host', async () => {
    const deps = host();
    deps.isInsideContainer.mockResolvedValue(false);
    await expect(authorizeProductNearbyLocation(new AbortController().signal, deps)).rejects.toThrow('HOST_LOCATION_UNAVAILABLE');
    expect(deps.requestDevicePermission).not.toHaveBeenCalled();
  });
  it('fails closed on denial', async () => {
    const deps = host();
    deps.requestDevicePermission.mockResolvedValue({ ok: true, value: false });
    await expect(authorizeProductNearbyLocation(new AbortController().signal, deps)).rejects.toThrow('DENIED');
  });
  it('does not expose raw Host errors', async () => {
    const deps = host();
    deps.requestDevicePermission.mockRejectedValue(new Error('private host details'));
    await expect(authorizeProductNearbyLocation(new AbortController().signal, deps)).rejects.toThrow(/^HOST_LOCATION_UNAVAILABLE$/);
  });
  it('fails closed when the SDK reports an unavailable capability', async () => {
    const deps = { ...host(), requestDevicePermission: async (_permission: 'Location') => ({ ok: false as const, error: 'NotSupported' }) };
    await expect(authorizeProductNearbyLocation(new AbortController().signal, deps)).rejects.toThrow('HOST_LOCATION_UNAVAILABLE');
  });
  it('does not contact the Host after pre-cancellation', async () => {
    const deps = host();
    const controller = new AbortController();
    controller.abort();
    await expect(authorizeProductNearbyLocation(controller.signal, deps)).rejects.toThrow('STOPPED');
    expect(deps.isInsideContainer).not.toHaveBeenCalled();
  });
  it('cancels during host detection before the permission request', async () => {
    const deps = host();
    let finish!: (value: boolean) => void;
    deps.isInsideContainer.mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve;
        })
    );
    const controller = new AbortController();
    const pending = expect(authorizeProductNearbyLocation(controller.signal, deps)).rejects.toThrow('STOPPED');
    controller.abort();
    finish(true);
    await pending;
    expect(deps.requestDevicePermission).not.toHaveBeenCalled();
  });
  it('ignores a late grant after timeout and does not retry', async () => {
    vi.useFakeTimers();
    const deps = host();
    let finish!: (value: { ok: true; value: boolean }) => void;
    deps.requestDevicePermission.mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve;
        })
    );
    const pending = expect(authorizeProductNearbyLocation(new AbortController().signal, deps)).rejects.toThrow('HOST_TIMEOUT');
    await vi.advanceTimersByTimeAsync(15_000);
    await pending;
    finish({ ok: true, value: true });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(deps.requestDevicePermission).toHaveBeenCalledOnce();
  });
});
