import { describe, expect, it } from 'vitest';
import type { CatalogTrack } from '../types';
import {
  accessModeLabelFromState,
  catalogAccessAriaLabel,
  catalogAccessLabel,
  catalogAccessShortLabel,
  describeArtistRegistrationError,
  normalizeDisplayText
} from './format';

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
    expect(accessModeLabelFromState('classic')).toBe('Paid listening access');
    expect(catalogAccessLabel(classicTrack, 'PAS')).toBe('0.5 PAS');
  });

  it('shows inactive releases as unavailable instead of payable', () => {
    const inactive = { ...classicTrack, active: false };

    expect(catalogAccessLabel(inactive, 'PAS')).toBe('Inactive release');
    expect(catalogAccessAriaLabel(inactive, false, 'PAS')).toBe('Access unavailable: Inactive release');
  });
});

describe('catalog card access cue', () => {
  it('names the price until the track is unlocked', () => {
    expect(catalogAccessShortLabel(classicTrack, false, 'PAS')).toBe('0.5 PAS');
    expect(catalogAccessShortLabel(classicTrack, true, 'PAS')).toBe('Unlocked');
    expect(catalogAccessShortLabel({ ...classicTrack, accessMode: 'free' }, false, 'PAS')).toBe('Free');
    expect(catalogAccessShortLabel({ ...classicTrack, active: false }, true, 'PAS')).toBe('Unavailable');
  });
});

describe('display text', () => {
  it('collapses contract-provided whitespace without changing content', () => {
    expect(normalizeDisplayText('  A\n  human\t title  ')).toBe('A human title');
  });
});
