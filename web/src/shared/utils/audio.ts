export function encodeAudioBufferPreviewAsWav(audioBuffer: AudioBuffer, frameCount: number) {
  const channelCount = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const bytesPerSample = 2;
  const dataSize = frameCount * channelCount * bytesPerSample;
  const bytes = new Uint8Array(44 + dataSize);
  const view = new DataView(bytes.buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channelCount * bytesPerSample, true);
  view.setUint16(32, channelCount * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[frame] ?? 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }

  return bytes;
}

// Mono variant of the preview encoder. Channels are averaged into one, which
// roughly halves the file size of the published preview asset (ticket 18)
// while staying dependency-free 16-bit PCM WAV.
export function encodeAudioBufferPreviewAsMonoWav(audioBuffer: AudioBuffer, frameCount: number) {
  const channelCount = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const bytesPerSample = 2;
  const dataSize = frameCount * bytesPerSample;
  const bytes = new Uint8Array(44 + dataSize);
  const view = new DataView(bytes.buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let channel = 0; channel < channelCount; channel += 1) {
    channels.push(audioBuffer.getChannelData(channel));
  }

  let offset = 44;
  for (let frame = 0; frame < frameCount; frame += 1) {
    let mixed = 0;
    for (let channel = 0; channel < channelCount; channel += 1) {
      mixed += channels[channel][frame] ?? 0;
    }
    const sample = Math.max(-1, Math.min(1, channelCount > 0 ? mixed / channelCount : 0));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += bytesPerSample;
  }

  return bytes;
}

type AudioContextCtor = typeof AudioContext;

// Decode raw encoded audio, keep the first `ratio` of its duration, and return
// a mono 16-bit PCM WAV. Used at publish time (ticket 18) to produce the
// separate, unencrypted preview asset from the artist's raw upload -- so an
// unauthorized listener/host can hear the preview without the full-track key,
// and without any content secret in the browser. The full track is still
// server-encrypted and wallet-gated.
export async function generateWavPreview(rawBytes: Uint8Array, ratio = 0.42): Promise<Uint8Array> {
  const Ctor: AudioContextCtor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!Ctor) throw new Error('Audio previews are not supported in this browser.');

  const audioContext = new Ctor();
  try {
    const data = rawBytes.buffer.slice(rawBytes.byteOffset, rawBytes.byteOffset + rawBytes.byteLength);
    const audioBuffer = await audioContext.decodeAudioData(data);
    const frameCount = Math.max(1, Math.floor(audioBuffer.length * ratio));
    return encodeAudioBufferPreviewAsMonoWav(audioBuffer, frameCount);
  } finally {
    await audioContext.close();
  }
}

export function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}
