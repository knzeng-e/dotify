// Operator tooling owns this PAPI line; the frontend keeps its legacy dependency.
import { createClient } from 'polkadot-api-operator';
import { getWsProvider } from 'polkadot-api-operator/ws';
import assert from 'node:assert/strict';
import { ASSET_HUB_GENESIS } from './artist-onboarding-prerequisites.mjs';

export const createOperatorNativeClient = endpoint => createClient(getWsProvider(endpoint));

/** Hold the selected finalized block while reading native mapping metadata/state. */
export async function readOperatorNativeSnapshot(client, artist, { signal, decodePublicKey }) {
  signal.throwIfAborted();
  const spec = await client.getChainSpecData();
  signal.throwIfAborted();
  assert.equal(spec.genesisHash, ASSET_HUB_GENESIS, 'Unexpected native genesis');
  const block = await client.getFinalizedBlock();
  signal.throwIfAborted();
  const release = client.hodlBlock(block.hash);
  try {
    const mapped = await client.getUnsafeApi().query.Revive.OriginalAccount.getValue(artist, { at: block.hash, signal });
    signal.throwIfAborted();
    return {
      genesis: spec.genesisHash,
      number: block.number,
      hash: block.hash,
      mappedPublicKey: mapped == null ? null : decodePublicKey(mapped)
    };
  } finally {
    release();
  }
}
