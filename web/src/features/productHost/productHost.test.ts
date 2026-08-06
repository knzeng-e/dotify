import { describe, expect, it, vi } from 'vitest';
import {
  connectProductHostIdentity,
  ensureProductHostRoomPermissions,
  isProductHostWebRtcUnavailable,
  openProductHostExternalUrl,
  probeProductHost,
  resolveProductHostConfig
} from './productHost';

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

describe('Product host live-room navigation', () => {
  it('detects the Product Mobile sandbox without masking browser WebRTC support', () => {
    const peerConnection = class {} as typeof RTCPeerConnection;

    expect(isProductHostWebRtcUnavailable('polkadot:', undefined, false)).toBe(true);
    expect(isProductHostWebRtcUnavailable('polkadot:', peerConnection, false)).toBe(false);
    expect(isProductHostWebRtcUnavailable('https:', undefined, true)).toBe(true);
    expect(isProductHostWebRtcUnavailable('https:', undefined, false)).toBe(false);
  });

  it('opens a secure fallback URL through the Product host', async () => {
    const navigateTo = vi.fn(async () => ({ ok: true as const, value: undefined }));

    await expect(openProductHostExternalUrl('https://dotify-test01.dev-dot.li/#/rooms/LIVE42', { navigateTo })).resolves.toEqual({ ok: true });
    expect(navigateTo).toHaveBeenCalledWith('https://dotify-test01.dev-dot.li/#/rooms/LIVE42');
  });

  it('rejects insecure fallback URLs before contacting the host', async () => {
    const navigateTo = vi.fn();

    await expect(openProductHostExternalUrl('http://dotify-test01.dev-dot.li', { navigateTo })).resolves.toEqual({
      ok: false,
      reason: 'Dotify only opens secure browser links from the Polkadot host.'
    });
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('surfaces a host navigation denial', async () => {
    const navigateTo = vi.fn(async () => ({ ok: false as const, error: new Error('PermissionDenied') }));

    await expect(openProductHostExternalUrl('https://dotify-test01.dev-dot.li', { navigateTo })).resolves.toEqual({
      ok: false,
      reason: 'The Polkadot host could not open the browser: PermissionDenied'
    });
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

    expect(requestPermission).toHaveBeenNthCalledWith(1, { tag: 'WebRtc' });
    expect(requestPermission).toHaveBeenNthCalledWith(2, {
      tag: 'Remote',
      value: { domains: ['dotify-signal.fly.dev'] }
    });
  });

  it('requests every remote room dependency domain inside the Product host', async () => {
    const requestPermission = vi.fn(async () => ({ ok: true as const, value: true }));

    await expect(
      ensureProductHostRoomPermissions(
        'https://dotify-signal.fly.dev',
        {
          isInsideContainer: () => true,
          requestPermission
        },
        {
          remoteUrls: ['https://dotify-api.fly.dev', 'https://dotify-api.fly.dev/api/turn/grant']
        }
      )
    ).resolves.toEqual({ ok: true });

    expect(requestPermission).toHaveBeenNthCalledWith(1, { tag: 'WebRtc' });
    expect(requestPermission).toHaveBeenNthCalledWith(2, {
      tag: 'Remote',
      value: { domains: ['dotify-signal.fly.dev', 'dotify-api.fly.dev'] }
    });
  });

  it('continues when Product Mobile cannot run the permission preflight', async () => {
    const requestPermission = vi.fn(async () => {
      throw new TypeError("c is not a function. (In 'c(s)', 'c' is undefined)");
    });

    await expect(
      ensureProductHostRoomPermissions('https://dotify-signal.fly.dev', {
        isInsideContainer: () => true,
        requestPermission
      })
    ).resolves.toEqual({ ok: true });

    expect(requestPermission).toHaveBeenNthCalledWith(1, { tag: 'WebRtc' });
    expect(requestPermission).toHaveBeenNthCalledWith(2, {
      tag: 'Remote',
      value: { domains: ['dotify-signal.fly.dev'] }
    });
  });

  it('still requests WebRTC when Product Mobile cannot encode the Remote permission', async () => {
    const requestPermission = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, value: true })
      .mockRejectedValueOnce(new TypeError("c is not a function. (In 'c(s)', 'c' is undefined)"));

    await expect(
      ensureProductHostRoomPermissions('https://dotify-signal.fly.dev', {
        isInsideContainer: () => true,
        requestPermission
      })
    ).resolves.toEqual({ ok: true });

    expect(requestPermission).toHaveBeenNthCalledWith(1, { tag: 'WebRtc' });
    expect(requestPermission).toHaveBeenNthCalledWith(2, {
      tag: 'Remote',
      value: { domains: ['dotify-signal.fly.dev'] }
    });
  });

  it('continues when the installed host SDK has no permission preflight export', async () => {
    await expect(
      ensureProductHostRoomPermissions('https://dotify-signal.fly.dev', {
        isInsideContainer: () => true
      })
    ).resolves.toEqual({ ok: true });
  });

  it('does not mask unexpected permission preflight exceptions', async () => {
    const requestPermission = vi.fn(async () => {
      throw new Error('permission bridge crashed');
    });

    await expect(
      ensureProductHostRoomPermissions('https://dotify-signal.fly.dev', {
        isInsideContainer: () => true,
        requestPermission
      })
    ).rejects.toThrow('permission bridge crashed');
  });

  it('explains when the host denies remote signaling access', async () => {
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
      expect(result.reason).toContain('Allow remote access to dotify-signal.fly.dev');
    }
    expect(requestPermission).toHaveBeenCalledTimes(2);
    expect(requestPermission).toHaveBeenNthCalledWith(1, { tag: 'WebRtc' });
  });

  it('explains when the host denies WebRTC access', async () => {
    const requestPermission = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, value: false });

    const result = await ensureProductHostRoomPermissions('https://dotify-signal.fly.dev', {
      isInsideContainer: () => true,
      requestPermission
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('Allow WebRTC');
    }
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });
});
