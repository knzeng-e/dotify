import { describe, expect, it } from 'vitest';
import type { RoomReactionEvent } from '../../shared/types';
import { appendVisibleReactions, REACTION_LIFETIME_MS, VISIBLE_REACTION_LIMIT } from './reactionPresentation';

const reaction = (id: string): RoomReactionEvent => ({ id, emoji: '✨', senderId: 'listener', senderName: 'Mina', ts: 9000000 });

describe('live reaction presentation', () => {
  it('expires by local arrival, independently of the sender clock', () => {
    const visible = appendVisibleReactions([], [reaction('one')], 100);
    expect(visible[0].expiresAt).toBe(100 + REACTION_LIFETIME_MS);
    expect(appendVisibleReactions(visible, [], 100 + REACTION_LIFETIME_MS)).toEqual([]);
  });

  it('deduplicates a burst and never exceeds the visible limit', () => {
    const burst = Array.from({ length: 30 }, (_, index) => reaction(`${index}`));
    const visible = appendVisibleReactions([], [...burst, burst[29]], 100);
    expect(visible).toHaveLength(VISIBLE_REACTION_LIMIT);
    expect(visible.map(item => item.id)).toEqual(['24', '25', '26', '27', '28', '29']);
    expect(appendVisibleReactions(visible, [burst[29]], 200)).toEqual(visible);
  });

  it('drops expired activity and does not mutate input or invent activity', () => {
    const previous = appendVisibleReactions([], [reaction('old')], 0);
    const next = appendVisibleReactions(previous, [reaction('new')], REACTION_LIFETIME_MS);
    expect(next.map(item => item.id)).toEqual(['new']);
    expect(previous.map(item => item.id)).toEqual(['old']);
    expect(appendVisibleReactions([], [], 500)).toEqual([]);
  });
});
