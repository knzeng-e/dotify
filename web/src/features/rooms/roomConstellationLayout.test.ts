import { describe, expect, it } from 'vitest';

import { roomConstellationPosition, shouldShowConstellationLabel } from './roomConstellationLayout';

describe('roomConstellationPosition', () => {
  it('keeps an existing room stable when other rooms appear', () => {
    const before = roomConstellationPosition('ROOM-A1');
    const unrelated = ['ROOM-Z9', 'ROOM-B2', 'ROOM-C3'].map(roomConstellationPosition);
    const after = roomConstellationPosition('ROOM-A1');

    expect(unrelated).toHaveLength(3);
    expect(after).toEqual(before);
  });

  it('keeps 2D and 3D coordinates inside bounded view ranges', () => {
    for (const roomId of ['ROOM-A1', 'ROOM-B2', 'ROOM-C3', 'ROOM-D4', 'ROOM-E5']) {
      const position = roomConstellationPosition(roomId);

      expect(position.xPercent).toBeGreaterThanOrEqual(15);
      expect(position.xPercent).toBeLessThanOrEqual(85);
      expect(position.yPercent).toBeGreaterThanOrEqual(19);
      expect(position.yPercent).toBeLessThanOrEqual(72);
      expect(Math.abs(position.x3d)).toBeLessThanOrEqual(5.5);
      expect(Math.abs(position.y3d)).toBeLessThanOrEqual(0.91);
      expect(Math.abs(position.z3d)).toBeLessThanOrEqual(4.3);
    }
  });
});

describe('shouldShowConstellationLabel', () => {
  it('always keeps the selected room label visible', () => {
    expect(shouldShowConstellationLabel('ROOM-A1', 40, true)).toBe(true);
  });

  it('does not hide labels for realistic pilot room counts', () => {
    expect(shouldShowConstellationLabel('ROOM-A1', 8, false)).toBe(true);
  });

  it('limits labels in dense stress views while preserving selected-room context', () => {
    const roomIds = Array.from({ length: 40 }, (_, index) => `ROOM-${index.toString().padStart(2, '0')}`);
    const visibleLabels = roomIds.filter(roomId => shouldShowConstellationLabel(roomId, roomIds.length, false));

    expect(visibleLabels.length).toBeGreaterThan(0);
    expect(visibleLabels.length).toBeLessThan(roomIds.length);
    expect(shouldShowConstellationLabel(roomIds[17], roomIds.length, true)).toBe(true);
  });
});
