import { expect, it } from 'vitest';
import { publicationIsVisible, catalogVisibilityFeedback } from './usePublicationConfirmation';
import type { CatalogTrack } from '../../shared/types';
const hash = `0x${'11'.repeat(32)}` as const;
const runtime = '0x0000000000000000000000000000000000000001';
const item = { id: `${runtime}:${hash}`, hash, active: true, source: 'artist' } as CatalogTrack;
it('requires both the approved runtime and hash and excludes inactive releases', () => {
  expect(publicationIsVisible([item], { runtime, hash })).toBe(true);
  expect(publicationIsVisible([{ ...item, id: `0x0000000000000000000000000000000000000002:${hash}` }], { runtime, hash })).toBe(false);
  expect(publicationIsVisible([{ ...item, active: false }], { runtime, hash })).toBe(false);
});

it('keeps confirmed approval distinct from catalogue visibility without losing its proof', () => {
  const check = () => {};
  const base = {
    operationKind: 'publication' as const,
    operationId: 'publication:test',
    tone: 'pending' as const,
    title: 'Waiting',
    message: '',
    txHash: hash
  };
  const delayed = catalogVisibilityFeedback(base, true, false, check);
  expect(delayed).toMatchObject({
    tone: 'pending',
    title: 'Release approved',
    publicationVisibility: 'delayed',
    txHash: hash,
    recoveryAction: { run: check, disabled: false }
  });
  expect(delayed.steps?.slice(0, 3).every(step => step.status === 'complete')).toBe(true);
  expect(delayed.steps?.[3].status).not.toBe('complete');
  expect(catalogVisibilityFeedback(base, false, true, check).recoveryAction?.disabled).toBe(true);
});
