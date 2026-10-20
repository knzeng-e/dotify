import { expect, it, vi } from 'vitest';
import { resolveRoomContributionSessionToken } from './roomContributionSession';

const ADDRESS = '0x1111111111111111111111111111111111111111' as const;
const OTHER_ADDRESS = '0x2222222222222222222222222222222222222222' as const;

it.each([
  { label: 'wallet disconnects', input: { expectedChainId: 42 }, expected: '' },
  { label: 'expected chain is unresolved', input: { hostAccount: ADDRESS, expectedChainId: null }, expected: '' },
  { label: 'expected chain is invalid', input: { hostAccount: ADDRESS, expectedChainId: 0 }, expected: '' }
])('returns the empty server binding when $label', ({ input, expected }) => {
  const lookup = vi.fn(() => 'stale-token');
  expect(resolveRoomContributionSessionToken(input, lookup)).toBe(expected);
  expect(lookup).not.toHaveBeenCalled();
});

it('fails closed when the signer and connected account disagree', () => {
  const lookup = vi.fn(() => 'wrong-account-token');
  expect(
    resolveRoomContributionSessionToken(
      {
        hostAccount: ADDRESS,
        hostSigner: { address: OTHER_ADDRESS, signMessage: vi.fn() },
        expectedChainId: 42
      },
      lookup
    )
  ).toBe('');
  expect(lookup).not.toHaveBeenCalled();
});

it('returns only the token selected for the exact chain and signing identity', () => {
  const signer = { address: ADDRESS, signMessage: vi.fn() };
  const lookup = vi.fn(() => 'chain-42-token');
  expect(resolveRoomContributionSessionToken({ hostAccount: ADDRESS, hostSigner: signer, expectedChainId: 42 }, lookup)).toBe('chain-42-token');
  expect(lookup).toHaveBeenCalledWith(signer, 42);
});

it('returns the empty binding when the exact session is unavailable', () => {
  const lookup = vi.fn(() => null);
  expect(resolveRoomContributionSessionToken({ hostAccount: ADDRESS, expectedChainId: 42 }, lookup)).toBe('');
  expect(lookup).toHaveBeenCalledWith({ address: ADDRESS }, 42);
});
