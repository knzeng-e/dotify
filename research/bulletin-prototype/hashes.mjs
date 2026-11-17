// Explicit multihash profiles for this research only; production readers are unchanged.
import { sha256 } from 'multiformats/hashes/sha2';
import { create } from 'multiformats/hashes/digest';
import { blake2b } from '@noble/hashes/blake2.js';
export const SHA256 = 0x12;
export const BLAKE2B256 = 0xb220;
export function runtimeHashName(code) {
  if (code === SHA256) return 'Sha2_256';
  if (code === BLAKE2B256) return 'Blake2b256';
  throw new Error('Only SHA-256 and BLAKE2b-256 are admitted');
}
export async function hashBytes(code, bytes) {
  runtimeHashName(code);
  return code === SHA256 ? sha256.digest(bytes) : create(BLAKE2B256, blake2b(bytes, { dkLen: 32 }));
}
