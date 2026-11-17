import { z } from 'zod';
import { catalogSnapshotSchema, type CatalogSnapshot } from './types.js';
import { catalogContent } from './content.js';

export const checkpointSchema = catalogSnapshotSchema.omit({ artists: true, releases: true });
export const progressSchema = z.object({
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  base: z.object({ indexedAt: z.string().datetime(), lastIndexedBlock: z.number().int().nonnegative(), lastIndexedBlockHash: z.string() }),
  checkpoint: checkpointSchema
});
export type CatalogProgress = z.infer<typeof progressSchema>;
export function progressFor(base: CatalogSnapshot, snapshot: CatalogSnapshot): CatalogProgress {
  if (catalogContent(base).revision !== catalogContent(snapshot).revision) throw new Error('Progress cannot replace catalog content');
  return {
    revision: catalogContent(base).revision,
    base: { indexedAt: base.indexedAt, lastIndexedBlock: base.lastIndexedBlock, lastIndexedBlockHash: base.lastIndexedBlockHash },
    checkpoint: checkpointSchema.parse(snapshot)
  };
}
export function progressMatches(base: CatalogSnapshot, progress: CatalogProgress): boolean {
  return (
    base.indexedAt === progress.base.indexedAt &&
    base.lastIndexedBlock === progress.base.lastIndexedBlock &&
    base.lastIndexedBlockHash === progress.base.lastIndexedBlockHash &&
    base.chainId === progress.checkpoint.chainId &&
    base.directoryAddress.toLowerCase() === progress.checkpoint.directoryAddress.toLowerCase() &&
    catalogContent(base).revision === progress.revision
  );
}
export function withProgress(base: CatalogSnapshot, progress: CatalogProgress | null): CatalogSnapshot {
  return progress && progressMatches(base, progress) ? { ...base, ...progress.checkpoint } : base;
}
