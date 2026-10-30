import { queryBytes } from '@parity/product-sdk/cloud-storage';
import { isInsideContainer } from '@parity/product-sdk/host';
import { readPath, hostBlockReader } from '../reader.mjs';
import { createStreamingPlayback } from '../../../web/src/features/catalog/streamingPlayback';
import { configureStreamingAudioElement, streamingMediaSource } from '../../../web/src/features/catalog/streamingMediaSource';
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const audio = element<HTMLAudioElement>('audio');
const start = element<HTMLButtonElement>('play');
const stop = element<HTMLButtonElement>('stop');
const status = element('status');
const output = element('report');
const download = element<HTMLButtonElement>('export');
const heard = element<HTMLInputElement>('heard');
let controller: AbortController | undefined;
let report: Record<string, any> | undefined;
let mediaUrl: string | undefined;
function display() { if (report) output.textContent = JSON.stringify(report, null, 2); }
function cleanup() {
  controller?.abort(); controller = undefined;
  audio.pause(); audio.removeAttribute('src'); audio.load();
  if (mediaUrl) URL.revokeObjectURL(mediaUrl);
  mediaUrl = undefined; start.disabled = false; stop.disabled = true;
}
function fail(error: unknown, attempt: Record<string, any>) {
  if (report !== attempt || attempt.outcome === 'failed') return;
  attempt.outcome = 'failed'; attempt.error = String(error instanceof Error ? error.message : error).slice(0, 400);
  status.textContent = `Test stopped: ${attempt.error}`; cleanup(); display();
}
start.onclick = async () => {
  cleanup(); heard.checked = false;
  const mode = element<HTMLSelectElement>('transport').value;
  const attempt = report = {
    schema: 'dotify.bulletin.host-report.v1', startedAt: new Date().toISOString(),
    base: '5b6ddec51ba4dfdc2383d7afbaf17996dfdda1a6', transport: mode === 'native' ? 'native-preimage' : 'local-control',
    environment: element<HTMLInputElement>('environment').value.slice(0, 240),
    network: element<HTMLInputElement>('network').value.slice(0, 160), userAgent: navigator.userAgent,
    reader: streamingMediaSource()?.kind ?? 'full-rendition-blob', hostCache: 'unknown; not cleared',
    pageCache: 'empty per attempt', audibleFirstSoundMeasured: false, operatorHeardAudio: false,
    productionAccessTested: false, outcome: 'preparing', reads: [], events: [], metrics: []
  };
  const control = controller = new AbortController();
  start.disabled = true; stop.disabled = false; download.disabled = false;
  status.textContent = 'Reading and authenticating the first audio objects…';
  const began = performance.now();
  const listeners = new AbortController();
  control.signal.addEventListener('abort', () => listeners.abort(), { once: true });
  for (const name of ['playing', 'waiting', 'stalled', 'seeking', 'seeked', 'ended', 'error']) {
    audio.addEventListener(name, () => {
      if (report !== attempt || control.signal.aborted) return;
      attempt.events.push({ name, elapsedMs: Math.round(performance.now() - began), mediaSeconds: audio.currentTime });
      if (name === 'playing') {
        attempt.firstPlayingEventMs ??= Math.round(performance.now() - began);
        attempt.outcome = 'playing'; status.textContent = 'Playing the generated chord.';
      }
      if (name === 'ended') { attempt.outcome = 'ended'; status.textContent = `Clip finished at ${audio.currentTime.toFixed(2)} s. First playing event: ${attempt.firstPlayingEventMs} ms. ${attempt.reads.length} raw reads. Audibility needs operator confirmation.`; cleanup(); }
      if (name === 'error') fail(new Error('Media element failed to decode or play'), attempt);
      display();
    }, { signal: listeners.signal });
  }
  const wholeAttempt = setTimeout(() => fail(new Error('Clip did not finish within 60 seconds'), attempt), 60_000);
  control.signal.addEventListener('abort', () => clearTimeout(wholeAttempt), { once: true });
  const deadline = setTimeout(() => fail(new Error('No first playing event within 45 seconds'), attempt), 45_000);
  control.signal.addEventListener('abort', () => clearTimeout(deadline), { once: true });
  audio.addEventListener('playing', () => clearTimeout(deadline), { once: true, signal: listeners.signal });
  let key: Uint8Array | undefined;
  let session: any;
  try {
    const response = await fetch('/canary/session', { signal: control.signal, credentials: 'omit', cache: 'no-store' });
    if (!response.ok) throw new Error('Local generated fixture unavailable');
    session = await response.json();
    if (session.schema !== 'dotify.bulletin.host-canary.v1' || session.audioProof?.kind !== 'generated-chord-aac-v1') throw new Error('Unexpected test fixture');
    key = Uint8Array.from(session.key);
    attempt.root = session.root; attempt.audioProof = session.audioProof; attempt.implementation = session.implementation;
    if (mode === 'native') {
      attempt.insideHost = await isInsideContainer();
      if (!attempt.insideHost) { key.fill(0); throw new Error('Native mode needs Polkadot Desktop/mobile. Select local control for a browser test.'); }
    }
    const native = hostBlockReader({ fetchBytes: queryBytes });
    const cache = new Map<string, Uint8Array>();
    const readBlock = async (cid: string) => {
      control.signal.throwIfAborted();
      if (session.archiveRawCids.includes(cid)) throw new Error('Playback tried to fetch the archival master');
      if (cache.has(cid)) return cache.get(cid)!;
      const readStart = performance.now();
      const bytes = mode === 'native' ? await native(cid) : await (async () => {
        const r = await fetch(`/canary/block/${cid}`, { signal: control.signal, credentials: 'omit', cache: 'no-store' });
        if (!r.ok) throw new Error('Local control block unavailable');
        return new Uint8Array(await r.arrayBuffer());
      })();
      control.signal.throwIfAborted();
      attempt.reads.push({ cid, bytes: bytes.length, elapsedMs: Math.round(performance.now() - readStart) });
      cache.set(cid, bytes); return bytes;
    };
    try {
      const playback = await createStreamingPlayback({
        cid: session.root, scope: session.scope, key, signal: control.signal, audio: () => audio,
        onError: error => fail(error, attempt), bufferAheadSeconds: () => 30,
        fetchObject: async (cid, path, maxBytes, signal, observe) => {
          signal.throwIfAborted();
          if (!/^(manifest\.json|(?:96|160|320)\/(init|segment-[0-9]{3})\.bin)$/.test(path)) throw new Error('Playback path refused');
          const { bytes } = await readPath(readBlock, cid, path, { maxBytes: maxBytes + 64 * 1024 });
          if (bytes.length > maxBytes || path !== 'manifest.json' && bytes.length !== maxBytes) throw new Error('Incomplete object');
          observe?.({ fromCache: false }); return bytes;
        },
        onMetric: metric => { if (attempt.metrics.length < 100) attempt.metrics.push({ ...metric, elapsedMs: Math.round(performance.now() - began) }); display(); }
      });
      control.signal.throwIfAborted();
      mediaUrl = playback.url; attempt.progressive = playback.progressive;
      audio.volume = 0.25; configureStreamingAudioElement(audio, playback.url);
      audio.src = playback.url; audio.load();
      await audio.play();
      // A resolved play promise does not assert physical audibility.
      display();
    } finally { key.fill(0); }
  } catch (error) { if (!control.signal.aborted) fail(error, attempt); }
  finally { key?.fill(0); if (session) session.key = []; }
};
stop.onclick = () => { if (report && report.outcome !== 'failed') report.outcome = 'stopped'; cleanup(); status.textContent = 'Stopped.'; display(); };
heard.onchange = () => { if (report) report.operatorHeardAudio = heard.checked; display(); };
download.onclick = () => {
  if (!report) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `bulletin-audio-${Date.now()}.json`; link.click(); URL.revokeObjectURL(url);
};
window.addEventListener('pagehide', cleanup);
