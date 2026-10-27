import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { progressFor, progressSchema, withProgress } from './progress.js';
import { catalogSnapshotSchema, type CatalogSnapshot } from './types.js';

export interface CatalogSnapshotStore {
  asWriter?<T>(work: () => Promise<T>): Promise<{ elected: true; value: T } | { elected: false }>;
  load(): Promise<CatalogSnapshot | null>;
  save(snapshot: CatalogSnapshot): Promise<void>;
  /** Persist freshness/checkpoint without rewriting artists/releases. */
  saveProgress?(snapshot: CatalogSnapshot): Promise<void>;
}

export class JsonCatalogSnapshotStore implements CatalogSnapshotStore {
  readonly path: string;
  private base: CatalogSnapshot | null = null;

  constructor(path: string) {
    this.path = resolve(path);
  }

  async load(): Promise<CatalogSnapshot | null> {
    try {
      const serialized = await readFile(this.path, 'utf8');
      this.base = catalogSnapshotSchema.parse(JSON.parse(serialized));
      let progress = null;
      try {
        progress = progressSchema.parse(JSON.parse(await readFile(`${this.path}.checkpoint`, 'utf8')));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      return withProgress(this.base, progress);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async save(snapshot: CatalogSnapshot): Promise<void> {
    const validated = catalogSnapshotSchema.parse(snapshot);
    await this.write(this.path, validated);
    this.base = validated;
  }

  async saveProgress(snapshot: CatalogSnapshot): Promise<void> {
    if (!this.base) throw new Error('Catalog progress requires a content checkpoint');
    await this.write(`${this.path}.checkpoint`, progressFor(this.base, snapshot));
  }

  private async write(path: string, value: unknown): Promise<void> {
    const directory = dirname(path);
    const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
    await mkdir(directory, { recursive: true });
    await writeFile(temporaryPath, `${JSON.stringify(value)}\n`, { encoding: 'utf8', mode: 0o600 });
    await rename(temporaryPath, path);
  }
}
