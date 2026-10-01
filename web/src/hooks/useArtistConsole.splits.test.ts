import { describe, expect, it } from 'vitest';
import { resolveReleaseRoyaltySplits } from './useArtistConsole';

const artist = '0x1111111111111111111111111111111111111111';
const collaborator = '0x2222222222222222222222222222222222222222';

describe('release registration splits', () => {
  it('omits a zero-share artist when a free work assigns all support to a collaborator', () => {
    const result = resolveReleaseRoyaltySplits(artist, 'free', 0, [{ id: 'rights', label: 'Rights holder', recipient: collaborator, bps: 10_000 }]);
    expect(result).toEqual({ recipients: [collaborator], shares: [10_000], totalBps: 10_000 });
  });

  it('keeps the artist when their registered share is positive', () => {
    const result = resolveReleaseRoyaltySplits(artist, 'classic', 7_000, [{ id: 'rights', label: 'Rights holder', recipient: collaborator, bps: 3_000 }]);
    expect(result).toEqual({ recipients: [artist, collaborator], shares: [7_000, 3_000], totalBps: 10_000 });
  });
});
