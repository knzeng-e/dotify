import { describe, expect, it } from 'vitest';
import { normalizeReleaseDetails, releaseDetailsPreflightError } from './releaseDetails';
const valid = { title: 'Signal', artistName: 'Thot Nzeng', description: 'A song to share.' };
describe('release publication text', () => {
  it('trims text for metadata and registration without inventing an artist', () => {
    expect(normalizeReleaseDetails({ title: ' Signal ', artistName: ' Thot Nzeng ', description: ' A song to share.\n' })).toEqual(valid);
    expect(normalizeReleaseDetails({ ...valid, artistName: '  ' }).artistName).toBe('');
    expect(releaseDetailsPreflightError({ ...valid, artistName: '  ' })).toBe('Add your artist name before publishing.');
  });
  it.each([
    ['title', 800],
    ['artistName', 800],
    ['description', 8000]
  ] as const)('checks the %s contract limit in UTF-8 bytes', (field, bytes) => {
    expect(releaseDetailsPreflightError({ ...valid, [field]: 'a'.repeat(bytes) })).toBeNull();
    expect(releaseDetailsPreflightError({ ...valid, [field]: 'a'.repeat(bytes + 1) })).not.toBeNull();
    expect(releaseDetailsPreflightError({ ...valid, [field]: '🎶'.repeat(bytes / 4) })).toBeNull();
    expect(releaseDetailsPreflightError({ ...valid, [field]: '🎶'.repeat(bytes / 4) + 'é' })).not.toBeNull();
  });
});
