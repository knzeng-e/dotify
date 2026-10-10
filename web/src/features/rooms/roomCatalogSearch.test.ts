import { describe, expect, it } from 'vitest';
import type { CatalogTrack } from '../../shared/types';
import { resolveRequestedTrack, roomTrackRequestText, searchRoomCatalog } from './roomCatalogSearch';
import { updateChatUnread } from './chatUnread';

const track = (id: string, title = 'Mon cerveau', artist = 'Lord Ékomy Ndong'): CatalogTrack => ({ id, title, artist, active: true }) as CatalogTrack;

describe('room catalog suggestions', () => {
  it('matches accent-insensitive title and artist terms and excludes unavailable releases', () => {
    const tracks = [track('one'), { ...track('two'), active: false }, track('three', 'Other', 'Someone')];
    expect(searchRoomCatalog(tracks, 'cerveau ekomy').map(item => item.id)).toEqual(['one']);
    expect(searchRoomCatalog(tracks, 'missing')).toEqual([]);
  });
  it('resolves bounded request text only when one active release matches', () => {
    const one = track('one', 'A'.repeat(150));
    expect(roomTrackRequestText(one).length).toBeLessThanOrEqual(120);
    expect(resolveRequestedTrack([one], roomTrackRequestText(one))).toBe(one);
    expect(resolveRequestedTrack([one, { ...one, id: 'duplicate' }], roomTrackRequestText(one))).toBeNull();
    expect(resolveRequestedTrack([one], 'an old freeform suggestion')).toBeNull();
  });
  it('keeps selected request identity after signaling normalizes catalog whitespace', () => {
    const one = track('one', 'Mon\n  cerveau', 'Lord\tÉkomy');
    expect(roomTrackRequestText(one)).toBe('Mon cerveau — Lord Ékomy');
    expect(resolveRequestedTrack([one], 'Mon cerveau — Lord Ékomy')).toBe(one);
  });
});

describe('room unread messages', () => {
  it('ignores initial history, own messages and repeated snapshots, and clears on reading', () => {
    const initial = [{ id: 'old', senderId: 'guest' }];
    const state = updateChatUnread(null, initial, 'self', false);
    expect(state.unread).toBe(0);
    const messages = [...initial, { id: 'own', senderId: 'self' }, { id: 'one', senderId: 'guest' }, { id: 'two', senderId: 'guest' }];
    const unread = updateChatUnread(state, messages, 'self', false);
    expect(unread.unread).toBe(2);
    expect(updateChatUnread(unread, messages, 'self', false).unread).toBe(2);
    expect(updateChatUnread(unread, messages, 'self', true).unread).toBe(0);
  });
  it('counts arrivals as the history window rolls and bounds retained ids', () => {
    const messages = Array.from({ length: 600 }, (_, index) => ({ id: String(index), senderId: 'guest' }));
    const state = updateChatUnread(null, messages.slice(0, 50), 'self', false);
    const unread = updateChatUnread(state, messages.slice(1, 51), 'self', false);
    expect(unread.unread).toBe(1);
    expect(updateChatUnread(unread, messages, 'self', false).seen.length).toBe(500);
  });
});
