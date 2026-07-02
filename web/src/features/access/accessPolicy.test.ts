import { describe, expect, it } from 'vitest';
import type { CatalogTrack } from '../../shared/types';
import { isPolicyManagedTrack, playbackModeForAccess, trackHasAccess, trackNeedsAccess } from './accessPolicy';

type TrackShape = Pick<CatalogTrack, 'source' | 'id'>;

const managed: TrackShape = { source: 'artist', id: '0xRuntime:0xHash' };
const freeLocal: TrackShape = { source: 'artist', id: 'draft-upload' };
const nonArtist: TrackShape = { source: 'seed', id: '0xRuntime:0xHash' };

describe('isPolicyManagedTrack', () => {
  it('is true only for artist tracks with a runtime-qualified id', () => {
    expect(isPolicyManagedTrack(managed)).toBe(true);
  });

  it('is false for artist tracks without a runtime id', () => {
    expect(isPolicyManagedTrack(freeLocal)).toBe(false);
  });

  it('is false for non-artist sources even with a colon id', () => {
    expect(isPolicyManagedTrack(nonArtist)).toBe(false);
  });
});

describe('trackHasAccess', () => {
  it('always grants non-policy-managed tracks', () => {
    expect(trackHasAccess(freeLocal, {})).toBe(true);
    expect(trackHasAccess(nonArtist, {})).toBe(true);
  });

  it('grants a policy-managed track only with an explicit true entry', () => {
    expect(trackHasAccess(managed, {})).toBe(false);
    expect(trackHasAccess(managed, { [managed.id]: false })).toBe(false);
    expect(trackHasAccess(managed, { [managed.id]: true })).toBe(true);
  });
});

describe('trackNeedsAccess', () => {
  it('needs access only for a policy-managed track without access', () => {
    expect(trackNeedsAccess(managed, false)).toBe(true);
    expect(trackNeedsAccess(managed, true)).toBe(false);
    expect(trackNeedsAccess(freeLocal, false)).toBe(false);
  });
});

describe('playbackModeForAccess', () => {
  it('maps access to full and denial to preview', () => {
    expect(playbackModeForAccess(true)).toBe('full');
    expect(playbackModeForAccess(false)).toBe('preview');
  });
});
