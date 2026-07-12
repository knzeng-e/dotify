import { describe, expect, it } from 'vitest';
import { NAV_ITEMS, VIEW_COPY } from './navigation';

const VIEWS = ['listen', 'player', 'rooms', 'you'] as const;
const PRIMARY_VIEWS = ['listen', 'rooms', 'you'] as const;

describe('VIEW_COPY', () => {
  it('has a title and eyebrow for every view', () => {
    for (const view of VIEWS) {
      expect(VIEW_COPY[view].title.length).toBeGreaterThan(0);
      expect(VIEW_COPY[view].eyebrow.length).toBeGreaterThan(0);
    }
  });
});

describe('NAV_ITEMS', () => {
  it('lists the three primary views in order with labels and icons', () => {
    // The player is a contextual surface opened by a work, room, or dock. It
    // remains a valid routed view without competing with the three places a
    // listener deliberately navigates to.
    expect(NAV_ITEMS.map(item => item.view)).toEqual([...PRIMARY_VIEWS]);
    for (const item of NAV_ITEMS) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.icon).toBeTruthy();
    }
  });
});
