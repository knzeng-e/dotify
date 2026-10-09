import { describe, expect, it } from 'vitest';
import { WALLET_SIGN_IN_HINT, signsInAfterConnect, walletModalCopy } from './WalletModal';

describe('wallet modal intent copy', () => {
  it('explains a support connection at the moment it is requested', () => {
    const copy = walletModalCopy('support');

    expect(copy.eyebrow).toBe('Your paying account');
    expect(copy.title).toBe('Choose how to confirm');
    expect(copy.description).toContain('amount');
    expect(copy.description).toContain('before anything is sent');
  });

  it('keeps artist and account entry points distinct', () => {
    expect(walletModalCopy('artist').description).toContain('artist studio');
    expect(walletModalCopy('account').description).toContain('support an artist');
  });

  it('chains the sign-in only when the connection has a purpose that needs it', () => {
    expect(signsInAfterConnect('support')).toBe(true);
    expect(signsInAfterConnect('artist')).toBe(true);
    expect(signsInAfterConnect('account')).toBe(false);
    expect(WALLET_SIGN_IN_HINT).toContain('Signing pays nothing');
  });
});
