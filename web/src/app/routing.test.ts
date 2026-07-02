import { describe, expect, it } from 'vitest';
import { historyStateObject, initialView, isArtistPortalPath, isDotifyView, viewFromHistoryState } from './routing';

describe('isDotifyView', () => {
  it('accepts the four views and rejects anything else', () => {
    for (const view of ['listen', 'player', 'rooms', 'you']) {
      expect(isDotifyView(view)).toBe(true);
    }
    expect(isDotifyView('artists')).toBe(false);
    expect(isDotifyView(undefined)).toBe(false);
  });
});

describe('initialView', () => {
  it('opens Rooms for a share link, Now otherwise', () => {
    expect(initialView(true)).toBe('rooms');
    expect(initialView(false)).toBe('listen');
  });
});

describe('isArtistPortalPath', () => {
  it('matches /artists with or without a trailing slash', () => {
    expect(isArtistPortalPath('/artists')).toBe(true);
    expect(isArtistPortalPath('/artists/')).toBe(true);
    expect(isArtistPortalPath('/')).toBe(false);
    expect(isArtistPortalPath('/artistsx')).toBe(false);
  });
});

describe('historyStateObject', () => {
  it('returns the object as-is or an empty object for non-objects', () => {
    expect(historyStateObject({ dotifyView: 'player' })).toEqual({ dotifyView: 'player' });
    expect(historyStateObject(null)).toEqual({});
    expect(historyStateObject('nope')).toEqual({});
  });
});

describe('viewFromHistoryState', () => {
  it('uses a valid stored view, else the fallback', () => {
    expect(viewFromHistoryState({ dotifyView: 'you' }, 'listen')).toBe('you');
    expect(viewFromHistoryState({ dotifyView: 'artists' }, 'listen')).toBe('listen');
    expect(viewFromHistoryState(null, 'rooms')).toBe('rooms');
  });
});
