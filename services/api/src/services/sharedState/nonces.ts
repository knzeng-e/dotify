import { randomBytes } from 'node:crypto';
import type { IssuedNonce, NonceConsumption } from '../replayProtection.js';
import { databaseNow, PostgresState } from './postgres.js';
const TTL = 5 * 60_000;
export class PostgresNonces {
  constructor(private store: PostgresState) {}
  async issue(address: string, chainId: number): Promise<IssuedNonce> {
    return this.store.transaction(async client => {
      // Admission lock bounds the total live set even under concurrent issuers.
      await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [this.store.lockId('nonce-admission')]);
      const now = await databaseNow(client);
      await client.query('DELETE FROM dotify_state_nonces WHERE namespace=$1 AND expires_at <= $2', [this.store.namespace, now]);
      const count = await client.query('SELECT count(*)::int AS n FROM dotify_state_nonces WHERE namespace=$1', [this.store.namespace]);
      if (count.rows[0].n >= 4096) throw new Error('Nonce capacity reached');
      const nonce = randomBytes(24).toString('hex'),
        expires = now + TTL;
      await client.query('INSERT INTO dotify_state_nonces(namespace,nonce,address,chain_id,expires_at) VALUES($1,$2,$3,$4,$5)', [
        this.store.namespace,
        nonce,
        address.toLowerCase(),
        chainId,
        expires
      ]);
      return { nonce, expiresAt: new Date(expires).toISOString() };
    });
  }
  async consume(nonce: string, address: string, chainId: number): Promise<NonceConsumption> {
    return this.store.transaction(async client => {
      const result = await client.query('SELECT address,chain_id,expires_at,used FROM dotify_state_nonces WHERE namespace=$1 AND nonce=$2 FOR UPDATE', [
        this.store.namespace,
        nonce
      ]);
      const row = result.rows[0];
      const now = await databaseNow(client);
      if (!row) return { ok: false, code: 'NONCE_UNKNOWN', reason: 'Request a new sign-in challenge.' };
      if (Number(row.expires_at) <= now) return { ok: false, code: 'NONCE_EXPIRED', reason: 'The challenge expired. Try again.' };
      if (row.used) return { ok: false, code: 'NONCE_REUSED', reason: 'This challenge was already used. Try again.' };
      if (row.address !== address.toLowerCase()) return { ok: false, code: 'NONCE_ADDRESS_MISMATCH', reason: 'The challenge belongs to a different account.' };
      if (Number(row.chain_id) !== chainId) return { ok: false, code: 'NONCE_CHAIN_MISMATCH', reason: 'The challenge belongs to a different network.' };
      await client.query('UPDATE dotify_state_nonces SET used=true WHERE namespace=$1 AND nonce=$2', [this.store.namespace, nonce]);
      return { ok: true };
    });
  }
}
