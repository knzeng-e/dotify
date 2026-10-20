import type { RoomActivity, RoomChatMessage } from '../../shared/types';

export type TimelineEntry = { id: string; ts: number; message?: RoomChatMessage; activity?: RoomActivity; text?: string };
export function chatTimeline(messages: RoomChatMessage[], events: RoomActivity[], showActivity: boolean): TimelineEntry[] {
  const rows: TimelineEntry[] = messages
    .filter(message => showActivity || message.senderId !== 'dotify-confirmed-tip')
    .map(message => ({ id: message.id, ts: message.ts, message }));
  if (showActivity) rows.push(...events.map(activity => ({ id: activity.id, ts: activity.ts, activity, text: activity.text })));
  rows.sort((a, b) => a.ts - b.ts);
  const grouped: TimelineEntry[] = [];
  for (const row of rows) {
    const previous = grouped[grouped.length - 1];
    if (
      row.activity &&
      ['joined', 'left'].includes(row.activity.kind) &&
      previous?.activity?.kind === row.activity.kind &&
      row.ts - previous.ts < 5000 &&
      (previous.text?.length ?? 0) < 180
    ) {
      previous.text += ` ${row.text}`;
    } else grouped.push({ ...row });
  }
  return grouped;
}

export function typingLabel(names: string[]) {
  if (!names.length) return '';
  if (names.length > 2) return 'Several people are typing…';
  return `${names.join(' and ')} ${names.length === 1 ? 'is' : 'are'} typing…`;
}
