// Internal HKDF primitive for an already validated, normalized release scope.
// No config, vault, environment, key delivery or authority lookup is performed.
import { hkdfSync } from 'node:crypto';

type ReleaseScope = { keyVersion: string; chainId: number; runtimeAddress: string; contentHash: string };
export function deriveReleaseKeyMaterial(master: Uint8Array, scope: ReleaseScope): Buffer {
  const info = `${scope.keyVersion}:${scope.chainId}:${scope.runtimeAddress}:${scope.contentHash}`;
  return Buffer.from(hkdfSync('sha256', master, Buffer.alloc(0), Buffer.from(info, 'utf8'), 32));
}
