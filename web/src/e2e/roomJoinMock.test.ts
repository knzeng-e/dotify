import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
async function fixture(search: string, enabled = true) {
  vi.resetModules();
  vi.stubEnv('VITE_E2E_ROOM_JOIN', enabled ? 'true' : 'false');
  vi.stubGlobal('window', { location: { search } });
  return import('./roomJoinMock');
}
function decode(url: string) {
  expect(url.startsWith('data:audio/wav;base64,')).toBe(true);
  const bytes = Buffer.from(url.split(',')[1], 'base64');
  expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
  expect(bytes.readUInt32LE(4)).toBe(bytes.length - 8);
  expect(bytes.toString('ascii', 8, 16)).toBe('WAVEfmt ');
  expect(bytes.readUInt16LE(20)).toBe(1); // PCM, not a mislabeled placeholder.
  expect(bytes.readUInt16LE(22)).toBe(1);
  expect(bytes.readUInt16LE(34)).toBe(8);
  expect(bytes.readUInt32LE(40)).toBe(bytes.length - 44);
  return { bytes, rate: bytes.readUInt32LE(24), samples: bytes.subarray(44) };
}
function signal(samples: Buffer, rate: number) {
  let squares = 0,
    crossings = 0;
  for (let i = 0; i < samples.length; i++) {
    squares += ((samples[i] - 128) / 128) ** 2;
    if (i && samples[i - 1] <= 128 && samples[i] > 128) crossings++;
  }
  return { rms: Math.sqrt(squares / samples.length), frequency: (crossings * rate) / samples.length };
}

it('native capture gets real 60-second 48-kHz 440/660-Hz waveforms', async () => {
  const f = await fixture('?e2eSync=on&e2eCapture=web-audio&e2eCatalog=sequence');
  const tracks = f.getRoomJoinE2eTracks();
  for (const [index, frequency] of [
    [1, 440],
    [2, 660]
  ]) {
    const { rate, samples, bytes } = decode(tracks[index].localUrl!);
    expect(rate).toBe(48000);
    expect(bytes.readUInt32LE(28)).toBe(rate); // Eight-bit mono byte rate.
    expect(samples.length / rate).toBe(60);
    const observed = signal(samples, rate);
    expect(observed.rms).toBeGreaterThan(0.17);
    expect(observed.rms).toBeLessThan(0.185);
    expect(observed.frequency).toBeCloseTo(frequency, 0);
  }
  expect(tracks[0].localUrl).toBe(tracks[1].localUrl);
});

it('non-capture synchronized fixtures keep their smaller 8-kHz format and duration', async () => {
  const f = await fixture('?e2eSync=on&e2eCatalog=sequence');
  const { rate, samples } = decode(f.E2E_ROOM_PUBLIC_AUDIO_URL);
  expect(rate).toBe(8000);
  expect(samples.length / rate).toBe(60);
  expect(signal(samples, rate).frequency).toBeCloseTo(440, 0);
});

it('ordinary fixtures retain the two-second silent and near-silent sources', async () => {
  const f = await fixture('?e2eCapture=web-audio');
  const normal = decode(f.E2E_ROOM_PUBLIC_AUDIO_URL);
  const protectedTrack = decode(f.E2E_ROOM_PROTECTED_AUDIO_URL);
  expect(normal.rate).toBe(8000);
  expect(normal.samples.length / normal.rate).toBe(2);
  expect(normal.samples.every(sample => sample === 128)).toBe(true);
  expect(protectedTrack.samples.every(sample => sample === 129)).toBe(true);
});

it('production-disabled E2E cannot enable the large native fixture through query parameters', async () => {
  const f = await fixture('?e2eSync=on&e2eCapture=web-audio', false);
  const { rate, samples } = decode(f.E2E_ROOM_PUBLIC_AUDIO_URL);
  expect(rate).toBe(8000);
  expect(samples.length / rate).toBe(2);
  expect(samples.every(sample => sample === 128)).toBe(true);
});
