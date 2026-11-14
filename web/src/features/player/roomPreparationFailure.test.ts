import { expect, it } from 'vitest';
import { roomPreparationFailureCopy } from './roomPreparationFailure';
import { ProtectedPlaybackError } from '../catalog/protectedPlaybackFailure';
it('distinguishes an authorized audio deadline from an access failure', () => {
  const copy = roomPreparationFailureCopy(new DOMException('expired', 'TimeoutError'));
  expect(copy.title).toContain('taking too long');
  expect(copy.message).toContain('Listening access was confirmed');
  expect(copy.message).not.toMatch(/wallet|check.*access/i);
  expect(roomPreparationFailureCopy(new ProtectedPlaybackError('access-not-confirmed', 'denied')).title).toContain('access');
  expect(roomPreparationFailureCopy(new Error('gateway unavailable')).message).not.toMatch(/wallet|check.*access|access was confirmed/i);
});
