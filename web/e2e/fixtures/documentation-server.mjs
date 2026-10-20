// Opt-in gallery fixture. Real local rooms; synthetic registry reads, no signer.
import process from 'node:process';
import { readConfigFromEnv, startSignalingServer } from '../../server/signaling.mjs';
import { artist, runtime, tracks } from './documentation-releases.mjs';

const client = {
  getChainId: async () => 42,
  readContract: async ({ address, functionName, args }) => {
    if (functionName === 'runtimeOf' && args[0] === artist) return runtime;
    const track = tracks.find(track => track.hash === args[0]);
    if (address === runtime && functionName === 'musicRegGetTrack' && track)
      return [{ artist, active: true, title: track.title, artistName: track.artist, imageRef: track.imageRef }];
    throw new Error('Unknown documentation release.');
  }
};
const server = startSignalingServer(
  { ...readConfigFromEnv(), contributions: { chainId: 42, directory: artist }, roomCreateRateLimit: { limit: 20, windowMs: 60_000 } },
  { contributions: { client } }
);
await server.listen();
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => void server.close().finally(() => process.exit(0)));
