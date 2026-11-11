// Physical storage only: neither a content-key version nor listening authority.
import assert from 'node:assert/strict';
import { z } from 'zod';

export const STANDARD_BULLETIN_LAYOUT = 'unixfs-files-v1' as const;
export const COMPACT_BULLETIN_LAYOUT = 'rendition-pack-v1' as const;
export const bulletinStorageLayoutSchema = z.enum([STANDARD_BULLETIN_LAYOUT, COMPACT_BULLETIN_LAYOUT]);
export type BulletinStorageLayout = z.infer<typeof bulletinStorageLayoutSchema>;

// Deliberately distinct from the research marker. No arbitrary chunk size,
// startup policy, external offsets or codec defaults are part of this contract.
export const compactLayoutMarkerSchema = z
  .object({
    schema: z.literal('dotify.bulletin.rendition-pack.v1'),
    chunkSize: z.literal(262144),
    startup: z.literal('init-and-first')
  })
  .strict();
export const compactLayoutMarker = () =>
  compactLayoutMarkerSchema.parse({
    schema: 'dotify.bulletin.rendition-pack.v1',
    chunkSize: 262144,
    startup: 'init-and-first'
  });

/** Only an absent field on a legacy graph means standard. Null, unknown and
 * misspelled selections must never silently choose a different graph. */
export function bulletinGraphLayout(graph: { layout?: BulletinStorageLayout }): BulletinStorageLayout {
  return graph.layout === undefined ? STANDARD_BULLETIN_LAYOUT : bulletinStorageLayoutSchema.parse(graph.layout);
}

/** Current queues/references are v3 path-based. Refuse a compact inventory at
 * composition/recovery boundaries until versioned delivery is installed. */
export function assertStandardBulletinLayout(layout: BulletinStorageLayout) {
  assert.equal(layout, STANDARD_BULLETIN_LAYOUT, 'Compact Bulletin delivery is not enabled for this publication');
}
