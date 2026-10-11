import { describe, expect, it } from 'vitest';
import { createEmptyReleaseMetadata, normalizeReleaseMetadata, parseMetadataList, releaseDateLabel } from './releaseMetadata';

describe('release metadata', () => {
  it('normalizes bounded artist-entered lists and credits', () => {
    expect(parseMetadataList(' Hip Hop, rap, hip hop, , Soul ')).toEqual(['Hip Hop', 'rap', 'Soul']);
    expect(
      normalizeReleaseMetadata({
        ...createEmptyReleaseMetadata(),
        genres: [' Hip Hop ', 'hip hop', 'Soul'],
        credits: [
          { name: '  Ada  ', role: 'producer' },
          { name: ' ', role: 'performer' }
        ],
        isrc: ' fr-abc-24-12345 '
      })
    ).toMatchObject({ genres: ['Hip Hop', 'Soul'], credits: [{ name: 'Ada', role: 'producer' }], isrc: 'FR-ABC-24-12345' });
  });

  it('formats full dates but preserves year-only precision', () => {
    expect(releaseDateLabel('2020')).toBe('2020');
    expect(releaseDateLabel('2020-05-03')).not.toBe('2020-05-03');
  });
});
