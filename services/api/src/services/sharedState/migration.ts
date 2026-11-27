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

/** Move the dedicated managed role to a fresh generation in the same transaction as initialization. */
export async function cutOverManagedNamespace(client: PoolClient, previous: string, next: string, identity: SharedStateIdentity): Promise<void> {
  if (!/^[a-z0-9_-]{3,64}$/.test(previous) || !/^[a-z0-9_-]{3,64}$/.test(next) || previous === next) {
    throw new Error('Supply distinct valid namespaces');
  }
  if (!/^0x[0-9a-f]{40}$/.test(identity.directory) || !Number.isSafeInteger(identity.chainId) || identity.chainId <= 0 || !identity.sessionEpoch) {
    throw new Error('Supply the reviewed fresh chain, directory and session epoch');
  }

  const tables = ['dotify_state_identity', 'dotify_state_nonces', 'dotify_state_revocations', 'dotify_state_documents'] as const;
  await client.query(`LOCK TABLE ${tables.map(table => `public.${table}`).join(', ')} IN ACCESS EXCLUSIVE MODE`);
  const old = await client.query<{ identity: SharedStateIdentity }>('SELECT identity FROM dotify_state_identity WHERE namespace=$1 FOR UPDATE', [previous]);
  const prior = old.rows[0]?.identity;
  if (!prior || prior.chainId !== identity.chainId || prior.directory === identity.directory || prior.sessionEpoch === identity.sessionEpoch) {
    throw new Error('Previous namespace does not match the expected reset boundary');
  }

  const managed = await client.query<{
    tablename: string;
    policyname: string;
    cmd: string;
    expected_role: boolean;
    permissive: string;
    qual: string;
    with_check: string | null;
    enabled: boolean;
    safe_role: boolean;
  }>(
    `SELECT p.tablename, p.policyname, p.cmd, p.roles=ARRAY['dotify_runtime'::name] AS expected_role,
            p.permissive, p.qual, p.with_check, c.relrowsecurity AS enabled,
            NOT (r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR pg_has_role(r.oid,c.relowner,'MEMBER')
                 OR pg_has_role(r.oid,'schema_admin','MEMBER') OR has_table_privilege(r.oid,c.oid,'TRUNCATE') OR has_schema_privilege(r.oid,n.oid,'CREATE')) AS safe_role
       FROM pg_policies p
       JOIN pg_namespace n ON n.nspname=p.schemaname
       JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=p.tablename
       JOIN pg_roles r ON r.rolname='dotify_runtime'
      WHERE p.schemaname='public' AND p.tablename=ANY($1)`,
    [tables]
  );
  const priorPredicate = `(namespace = '${previous}'::text)`;
  if (
    managed.rows.length !== tables.length ||
    !tables.every(table => {
      const policy = managed.rows.find(row => row.tablename === table);
      const readOnly = table === 'dotify_state_identity';
      return (
        policy?.enabled &&
        policy.safe_role &&
        policy.expected_role &&
        policy.permissive === 'PERMISSIVE' &&
        policy.policyname === (readOnly ? 'runtime_identity_read' : 'runtime_namespace') &&
        policy.cmd === (readOnly ? 'SELECT' : 'ALL') &&
        policy.qual === priorPredicate &&
        policy.with_check === (readOnly ? null : priorPredicate)
      );
    })
  ) {
    throw new Error('Managed runtime privileges or policies differ from the reviewed previous namespace');
  }

  await initializeSharedNamespace(client, next, identity);
  // next has been limited to the namespace identifier alphabet above.
  await client.query(`ALTER POLICY runtime_identity_read ON public.dotify_state_identity USING (namespace = '${next}')`);
  for (const table of tables.slice(1)) {
    await client.query(`ALTER POLICY runtime_namespace ON public.${table} USING (namespace = '${next}') WITH CHECK (namespace = '${next}')`);
  }
}
