import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { catalogSnapshotSchema, type CatalogSnapshot } from './types.js';

export interface CatalogSnapshotStore {
  load(): Promise<CatalogSnapshot | null>;
  save(snapshot: CatalogSnapshot): Promise<void>;
}

export class JsonCatalogSnapshotStore implements CatalogSnapshotStore {
  readonly path: string;

  constructor(path: string) {
    this.path = resolve(path);
  }

  async load(): Promise<CatalogSnapshot | null> {
    try {
      const serialized = await readFile(this.path, 'utf8');
      return catalogSnapshotSchema.parse(JSON.parse(serialized));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async save(snapshot: CatalogSnapshot): Promise<void> {
    const validated = catalogSnapshotSchema.parse(snapshot);
    const directory = dirname(this.path);
    const temporaryPath = `${this.path}.${process.pid}.${randomUUID()}.tmp`;
    await mkdir(directory, { recursive: true });
    await writeFile(temporaryPath, `${JSON.stringify(validated)}\n`, { encoding: 'utf8', mode: 0o600 });
    await rename(temporaryPath, this.path);
  }
}
