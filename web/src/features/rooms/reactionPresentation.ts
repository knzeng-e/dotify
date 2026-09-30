import type { RoomReactionEvent } from '../../shared/types';

export const REACTION_LIFETIME_MS = 3200;
export const VISIBLE_REACTION_LIMIT = 6;

export type VisibleReaction = RoomReactionEvent & { expiresAt: number };

// Use local arrival time: device clocks need not agree for an ephemeral effect.
export function appendVisibleReactions(current: VisibleReaction[], incoming: RoomReactionEvent[], now: number): VisibleReaction[] {
  const live = current.filter(reaction => reaction.expiresAt > now);
  const ids = new Set(live.map(reaction => reaction.id));
  for (const reaction of incoming) {
    if (ids.has(reaction.id)) continue;
    ids.add(reaction.id);
    live.push({ ...reaction, expiresAt: now + REACTION_LIFETIME_MS });
  }
  return live.slice(-VISIBLE_REACTION_LIMIT);
}
