import { describe, expect, it } from 'vitest';
import { chainMismatchMessage, getProviderErrorCode, parseChainId, toEip155ChainId } from './network';

describe('parseChainId', () => {
  it('passes finite numbers through', () => {
    expect(parseChainId(420420417)).toBe(420420417);
  });

  it('parses hex and decimal strings', () => {
    expect(parseChainId('0x1')).toBe(1);
    expect(parseChainId('137')).toBe(137);
  });

  it('returns undefined for non-numeric input', () => {
    expect(parseChainId('nope')).toBeUndefined();
    expect(parseChainId(undefined)).toBeUndefined();
    expect(parseChainId(Number.NaN)).toBeUndefined();
  });
});

describe('toEip155ChainId', () => {
  it('encodes a numeric chain id as 0x-hex', () => {
    expect(toEip155ChainId(1)).toBe('0x1');
    expect(toEip155ChainId(137)).toBe('0x89');
  });
});

describe('getProviderErrorCode', () => {
  it('reads numeric and numeric-string codes', () => {
    expect(getProviderErrorCode({ code: 4001 })).toBe(4001);
    expect(getProviderErrorCode({ code: '4902' })).toBe(4902);
  });

  it('returns undefined when there is no code', () => {
    expect(getProviderErrorCode(null)).toBeUndefined();
    expect(getProviderErrorCode({})).toBeUndefined();
    expect(getProviderErrorCode('error')).toBeUndefined();
  });
});

describe('chainMismatchMessage', () => {
  it('names the expected and current chains', () => {
    expect(chainMismatchMessage(420420417, 1)).toBe('Switch your wallet to chain 420420417. Your wallet is currently on chain 1.');
  });

  it('renders an unknown current chain as undefined', () => {
    expect(chainMismatchMessage(137, undefined)).toBe('Switch your wallet to chain 137. Your wallet is currently on chain undefined.');
  });
});
