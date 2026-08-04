import { describe, expect, it, vi } from 'vitest';
import { connectProductHostIdentity, ensureProductHostRoomPermissions, probeProductHost, resolveProductHostConfig } from './productHost';

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

describe('connectProductHostIdentity', () => {
  it('exposes the Product account identity and message signer', async () => {
    const publicKey = new Uint8Array(32).fill(0x22);
    const signature = new Uint8Array(64).fill(0x33);
    const signBytes = vi.fn(async () => signature);
    const account = {
      dotNsIdentifier: 'dotify-test01.dot',
      derivationIndex: 0,
      publicKey
    };
    const provider = {
      getProductAccount: vi.fn(() => ({
        match: async <T>(onOk: (value: typeof account) => T) => onOk(account)
      })),
      getProductAccountSigner: vi.fn(() => ({ signBytes }))
    };

    const identity = await connectProductHostIdentity(
      { mode: 'required', productId: 'dotify-test01.dot' },
      {
        getAccountsProvider: async () => provider,
        deriveH160: () => '0x1111111111111111111111111111111111111111',
        ss58Encode: () => '5ProductAccount'
      }
    );

    await expect(identity.signMessage('Dotify sign-in')).resolves.toBe(`0x${'33'.repeat(64)}`);
    expect(identity).toMatchObject({
      evmAddress: '0x1111111111111111111111111111111111111111',
      substrateAddress: '5ProductAccount',
      productPublicKey: `0x${'22'.repeat(32)}`
    });
    expect(provider.getProductAccount).toHaveBeenCalledWith('dotify-test01.dot', 0);
    expect(provider.getProductAccountSigner).toHaveBeenCalledWith(account);
    expect(signBytes).toHaveBeenCalledWith(new TextEncoder().encode('Dotify sign-in'));
  });
});

describe('ensureProductHostRoomPermissions', () => {
  it('is inert outside the Product host', async () => {
    const requestPermission = vi.fn();

    await expect(
      ensureProductHostRoomPermissions('https://dotify-signal.fly.dev', {
        isInsideContainer: () => false,
        requestPermission
      })
    ).resolves.toEqual({ ok: true });

    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('requests remote signaling and WebRTC permissions inside the Product host', async () => {
    const requestPermission = vi.fn(async () => ({ ok: true as const, value: true }));

    await expect(
      ensureProductHostRoomPermissions('https://dotify-signal.fly.dev', {
        isInsideContainer: () => true,
        requestPermission
      })
    ).resolves.toEqual({ ok: true });

    expect(requestPermission).toHaveBeenNthCalledWith(1, {
      tag: 'Remote',
      value: { domains: ['dotify-signal.fly.dev'] }
    });
    expect(requestPermission).toHaveBeenNthCalledWith(2, { tag: 'WebRtc' });
  });

  it('explains when the host denies remote signaling access', async () => {
    const requestPermission = vi.fn(async () => ({ ok: true as const, value: false }));

    const result = await ensureProductHostRoomPermissions('https://dotify-signal.fly.dev', {
      isInsideContainer: () => true,
      requestPermission
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('Allow remote access to dotify-signal.fly.dev');
    }
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });

  it('explains when the host denies WebRTC access', async () => {
    const requestPermission = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, value: true })
      .mockResolvedValueOnce({ ok: true, value: false });

    const result = await ensureProductHostRoomPermissions('https://dotify-signal.fly.dev', {
      isInsideContainer: () => true,
      requestPermission
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('Allow WebRTC');
    }
    expect(requestPermission).toHaveBeenCalledTimes(2);
  });
});
