import { describe, expect, it } from 'vitest';

import { roomConstellationPosition } from './roomConstellationLayout';

describe('roomConstellationPosition', () => {
  it('keeps an existing room stable when other rooms appear', () => {
    const before = roomConstellationPosition('ROOM-A1');
    const unrelated = ['ROOM-Z9', 'ROOM-B2', 'ROOM-C3'].map(roomConstellationPosition);
    const after = roomConstellationPosition('ROOM-A1');

    expect(unrelated).toHaveLength(3);
    expect(after).toEqual(before);
  });

  it('keeps 2D coordinates inside bounded view ranges', () => {
    for (const roomId of ['ROOM-A1', 'ROOM-B2', 'ROOM-C3', 'ROOM-D4', 'ROOM-E5']) {
      const position = roomConstellationPosition(roomId);

      expect(position.xPercent).toBeGreaterThanOrEqual(15);
      expect(position.xPercent).toBeLessThanOrEqual(85);
      expect(position.yPercent).toBeGreaterThanOrEqual(19);
      expect(position.yPercent).toBeLessThanOrEqual(72);
    }
  });
});
