import { describe, expect, it } from 'vitest';
import { encodeAudioBufferPreviewAsMonoWav } from './audio';

// Minimal AudioBuffer stand-in: only the fields the encoder reads.
function fakeAudioBuffer(channels: number[][], sampleRate = 44100): AudioBuffer {
  return {
    numberOfChannels: channels.length,
    sampleRate,
    length: channels[0]?.length ?? 0,
    getChannelData: (channel: number) => Float32Array.from(channels[channel])
  } as unknown as AudioBuffer;
}

function readAscii(view: DataView, offset: number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) out += String.fromCharCode(view.getUint8(offset + i));
  return out;
}

describe('encodeAudioBufferPreviewAsMonoWav', () => {
  it('writes a single-channel 16-bit PCM WAV header for the requested frame count', () => {
    const buffer = fakeAudioBuffer([
      [1, -1, 0.5, 0.25],
      [1, -1, 0.5, 0.25]
    ]);
    // Take the first 2 of 4 frames (a 50% preview slice).
    const wav = encodeAudioBufferPreviewAsMonoWav(buffer, 2);
    const view = new DataView(wav.buffer);

    expect(readAscii(view, 0, 4)).toBe('RIFF');
    expect(readAscii(view, 8, 4)).toBe('WAVE');
    expect(view.getUint16(22, true)).toBe(1); // mono, not the source channel count
    expect(view.getUint32(24, true)).toBe(44100);
    // 44-byte header + 2 frames * 1 channel * 2 bytes = 48 bytes total.
    expect(wav.length).toBe(48);
    expect(view.getUint32(40, true)).toBe(4); // data chunk size
  });

  it('averages source channels into the single mono channel', () => {
    // Left 1.0, right 0.0 -> mono 0.5 -> 0.5 * 0x7fff.
    const buffer = fakeAudioBuffer([[1], [0]]);
    const wav = encodeAudioBufferPreviewAsMonoWav(buffer, 1);
    const view = new DataView(wav.buffer);
    expect(view.getInt16(44, true)).toBe(Math.trunc(0.5 * 0x7fff));
  });
});
