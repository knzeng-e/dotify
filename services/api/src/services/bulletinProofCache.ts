// Session-local, completed immutable proof data only. Never cache a receipt,
// canonical block-number mapping, current head, retention or authorization.
import type { BulletinCodecs } from './bulletinReceipt.js';

export type BulletinProofBlock = {
  block: number;
  extrinsics: Uint8Array[];
  execution: BulletinCodecs;
  events: Uint8Array;
};
export const BULLETIN_PROOF_CACHE_ENTRIES = 2;
// Encoded body/event payload bound, not a claim about total JavaScript heap.
export const BULLETIN_PROOF_CACHE_BYTES = 12 * 1024 * 1024;

export function createBulletinProofCache() {
  const entries = new Map<string, { value: BulletinProofBlock; bytes: number }>();
  let total = 0;
  return {
    get(at: string): BulletinProofBlock | undefined {
      const entry = entries.get(at);
      if (!entry) return;
      entries.delete(at);
      entries.set(at, entry);
      return entry.value;
    },
    /** The caller has successfully verified a query against these owned bytes.
     * No in-flight payload promise is cached, so this adds no shared cancellation
     * owner. Existing metadata-codec loading is separate. Failures retain nothing. */
    retain(at: string, value: BulletinProofBlock) {
      const bytes = value.events.length + value.extrinsics.reduce((n, b) => n + b.length, 0);
      if (bytes > BULLETIN_PROOF_CACHE_BYTES) return;
      const previous = entries.get(at);
      if (previous) total -= previous.bytes;
      entries.delete(at);
      while (entries.size && (entries.size >= BULLETIN_PROOF_CACHE_ENTRIES || total + bytes > BULLETIN_PROOF_CACHE_BYTES)) {
        const key = entries.keys().next().value!;
        total -= entries.get(key)!.bytes;
        entries.delete(key);
      }
      entries.set(at, { value, bytes });
      total += bytes;
    }
  };
}
