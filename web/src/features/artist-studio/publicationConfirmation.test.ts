import { expect, it } from 'vitest';
import { publicationIsVisible } from './usePublicationConfirmation';
import type { CatalogTrack } from '../../shared/types';
const hash = `0x${'11'.repeat(32)}` as const;
const runtime = '0x0000000000000000000000000000000000000001';
const item = { id: `${runtime}:${hash}`, hash, active: true, source: 'artist' } as CatalogTrack;
it('requires both the approved runtime and hash and excludes inactive releases', () => {
  expect(publicationIsVisible([item], { runtime, hash })).toBe(true);
  expect(publicationIsVisible([{ ...item, id: `0x0000000000000000000000000000000000000002:${hash}` }], { runtime, hash })).toBe(false);
  expect(publicationIsVisible([{ ...item, active: false }], { runtime, hash })).toBe(false);
});
