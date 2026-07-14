import { describe, expect, it } from 'vitest';
import { ARTIST_PUBLICATION_QUARANTINE_MESSAGE, isLoopbackRpcUrl, resolveArtistPublicationSafety } from './deploymentSafety';
import type { ArtistPublicationSafetyInput } from './deploymentSafety';

const safeInput: ArtistPublicationSafetyInput = {
  explicitE2e: false,
  rpcUrl: 'https://eth-rpc-testnet.polkadot.io/',
  currentChainId: 420420417,
  expectedChainId: 420420417,
  configuredFactory: '0x1111111111111111111111111111111111111111',
  configuredDirectory: '0x2222222222222222222222222222222222222222',
  attestedFactory: '0x1111111111111111111111111111111111111111',
  attestedDirectory: '0x2222222222222222222222222222222222222222',
  auditedBlock: 123,
  auditedBlockHash: `0x${'ab'.repeat(32)}`,
  factoryDirectoryPairingVerified: true,
  protectedRuntimeCount: 2,
  totalRuntimeCount: 2,
  ownerMatchedTrackCount: 3,
  totalTrackCount: 3,
  pendingRuntimeDiscoveryComplete: true,
  pendingRuntimeCount: 0,
  futureFactoryUsesOwnerGuard: true,
  correctedRegistryCodeHash: `0x${'cd'.repeat(32)}`,
  futureFactoryRegistryCodeHash: `0x${'cd'.repeat(32)}`,
  catalogCutoverReady: true
};

function expectQuarantined(input: ArtistPublicationSafetyInput) {
  expect(resolveArtistPublicationSafety(input)).toEqual({
    quarantined: true,
    reason: ARTIST_PUBLICATION_QUARANTINE_MESSAGE
  });
}

describe('isLoopbackRpcUrl', () => {
  it.each(['http://localhost:8545', 'http://127.0.0.1:8545', 'http://[::1]:8545'])('recognizes loopback RPC %s', rpcUrl => {
    expect(isLoopbackRpcUrl(rpcUrl)).toBe(true);
  });

  it.each(['https://eth-rpc-testnet.polkadot.io/', 'https://rpc.example/', 'not a url'])('rejects public or invalid RPC %s', rpcUrl => {
    expect(isLoopbackRpcUrl(rpcUrl)).toBe(false);
  });
});

describe('resolveArtistPublicationSafety', () => {
  it('preserves an explicitly requested E2E artist flow', () => {
    expect(
      resolveArtistPublicationSafety({
        ...safeInput,
        explicitE2e: true,
        currentChainId: null,
        protectedRuntimeCount: 0,
        futureFactoryUsesOwnerGuard: false,
        catalogCutoverReady: false
      })
    ).toEqual({ quarantined: false, reason: '' });
  });

  it('preserves a resolved loopback chain that is distinct from the attested public chain', () => {
    expect(
      resolveArtistPublicationSafety({
        ...safeInput,
        rpcUrl: 'http://127.0.0.1:8545',
        currentChainId: 31337,
        protectedRuntimeCount: 0,
        futureFactoryUsesOwnerGuard: false,
        catalogCutoverReady: false
      })
    ).toEqual({ quarantined: false, reason: '' });
  });

  it('does not treat a loopback endpoint using the public chain id as a local-chain bypass', () => {
    expectQuarantined({ ...safeInput, rpcUrl: 'http://localhost:8545', protectedRuntimeCount: 0 });
  });

  it('quarantines until the RPC chain id has been resolved', () => {
    expectQuarantined({ ...safeInput, currentChainId: null });
  });

  it('quarantines a public RPC on a chain other than the attested chain', () => {
    expectQuarantined({ ...safeInput, currentChainId: 1 });
  });

  it.each([
    ['factory', { configuredFactory: '0x3333333333333333333333333333333333333333' }],
    ['directory', { configuredDirectory: '0x3333333333333333333333333333333333333333' }]
  ])('quarantines an address-book %s change until a matching attestation is checked in', (_label, patch) => {
    expectQuarantined({ ...safeInput, ...patch });
  });

  it.each([
    ['an unprotected runtime', { protectedRuntimeCount: 1 }],
    ['an empty runtime audit before catalog cutover', { protectedRuntimeCount: 0, totalRuntimeCount: 0, catalogCutoverReady: false }],
    ['an owner-mismatched track', { ownerMatchedTrackCount: 2 }],
    ['an empty track audit before catalog cutover', { ownerMatchedTrackCount: 0, totalTrackCount: 0, catalogCutoverReady: false }],
    ['a missing audit block', { auditedBlock: 0 }],
    ['a missing audit block hash', { auditedBlockHash: null }],
    ['an unverified factory/directory pairing', { factoryDirectoryPairingVerified: false }],
    ['incomplete pending-runtime discovery', { pendingRuntimeDiscoveryComplete: false }],
    ['a pending runtime', { pendingRuntimeCount: 1 }],
    ['an unsafe future factory', { futureFactoryUsesOwnerGuard: false }],
    ['a future factory with the wrong registry bytecode', { futureFactoryRegistryCodeHash: `0x${'ef'.repeat(32)}` }],
    ['an incomplete catalog cutover', { catalogCutoverReady: false }]
  ])('quarantines public publication when there is %s', (_label, patch) => {
    expectQuarantined({ ...safeInput, ...patch });
  });

  it('reopens the attested public deployment only when every proof is complete', () => {
    expect(resolveArtistPublicationSafety(safeInput)).toEqual({ quarantined: false, reason: '' });
  });

  it('reopens an attested fresh deployment with no finalized or pending runtimes', () => {
    expect(
      resolveArtistPublicationSafety({
        ...safeInput,
        protectedRuntimeCount: 0,
        totalRuntimeCount: 0,
        ownerMatchedTrackCount: 0,
        totalTrackCount: 0,
        pendingRuntimeDiscoveryComplete: true,
        pendingRuntimeCount: 0,
        catalogCutoverReady: true
      })
    ).toEqual({ quarantined: false, reason: '' });
  });
});
