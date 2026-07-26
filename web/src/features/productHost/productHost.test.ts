import { describe, expect, it } from 'vitest';
import { probeProductHost, resolveProductHostConfig } from './productHost';

describe('resolveProductHostConfig', () => {
  it('keeps ordinary browser builds independent from the Product host', () => {
    expect(resolveProductHostConfig({})).toEqual({
      mode: 'off',
      productId: 'dotify-test01.dot'
    });
  });

  it('reads an explicit Product DevNet configuration', () => {
    expect(
      resolveProductHostConfig({
        VITE_DOTIFY_HOST_MODE: 'required',
        VITE_DOTIFY_PRODUCT_ID: 'dotify-preview.dot'
      })
    ).toEqual({
      mode: 'required',
      productId: 'dotify-preview.dot'
    });
  });

  it('fails closed to off for an unknown mode', () => {
    expect(resolveProductHostConfig({ VITE_DOTIFY_HOST_MODE: 'sometimes' }).mode).toBe('off');
  });
});

describe('probeProductHost', () => {
  it('does not contact the host when integration is disabled', async () => {
    let called = false;
    const status = await probeProductHost('off', async () => {
      called = true;
      return true;
    });

    expect(status).toBe('off');
    expect(called).toBe(false);
  });

  it('reports host availability without requesting an account', async () => {
    await expect(probeProductHost('required', async () => true)).resolves.toBe('available');
    await expect(probeProductHost('auto', async () => false)).resolves.toBe('unavailable');
  });

  it('treats a failed host handshake as unavailable', async () => {
    await expect(
      probeProductHost('required', async () => {
        throw new Error('host missing');
      })
    ).resolves.toBe('unavailable');
  });
});
