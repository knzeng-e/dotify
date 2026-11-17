import type { PoolClient } from 'pg';
import { catalogContent } from '../catalog/content.js';
import { checkpointSchema, progressFor, progressSchema, withProgress } from '../catalog/progress.js';
import { catalogSnapshotSchema, type CatalogSnapshot } from '../catalog/types.js';
import type { CatalogSnapshotStore } from '../catalog/snapshotStore.js';
import { PostgresState } from './postgres.js';

/** Election and writes use the SAME connection: a lost writer cannot save
 * using a replacement pool connection after another instance is elected. */
export class PostgresCatalogSnapshotStore implements CatalogSnapshotStore {
  private writer: PoolClient | null = null;
  private base: CatalogSnapshot | null = null;
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
      const base = this.base;
      // One statement observes a consistent content/progress pair. On unchanged
      // content send only the small base header, reusing parsed arrays/indexes.
      const result = await (this.writer ?? this.store.pool).query(
        `
        SELECT CASE WHEN p.value->>'revision'=$3
          AND p.value->'base'->>'indexedAt'=c.value->>'indexedAt'
          AND p.value->'base'->>'lastIndexedBlock'=c.value->>'lastIndexedBlock'
          AND p.value->'base'->>'lastIndexedBlockHash'=c.value->>'lastIndexedBlockHash'
          THEN c.value - 'artists' - 'releases' ELSE c.value END AS content,
          p.value AS progress
        FROM dotify_state_documents c LEFT JOIN dotify_state_documents p
          ON p.namespace=c.namespace AND p.name='catalog-checkpoint-v1'
        WHERE c.namespace=$1 AND c.name=$2`,
        [this.store.namespace, 'catalog-v1', base ? catalogContent(base).revision : '']
      );
      if (!result.rows[0]) {
        if (this.base === base) this.base = null;
        return null;
      }
      const { content, progress } = result.rows[0];
      const loaded = 'releases' in content ? catalogSnapshotSchema.parse(content) : { ...base!, ...checkpointSchema.parse(content) };
      if (this.base === base) this.base = loaded;
      return withProgress(loaded, progress ? progressSchema.parse(progress) : null);
    });
  }
  async save(snapshot: CatalogSnapshot): Promise<void> {
    const client = this.writer;
    if (!client) throw new Error('Catalog write requires election');
    const validated = catalogSnapshotSchema.parse(snapshot);
    await this.store.checked(async () => {
      await client.query('BEGIN');
      try {
        await this.write(client, 'catalog-v1', validated);
        await this.write(client, 'catalog-checkpoint-v1', progressFor(validated, snapshot));
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      }
    });
    // Preserve immutable content references instead of parsed clones.
    this.base = snapshot;
  }
  async saveProgress(snapshot: CatalogSnapshot): Promise<void> {
    const client = this.writer;
    if (!client || !this.base) throw new Error('Catalog progress requires election and content');
    const progress = progressFor(this.base, snapshot);
    await this.store.checked(() => this.write(client, 'catalog-checkpoint-v1', progress));
  }
  private async write(client: PoolClient, name: string, value: unknown): Promise<void> {
    await client.query(
      'INSERT INTO dotify_state_documents(namespace,name,value) VALUES($1,$2,$3) ON CONFLICT(namespace,name) DO UPDATE SET value=EXCLUDED.value',
      [this.store.namespace, name, JSON.stringify(value)]
    );
  }
}
