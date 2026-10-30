// Deterministic public synthetic audio only. No files, keys or network access.
import assert from 'node:assert/strict';
export function generatedWav(seconds = 8) {
  assert.ok(seconds === 8 || seconds === 64, 'Only the fixed generated research durations are allowed');
  const rate = 16_000,
    samples = rate * seconds;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF');
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) {
    const t = i / rate;
    const envelope = Math.min(1, t / 0.1, (seconds - t) / 0.2);
    const chord = [220, 277.18, 329.63].reduce((sum, hz) => sum + Math.sin(2 * Math.PI * hz * t), 0) / 3;
    wav.writeInt16LE(Math.round(chord * envelope * 4000), 44 + i * 2);
  }
  return wav;
}
