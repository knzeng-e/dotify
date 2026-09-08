import { describe, expect, it } from 'vitest';
import type { CatalogTrack } from '../types';
import { accessModeLabelFromState, catalogAccessAriaLabel, catalogAccessLabel, describeArtistRegistrationError } from './format';

const classicTrack = {
  accessMode: 'classic',
  priceDot: '0.5',
  active: true
} as CatalogTrack;

describe('describeArtistRegistrationError', () => {
  it('explains Polkadot Hub EVM invalid transaction contract-call errors as runtime deployment weight limits', () => {
    const message = describeArtistRegistrationError(
      new Error(
        'RPC 0x190f1b41 Custom eth_sendRawTransaction: Invalid Transaction Contract call: address: 0x38dba15b7296ca9d3544c9f996e8e1898ad42ca5 function: createRuntime()'
      )
    );

    expect(message).toContain('Polkadot Hub EVM weight limit');
    expect(message).toContain('Redeploy the updated ArtistRuntimeFactory');
  });
});

describe('catalog access labels', () => {
  it('uses direct-support language for Classic mode', () => {
    expect(accessModeLabelFromState('classic')).toBe('Direct support');
    expect(catalogAccessLabel(classicTrack, 'PAS')).toBe('0.5 PAS');
  });

  it('shows inactive releases as unavailable instead of payable', () => {
    const inactive = { ...classicTrack, active: false };

    expect(catalogAccessLabel(inactive, 'PAS')).toBe('Inactive release');
    expect(catalogAccessAriaLabel(inactive, false, 'PAS')).toBe('Access unavailable: Inactive release');
  });
});
