import { describe, expect, it } from 'vitest';
import { walletModalCopy } from './WalletModal';

describe('wallet modal intent copy', () => {
  it('explains a support connection at the moment it is requested', () => {
    const copy = walletModalCopy('support');

    expect(copy.eyebrow).toBe('Support this artist');
    expect(copy.title).toBe('Choose how to confirm');
    expect(copy.description).toContain('amount');
    expect(copy.description).toContain('before anything is sent');
  });

  it('keeps artist and account entry points distinct', () => {
    expect(walletModalCopy('artist').description).toContain('artist space');
    expect(walletModalCopy('account').description).toContain('support an artist');
  });
});
