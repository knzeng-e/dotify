import { describe, expect, it } from 'vitest';
import { chatTimeline, typingLabel } from './chatTimeline';
import { updateChatUnread } from './chatUnread';
import type { RoomActivity, RoomChatMessage } from '../../shared/types';

const message = (id: string, extra = {}): RoomChatMessage => ({ id, senderId: 'guest', senderName: 'Ada', text: 'Hello', ts: 1000, ...extra });
describe('room conversation', () => {
  it('groups adjacent presence but keeps messages and artist welcomes distinct', () => {
    const event = (id: string, kind: RoomActivity['kind'], ts: number): RoomActivity => ({ id, kind, ts, text: id });
    const events = [event('a', 'joined', 10), event('b', 'joined', 20), event('c', 'artist-joined', 30), event('d', 'joined', 1100)];
    expect(chatTimeline([message('m')], events, true).map(row => row.text ?? row.message?.text)).toEqual(['a b', 'c', 'Hello', 'd']);
    expect(chatTimeline([message('m')], events, false)).toHaveLength(1);
  });
  it('counts new chat and direct replies, never history, own messages or tips', () => {
    let state = updateChatUnread(null, [message('history')], 'self', false);
    expect(state.unread).toBe(0);
    const messages = [
      message('history'),
      message('new', { mentions: ['self'] }),
      message('tip', { senderId: 'dotify-confirmed-tip' }),
      message('own', { senderId: 'self' }),
      message('reply', { replyTo: { senderId: 'self' } })
    ];
    state = updateChatUnread(state, messages, 'self', false);
    expect(state).toMatchObject({ unread: 2, mentions: 2, firstUnread: 'new' });
    expect(updateChatUnread(state, messages, 'self', false).unread).toBe(2);
    expect(updateChatUnread(state, messages, 'self', true)).toMatchObject({ unread: 0, mentions: 0, firstUnread: undefined });
  });
  it('keeps typing labels bounded', () => {
    expect(typingLabel([])).toBe('');
    expect(typingLabel(['Ada'])).toBe('Ada is typing…');
    expect(typingLabel(['Ada', 'Bo'])).toBe('Ada and Bo are typing…');
    expect(typingLabel(['Ada', 'Bo', 'Cam'])).toBe('Several people are typing…');
  });
});
