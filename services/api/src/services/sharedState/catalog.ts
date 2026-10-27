import type { PoolClient } from 'pg';
import { catalogSnapshotSchema, type CatalogSnapshot } from '../catalog/types.js';
import type { CatalogSnapshotStore } from '../catalog/snapshotStore.js';
import { PostgresState } from './postgres.js';

/** Election and writes use the SAME connection: a lost writer cannot save
 * using a replacement pool connection after another instance is elected. */
export class PostgresCatalogSnapshotStore implements CatalogSnapshotStore {
  private writer: PoolClient | null = null;
  constructor(private store: PostgresState) {}
  async asWriter<T>(work: () => Promise<T>): Promise<{ elected: true; value: T } | { elected: false }> {
    return this.store.checked(async () => {
      const client = await this.store.pool.connect();
      let locked = false,
        broken = false;
      const lost = () => {
        broken = true;
      };
      client.on('error', lost);
      try {
        const result = await client.query('SELECT pg_try_advisory_lock($1::bigint) AS elected', [this.store.lockId('catalog-writer')]);
        if (!result.rows[0].elected) return { elected: false };
        locked = true;
        this.writer = client;
        return { elected: true, value: await work() };
      } finally {
        this.writer = null;
        if (locked && !broken) {
          try {
            await client.query('SELECT pg_advisory_unlock($1::bigint)', [this.store.lockId('catalog-writer')]);
          } catch {
            broken = true;
          }
        }
        client.removeListener('error', lost);
        client.release(broken);
      }
    });
  }
  async load(): Promise<CatalogSnapshot | null> {
    return this.store.checked(async () => {
      const result = await (this.writer ?? this.store.pool).query('SELECT value FROM dotify_state_documents WHERE namespace=$1 AND name=$2', [
        this.store.namespace,
        'catalog-v1'
      ]);
      return result.rows[0] ? catalogSnapshotSchema.parse(result.rows[0].value) : null;
    });
  }
  async save(snapshot: CatalogSnapshot): Promise<void> {
    const client = this.writer;
    if (!client) throw new Error('Catalog write requires election');
    const validated = catalogSnapshotSchema.parse(snapshot);
    await this.store.checked(async () => {
      await client.query(
        'INSERT INTO dotify_state_documents(namespace,name,value) VALUES($1,$2,$3) ON CONFLICT(namespace,name) DO UPDATE SET value=EXCLUDED.value',
        [this.store.namespace, 'catalog-v1', JSON.stringify(validated)]
      );
    });
  }
}
