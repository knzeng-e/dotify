import { createHash } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';

export async function databaseNow(client: PoolClient): Promise<number> {
  const result = await client.query('SELECT floor(extract(epoch FROM clock_timestamp()) * 1000)::text AS now');
  return Number(result.rows[0].now);
}

export class SharedStateUnavailableError extends Error {
  readonly statusCode = 503;
  readonly code = 'SHARED_STATE_UNAVAILABLE';
  constructor() {
    super('Your session could not be checked right now. Please try again shortly.');
  }
}
export type SharedStateIdentity = { version: 1; chainId: number; directory: string; sessionEpoch: string };

/** No local fallback, no runtime schema creation, no connection strings in errors. */
export class PostgresState {
  readonly pool: Pool;
  constructor(
    readonly namespace: string,
    connectionString: string
  ) {
    if (!/^[a-z0-9_-]{3,64}$/.test(namespace)) throw new Error('Invalid shared-state namespace');
    this.pool = new Pool({
      connectionString,
      max: 6,
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 10_000,
      query_timeout: 4000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 1000,
      statement_timeout: 3000,
      lock_timeout: 1000,
      idle_in_transaction_session_timeout: 5000,
      application_name: 'dotify-api'
    });
    // Idle backend errors must not crash the process or leak credentials.
    this.pool.on('error', () => {});
  }
  lockId(name: string): string {
    return createHash('sha256').update(`${this.namespace}:${name}`).digest().readBigInt64BE().toString();
  }
  async checked<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch {
      throw new SharedStateUnavailableError();
    }
  }
  async assertIdentity(expected: SharedStateIdentity): Promise<void> {
    await this.checked(async () => {
      const result = await this.pool.query('SELECT identity FROM dotify_state_identity WHERE namespace=$1', [this.namespace]);
      const actual = result.rows[0]?.identity as SharedStateIdentity | undefined;
      if (
        !actual ||
        actual.version !== expected.version ||
        actual.chainId !== expected.chainId ||
        actual.directory !== expected.directory ||
        actual.sessionEpoch !== expected.sessionEpoch
      )
        throw new Error('Shared state not initialized for this deployment');
    });
  }
  async transaction<T>(work: (client: PoolClient, now: number) => Promise<T>): Promise<T> {
    return this.checked(async () => {
      const client = await this.pool.connect();
      let broken = false;
      try {
        await client.query('BEGIN');
        const value = await work(client, await databaseNow(client));
        await client.query('COMMIT');
        return value;
      } catch (error) {
        broken = true;
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release(broken);
      }
    });
  }
  async document<T, R>(name: string, initial: () => T, work: (state: T, now: number) => R): Promise<R> {
    return this.transaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [this.lockId(`document:${name}`)]);
      const result = await client.query('SELECT value FROM dotify_state_documents WHERE namespace=$1 AND name=$2', [this.namespace, name]);
      const state = (result.rows[0]?.value as T | undefined) ?? initial();
      const value = work(state, await databaseNow(client));
      const serialized = JSON.stringify(state);
      if (Buffer.byteLength(serialized) > 1024 * 1024) throw new Error('Trust document capacity reached');
      await client.query(
        'INSERT INTO dotify_state_documents(namespace,name,value) VALUES($1,$2,$3) ON CONFLICT(namespace,name) DO UPDATE SET value=EXCLUDED.value',
        [this.namespace, name, serialized]
      );
      return value;
    });
  }
  /** One custody process owns encrypted jobs and the permanent IV ledger.
   * Losing the DB connection closes admission and aborts its encoder. */
  async holdExclusive(name: string, onLost: () => void): Promise<() => Promise<void>> {
    return this.checked(async () => {
      const client = await this.pool.connect();
      let released = false,
        checking = false;
      let timer: ReturnType<typeof setInterval> | undefined;
      const lose = () => {
        if (released) return;
        released = true;
        if (timer) clearInterval(timer);
        client.release(true);
        onLost();
      };
      client.on('error', lose);
      try {
        const result = await client.query('SELECT pg_try_advisory_lock($1::bigint) AS elected', [this.lockId(name)]);
        if (!result.rows[0].elected) throw new Error('Custody writer is already active');
      } catch (error) {
        client.removeListener('error', lose);
        if (!released) client.release(true);
        throw error;
      }
      timer = setInterval(() => {
        if (released || checking) return;
        checking = true;
        void client
          .query('SELECT 1')
          .catch(lose)
          .finally(() => {
            checking = false;
          });
      }, 1000);
      timer.unref();
      return async () => {
        if (released) return;
        released = true;
        clearInterval(timer);
        try {
          await client.query('SELECT pg_advisory_unlock($1::bigint)', [this.lockId(name)]);
        } finally {
          client.removeListener('error', lose);
          client.release(true);
        }
      };
    });
  }
  async close(): Promise<void> {
    await this.pool.end();
  }
}
