import type { PoolClient } from 'pg';
import { z } from 'zod';
import type { SharedStateIdentity } from './postgres.js';
import { catalogSnapshotSchema } from '../catalog/types.js';
const revocationsSchema = z
  .object({ epoch: z.string(), revoked: z.array(z.tuple([z.string().min(1).max(128), z.number().int().positive()])).max(100_000) })
  .strict();

/** Called by the explicit offline operator command, never from API startup. */
export async function initializeSharedNamespace(
  client: PoolClient,
  namespace: string,
  identity: SharedStateIdentity,
  legacy?: { revocations: unknown; catalog: unknown },
  now = Date.now()
): Promise<void> {
  if (!/^[a-z0-9_-]{3,64}$/.test(namespace)) throw new Error('Invalid namespace');
  const revoked = legacy ? revocationsSchema.parse(legacy.revocations) : undefined;
  const catalog = legacy ? catalogSnapshotSchema.parse(legacy.catalog) : undefined;
  if (revoked && revoked.epoch !== identity.sessionEpoch) throw new Error('Import must preserve the session epoch');
  if (catalog && (catalog.chainId !== identity.chainId || catalog.directoryAddress.toLowerCase() !== identity.directory))
    throw new Error('Catalog identity mismatch');
  // Unique namespace is intentional. Re-running initialization cannot erase trust.
  await client.query('INSERT INTO dotify_state_identity(namespace,identity) VALUES($1,$2)', [namespace, JSON.stringify(identity)]);
  await client.query('INSERT INTO dotify_state_documents(namespace,name,value) VALUES($1,$2,$3)', [
    namespace,
    'uploads-v1',
    JSON.stringify({ reservations: [], usage: [] })
  ]);
  for (const [jti, expiry] of revoked?.revoked ?? []) {
    if (expiry > now)
      await client.query(
        'INSERT INTO dotify_state_revocations(namespace,jti,expires_at) VALUES($1,$2,$3) ON CONFLICT(namespace,jti) DO UPDATE SET expires_at=greatest(dotify_state_revocations.expires_at,EXCLUDED.expires_at)',
        [namespace, jti, expiry]
      );
  }
  if (catalog)
    await client.query('INSERT INTO dotify_state_documents(namespace,name,value) VALUES($1,$2,$3)', [namespace, 'catalog-v1', JSON.stringify(catalog)]);
}
