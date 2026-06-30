import { describe, expect, it } from 'vitest';
import { DEFAULT_TRACK_TITLE, buildDraftTrackInfo, nextTitleFromUpload, uploadStatusMessage, type DraftTrackInput } from './uploadModel';

describe('nextTitleFromUpload', () => {
  it('derives the title from the filename while still the placeholder', () => {
    expect(nextTitleFromUpload(DEFAULT_TRACK_TITLE, 'My Song.wav')).toBe('My Song');
  });

  it('keeps an artist-provided title', () => {
    expect(nextTitleFromUpload('Real Title', 'My Song.wav')).toBe('Real Title');
  });
});

describe('buildDraftTrackInfo', () => {
  const input: DraftTrackInput = {
    title: 'Draft',
    artist: 'Nova',
    hash: '0xabc',
    imageRef: 'data:image/svg+xml,cover',
    description: 'desc',
    accessMode: 'classic',
    priceDot: '0.5',
    personhoodLevel: 'DIM1'
  };

  it('builds a local draft TrackInfo with the classic price', () => {
    expect(buildDraftTrackInfo(input)).toMatchObject({
      title: 'Draft',
      artist: 'Nova',
      hash: '0xabc',
      bulletinRef: '',
      duration: 0,
      audioRef: 'dotify:local:0xabc',
      accessMode: 'classic',
      priceDot: '0.5',
      personhoodLevel: 'DIM1'
    });
  });

  it('zeroes the price for non-classic access and applies fallback title/artist', () => {
    const info = buildDraftTrackInfo({ ...input, title: '   ', artist: '', accessMode: 'human-free' });
    expect(info.title).toBe('Untitled');
    expect(info.artist).toBe('Unknown artist');
    expect(info.priceDot).toBe('0');
  });
});

describe('uploadStatusMessage', () => {
  it('returns audio phase messages', () => {
    expect(uploadStatusMessage('audio', 'preparing')).toBe('Hashing audio');
    expect(uploadStatusMessage('audio', 'uploaded')).toBe('Audio ready - protected and uploaded to IPFS');
    expect(uploadStatusMessage('audio', 'failed')).toBe('Audio ready (IPFS upload failed - will retry on register)');
  });

  it('returns cover phase messages', () => {
    expect(uploadStatusMessage('cover', 'preparing')).toBe('Preparing cover image');
    expect(uploadStatusMessage('cover', 'uploaded')).toBe('Cover ready - uploaded to IPFS');
  });
});
