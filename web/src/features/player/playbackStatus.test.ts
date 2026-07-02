import { describe, expect, it } from 'vitest';
import { playbackStatusLabel, transportProgressPercent, type AudioStatus } from './playbackStatus';

describe('playbackStatusLabel', () => {
  it('returns mode-neutral labels for transient states', () => {
    expect(playbackStatusLabel('preparing', 'host')).toBe('Preparing audio');
    expect(playbackStatusLabel('autoplay-blocked', 'listener')).toBe('Tap play to start');
    expect(playbackStatusLabel('joining', 'listener')).toBe('Joining live audio');
    expect(playbackStatusLabel('no-audio', 'host')).toBe('No audio available');
    expect(playbackStatusLabel('idle', 'host')).toBe('');
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
