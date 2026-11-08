// Immutable carry-forward baseline. New reservations may be added, but none of
// the inherited generations may disappear before a publisher opens its signer.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { z } from 'zod';
import { load, privateDirectory } from './bulletinMediaState.js';
export const nonceHistorySchema = z
  .object({
    schema: z.literal('dotify.streaming.nonce-history.v1'),
    reservations: z
      .array(z.object({ path: z.string().regex(/^[0-9a-f]{64}\/[0-9a-f]{16}\.json$/), sha256: z.string().regex(/^[0-9a-f]{64}$/) }).strict())
      .max(6000)
  })
  .strict();
export const nonceHistoryHash = (input: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(nonceHistorySchema.parse(input)))
    .digest('hex');
export async function assertNonceHistory(queue: string, expected: string) {
  const history = nonceHistorySchema.parse(await load(join(queue, 'nonce-history.json')));
  assert.equal(nonceHistoryHash(history), expected, 'Permanent nonce carry-forward binding changed');
  assert.equal(new Set(history.reservations.map(r => r.path)).size, history.reservations.length, 'Duplicate inherited nonce');
  await privateDirectory(join(queue, 'nonces'));
  for (const reservation of history.reservations) {
    await privateDirectory(join(queue, 'nonces', reservation.path.split('/')[0]));
    // Validate private ownership/no links with the existing strict state loader;
    // hashing normalized JSON is deliberate (files contain no arbitrary data).
    const value = await load(join(queue, 'nonces', reservation.path));
    const [fingerprint, file] = reservation.path.split('/');
    assert.deepEqual(value, { schema: 'dotify.streaming.nonce-ledger.v1', fingerprint, generation: file.slice(0, 16) }, 'Inherited nonce reservation changed');
    assert.equal(createHash('sha256').update(JSON.stringify(value)).digest('hex'), reservation.sha256, 'Inherited nonce hash changed');
  }
}
