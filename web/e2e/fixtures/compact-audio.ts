import { createStreamingPlayback, fetchStreamingObject, type StreamingTransportOptions } from '../../src/features/catalog/streamingPlayback';
import { bulletinHostMediaDeps } from '../../src/features/catalog/bulletinHostMedia';
import { prepareHostCompactMedia } from '../../src/features/catalog/bulletinCompactMedia';
import { readStreamingManifest, decryptStreamingMedia } from '../../src/features/catalog/streamingFormat';
import { compatibilityMp4 } from '../../src/features/catalog/compatibilityMp4';
import { registerAudioGain, forgetAudioGain, attachAudioNormalization, normalizedAudioCapture } from '../../src/features/player/audioNormalization';
import { resumeHostAudioOutput, releaseHostAudioOutput } from '../../src/features/player/hostAudioOutput';
import { audioOutputObservations } from '../../src/features/player/audioOutputLifecycle';
import type { StreamingScope } from '../../src/features/catalog/streamingFormat';

type Layout = 'standard' | 'compact';
type ReaderMetric = Parameters<NonNullable<Parameters<typeof createStreamingPlayback>[0]['onMetric']>>[0];
type Fixture = {
  mode: 'web' | 'host';
  keyHex: string;
  scope: StreamingScope;
  blocks: Record<string, string>; // Playback-reachable ciphertext only, no archive.
  graphs: Record<Layout, { root: string; ref: string }>;
};
const fixture: Fixture = Reflect.get(window, '__codecFixture');
const decode = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0));
const audio = document.querySelector('audio')!;
const nativeCalls: string[] = [];
const metrics: ReaderMetric[] = [];
const errors: string[] = [];
bulletinHostMediaDeps.insideHost = () => fixture.mode === 'host';
bulletinHostMediaDeps.queryBytes = async cid => {
  nativeCalls.push(cid);
  if (!fixture.blocks[cid]) throw new Error('Synthetic playback dependency missing');
  return { ok: true, value: decode(fixture.blocks[cid]) };
};
let owner: AbortController | undefined;
let url: string | undefined;
let progressive = false;
let startedAt = 0;
let firstSignalMs: number | null = null;
let probe: AudioContext | undefined;
let analyser: AnalyserNode | undefined;
let samples: Float32Array | undefined;
const peers: RTCPeerConnection[] = [];
let guestContext: AudioContext | undefined;
let guestAnalyser: AnalyserNode | undefined;
let guestAudio: HTMLAudioElement | undefined;
async function stop() {
  owner?.abort();
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  await probe?.close();
  probe = undefined;
  analyser = undefined;
  samples = undefined;
  if (url) {
    forgetAudioGain(url);
    URL.revokeObjectURL(url);
  }
  url = undefined;
}
async function start(layout: Layout, compatibility = false, ahead = 4) {
  await stop();
  metrics.length = 0;
  errors.length = 0;
  firstSignalMs = null;
  startedAt = performance.now();
  owner = new AbortController();
  const graph = fixture.graphs[layout];
  if (compatibility) {
    Object.defineProperty(window, 'MediaSource', { configurable: true, value: undefined });
    Object.defineProperty(window, 'ManagedMediaSource', { configurable: true, value: undefined });
  }
  const prepared = await createStreamingPlayback({
    cid: graph.root,
    audioRef: graph.ref,
    scope: fixture.scope,
    key: Uint8Array.from(fixture.keyHex.match(/../g)!, value => parseInt(value, 16)),
    signal: owner.signal,
    audio: () => audio,
    forRoomCapture: compatibility,
    bufferAheadSeconds: () => ahead,
    onError: error => errors.push(String(error)),
    onMetric: metric => metrics.push(metric)
    // No custom fetchObject: exercise ordinary Web/native dispatch.
  });
  url = prepared.url;
  progressive = prepared.progressive;
  audio.disableRemotePlayback = true;
  registerAudioGain(url, prepared.gainDb);
  audio.src = url;
  attachAudioNormalization(audio);
  if (!probe) {
    const capture = normalizedAudioCapture(audio);
    if (!capture) throw new Error('Real normalized capture unavailable');
    probe = new AudioContext();
    analyser = probe.createAnalyser();
    const silent = probe.createGain();
    silent.gain.value = 0;
    probe.createMediaStreamSource(capture.stream).connect(analyser).connect(silent).connect(probe.destination);
    samples = new Float32Array(analyser.fftSize);
  }
  return { progressive };
}
function power(meter = analyser) {
  if (!meter || !samples) return 0;
  meter.getFloatTimeDomainData(samples);
  const rms = Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length);
  if (rms > 0.01 && firstSignalMs === null) firstSignalMs = performance.now() - startedAt;
  return rms;
}
async function connectGuest() {
  const capture = normalizedAudioCapture(audio);
  if (!capture) throw new Error('Room capture unavailable');
  const sender = new RTCPeerConnection({ iceServers: [] });
  const receiver = new RTCPeerConnection({ iceServers: [] });
  peers.push(sender, receiver);
  guestContext = new AudioContext();
  guestAnalyser = guestContext.createAnalyser();
  const silent = guestContext.createGain();
  silent.gain.value = 0;
  guestAnalyser.connect(silent).connect(guestContext.destination);
  guestAudio = document.createElement('audio');
  // Start real receiver playout as the Room's PersistentAudio does. The meter
  // reads the received stream; muting this duplicate avoids two local outputs.
  guestAudio.muted = true;
  document.body.append(guestAudio);
  receiver.ontrack = event => {
    guestAudio!.srcObject = event.streams[0];
    guestContext!.createMediaStreamSource(event.streams[0]).connect(guestAnalyser!);
  };
  capture.stream.getAudioTracks().forEach(track => sender.addTrack(track, capture.stream));
  const gathered = (peer: RTCPeerConnection) =>
    new Promise<void>(resolve => {
      if (peer.iceGatheringState === 'complete') return resolve();
      peer.addEventListener('icegatheringstatechange', () => {
        if (peer.iceGatheringState === 'complete') resolve();
      });
    });
  await sender.setLocalDescription(await sender.createOffer());
  await gathered(sender);
  await receiver.setRemoteDescription(sender.localDescription!);
  await receiver.setLocalDescription(await receiver.createAnswer());
  await gathered(receiver);
  await sender.setRemoteDescription(receiver.localDescription!);
}
async function decodeQualities() {
  const graph = fixture.graphs.compact;
  const signal = new AbortController().signal;
  const key = Uint8Array.from(fixture.keyHex.match(/../g)!, value => parseInt(value, 16));
  const transport: StreamingTransportOptions = { layout: 'rendition-pack-v1' };
  const read = (name: string, max: number) => fetchStreamingObject(graph.root, name, max, signal, undefined, true, transport);
  const manifest = await read('manifest.json', 256 * 1024);
  const context = await readStreamingManifest(manifest, key, fixture.scope);
  if (fixture.mode === 'host')
    transport.compactRead = (await prepareHostCompactMedia({ root: graph.root, manifestBytes: manifest, key, scope: fixture.scope, signal })).read;
  const decoder = new AudioContext();
  const result: Array<{ bitrate: number; seconds: number; rms: number }> = [];
  try {
    for (const rendition of context.manifest.renditions) {
      const parts: Uint8Array[] = [];
      for (const object of [rendition.init, ...rendition.segments])
        parts.push(await decryptStreamingMedia(context, object, await read(object.path, object.encryptedLength)));
      const complete = await new Blob(compatibilityMp4(parts)).arrayBuffer();
      const decoded = await decoder.decodeAudioData(complete);
      const pcm = decoded.getChannelData(0);
      result.push({ bitrate: rendition.bitrateKbps, seconds: decoded.duration, rms: Math.sqrt(pcm.reduce((sum, x) => sum + x * x, 0) / pcm.length) });
      parts.forEach(part => part.fill(0));
    }
    return result;
  } finally {
    key.fill(0);
    await decoder.close();
  }
}
document.querySelector<HTMLButtonElement>('#play')!.onclick = () => {
  const selection = owner;
  void Promise.all([resumeHostAudioOutput(audio), probe?.resume(), guestContext?.resume(), audio.play(), guestAudio?.play()]).catch(error => {
    if (selection === owner && !selection?.signal.aborted) errors.push(String(error));
  });
};
export const harness = {
  start,
  stop,
  connectGuest,
  decodeQualities,
  rtcStats: async () =>
    Promise.all(
      peers.map(async peer =>
        [...(await peer.getStats()).values()]
          .filter(row => ['inbound-rtp', 'outbound-rtp', 'media-source'].includes(row.type))
          .map(row => ({ type: row.type, energy: row.totalAudioEnergy, level: row.audioLevel, sent: row.packetsSent, received: row.packetsReceived }))
      )
    ),
  power,
  guestPower: () => power(guestAnalyser),
  seek: (seconds: number) => {
    audio.currentTime = seconds;
  },
  snapshot: () => ({
    nativeCalls,
    metrics,
    errors,
    progressive,
    firstSignalMs,
    currentTime: audio.currentTime,
    paused: audio.paused,
    ended: audio.ended,
    mediaError: audio.error?.message ?? null,
    duration: audio.duration,
    liveCaptureTracks:
      normalizedAudioCapture(audio)
        ?.stream.getAudioTracks()
        .filter(t => t.readyState === 'live').length ?? 0,
    peers: peers.map(peer => ({ connection: peer.connectionState, ice: peer.iceConnectionState })),
    // Distinguish the normalization/source context from this downstream probe.
    // Both clocks can run while one graph emits no measurable samples.
    sourceOutput: audioOutputObservations(),
    probeState: probe?.state ?? null,
    guestState: guestContext?.state ?? null,
    guestPlaying: guestAudio ? !guestAudio.paused : null
  }),
  dispose: async () => {
    await stop();
    releaseHostAudioOutput(audio);
    peers.forEach(peer => peer.close());
    guestAudio?.remove();
    await guestContext?.close();
  }
};
Reflect.set(window, '__compactAudio', harness);
