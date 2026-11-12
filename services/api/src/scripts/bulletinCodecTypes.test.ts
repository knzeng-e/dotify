// Test-only, platform-free artifact contract. No production imports or keys.
export type BulletinCodecFixture = {
  schema: 'dotify.synthetic-bulletin-codec.v1';
  keyHex: string;
  scope: { chainId: number; runtimeAddress: string; contentHash: string; keyVersion: string };
  blocks: Record<string, string>;
  graphs: Record<'standard' | 'compact', { root: string; ref: string; playbackBlockCids: string[]; archiveBlockCids: string[] }>;
};
