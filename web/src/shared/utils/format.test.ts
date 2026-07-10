import { describe, expect, it } from 'vitest';
import { describeArtistRegistrationError } from './format';

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
