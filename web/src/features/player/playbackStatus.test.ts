import { describe, expect, it } from 'vitest';
import { listenerPlaybackStatusForHostState, playbackStatusLabel, transportProgressPercent, type AudioStatus } from './playbackStatus';

describe('playbackStatusLabel', () => {
  it('returns mode-neutral labels for transient states', () => {
    expect(playbackStatusLabel('preparing', 'host')).toBe('Preparing audio');
    expect(playbackStatusLabel('preparing', 'host', 'Receiving first audio bytes')).toBe('Receiving first audio bytes');
    expect(playbackStatusLabel('autoplay-blocked', 'listener')).toBe('Tap play to start');
    expect(playbackStatusLabel('joining', 'listener')).toBe('Joining live audio');
    expect(playbackStatusLabel('no-audio', 'host')).toBe('No audio available');
    expect(playbackStatusLabel('idle', 'host')).toBe('');
    expect(playbackStatusLabel('idle', 'host', 'Checking access')).toBe('Checking access');
  });

  it('phrases playing and ready differently for host vs listener', () => {
    expect(playbackStatusLabel('playing', 'host')).toBe('Playing');
    expect(playbackStatusLabel('playing', 'listener')).toBe('In sync');
    expect(playbackStatusLabel('ready', 'host')).toBe('Hosting');
    expect(playbackStatusLabel('ready', 'listener')).toBe('Connected');
  });

  it('falls back for an unknown status', () => {
    expect(playbackStatusLabel('weird' as AudioStatus, 'host')).toBe('Hosting');
    expect(playbackStatusLabel('weird' as AudioStatus, 'listener')).toBe('Ready');
  });
});

describe('transportProgressPercent', () => {
  it('computes a percentage of the duration', () => {
    expect(transportProgressPercent(30, 120)).toBe(25);
  });

  it('clamps to the 0-100 range', () => {
    expect(transportProgressPercent(-5, 100)).toBe(0);
    expect(transportProgressPercent(150, 100)).toBe(100);
  });

  it('is 0 when duration is zero or invalid', () => {
    expect(transportProgressPercent(10, 0)).toBe(0);
    expect(transportProgressPercent(10, Number.NaN)).toBe(0);
  });
});

describe('listenerPlaybackStatusForHostState', () => {
  it('keeps autoplay-blocked visible across host playback ticks', () => {
    expect(listenerPlaybackStatusForHostState('autoplay-blocked', true, true, false)).toBe('autoplay-blocked');
  });

  it('keeps no-audio visible until the listener retries the room audio', () => {
    expect(listenerPlaybackStatusForHostState('no-audio', true, true, false)).toBe('no-audio');
  });

  it('maps normal listener state from remote stream readiness and host playback', () => {
    expect(listenerPlaybackStatusForHostState('joining', false, true, false)).toBe('joining');
    expect(listenerPlaybackStatusForHostState('joining', true, true, false)).toBe('playing');
    expect(listenerPlaybackStatusForHostState('playing', true, true, true)).toBe('ready');
    expect(listenerPlaybackStatusForHostState('playing', true, false, false)).toBe('ready');
  });
});
