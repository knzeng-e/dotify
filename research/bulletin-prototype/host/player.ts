import { queryBytes } from '@parity/product-sdk/cloud-storage';
import { createClient } from 'polkadot-api';
import { fixtureProfile } from '../fixture-profile.mjs';
import { finalizationPolicy, finalizationProducer } from './finalization';
import { nativeRpcReader, NATIVE_GENESIS, bounded } from '../native-rpc.mjs';
import { isInsideContainer, getHostProvider } from '@parity/product-sdk/host';
import { readPath, hostBlockReader } from '../reader.mjs';
import { createStreamingPlayback } from '../../../web/src/features/catalog/streamingPlayback';
import { configureStreamingAudioElement, streamingMediaSource } from '../../../web/src/features/catalog/streamingMediaSource';
// One playback controller for the loopback harness and standalone generated-only Product.
export type PlayerOptions = {
  loadSession: (signal: AbortSignal) => Promise<any>;
  readControlBlock: (cid: string, signal: AbortSignal) => Promise<Uint8Array>;
  controlTransport?: string;
  profile?: string;
  onReport?: (report: Record<string, any>) => void;
};
export function mountPlayer(options: PlayerOptions) {
  const profile = fixtureProfile(options.profile);
  const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const audio = element<HTMLAudioElement>('audio');
  const start = element<HTMLButtonElement>('play');
  const stop = element<HTMLButtonElement>('stop');
  const status = element('status');
  const output = element('report');
  const download = element<HTMLButtonElement>('export');
  const heard = element<HTMLInputElement>('heard');
  const networkMarker = element<HTMLButtonElement>('mark-network');
  const cutMarker = element<HTMLButtonElement>('mark-cut');
  const finishSelector = element<HTMLSelectElement>('finish-policy');
  let began = 0;
  let controller: AbortController | undefined;
  let report: Record<string, any> | undefined;
  let mediaUrl: string | undefined;
  let nativeClient: ReturnType<typeof createClient> | undefined;
  function display() {
    if (report) {
      output.textContent = JSON.stringify(report, null, 2);
      try {
        options.onReport?.(report);
      } catch {
        /* Evidence storage must never break audio cleanup. */
      }
    }
  }
  function cleanup() {
    controller?.abort();
    controller = undefined;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    mediaUrl = undefined;
    nativeClient?.destroy();
    nativeClient = undefined;
    start.disabled = false;
    stop.disabled = true;
    if (networkMarker) networkMarker.disabled = true;
    if (cutMarker) cutMarker.disabled = true;
    if (finishSelector) finishSelector.disabled = false;
  }
  function fail(error: unknown, attempt: Record<string, any>) {
    if (report !== attempt || attempt.outcome === 'failed') return;
    attempt.outcome = 'failed';
    attempt.error = String(error instanceof Error ? error.message : error).slice(0, 400);
    attempt.errorName = error instanceof Error ? error.name : 'UnknownError';
    status.textContent = `Test stopped: ${attempt.error}`;
    cleanup();
    display();
  }
  start.onclick = async () => {
    cleanup();
    heard.checked = false;
    const mode = element<HTMLSelectElement>('transport').value;
    // Only the 64-second diagnostic exposes the alternate timing.
    const finishPolicy = finalizationPolicy(profile.id === 'continuity' ? finishSelector?.value : undefined);
    const attempt: Record<string, any> = (report = {
      schema: 'dotify.bulletin.host-report.v1',
      fixtureProfile: profile.id,
      fixtureDurationSeconds: profile.durationSeconds,
      attemptLimitMs: profile.attemptLimitMs,
      firstPlayingLimitMs: profile.firstPlayingLimitMs,
      id: crypto.randomUUID(),
      startedAt: new Date().toISOString(),
      transport: mode === 'native' ? 'native-preimage' : mode === 'rpc' ? 'native-chain-rpc' : (options.controlTransport ?? 'local-control'),
      environment: element<HTMLInputElement>('environment').value.slice(0, 240),
      network: element<HTMLInputElement>('network').value.slice(0, 160),
      userAgent: navigator.userAgent,
      reader: streamingMediaSource()?.kind ?? 'full-rendition-blob',
      finalizationPolicy: finishPolicy,
      finalizationExperimentApplied: false,
      hostCache: 'unknown; not cleared',
      pageCache: 'empty per attempt',
      audibleFirstSoundMeasured: false,
      operatorHeardAudio: false,
      lookupTimeoutMs: mode === 'native' ? Number(element<HTMLSelectElement>('lookup').value) : mode === 'rpc' ? 10_000 : null,
      productionAccessTested: false,
      outcome: 'preparing',
      reads: [],
      events: [],
      metrics: []
    });
    const control = (controller = new AbortController());
    start.disabled = true;
    stop.disabled = false;
    if (networkMarker) networkMarker.disabled = false;
    if (cutMarker) cutMarker.disabled = false;
    if (finishSelector) finishSelector.disabled = true;
    download.disabled = false;
    status.textContent = 'Reading and authenticating the first audio objects…';
    began = performance.now();
    const listeners = new AbortController();
    control.signal.addEventListener('abort', () => listeners.abort(), { once: true });
    for (const name of ['playing', 'pause', 'waiting', 'stalled', 'seeking', 'seeked', 'ended', 'error', 'durationchange']) {
      audio.addEventListener(
        name,
        () => {
          if (report !== attempt || control.signal.aborted) return;
          if (attempt.events.length < 200)
            attempt.events.push({
              name,
              elapsedMs: Math.round(performance.now() - began),
              mediaSeconds: audio.currentTime,
              ...(name === 'durationchange' && Number.isFinite(audio.duration) ? { durationSeconds: audio.duration } : {})
            });
          if (name === 'playing') {
            attempt.firstPlayingEventMs ??= Math.round(performance.now() - began);
            attempt.outcome = 'playing';
            status.textContent = 'Playing the generated chord.';
          }
          if (name === 'ended') {
            attempt.outcome = 'ended';
            status.textContent = `Clip finished at ${audio.currentTime.toFixed(2)} s. First playing event: ${attempt.firstPlayingEventMs} ms. ${attempt.reads.length} raw reads. Audibility needs operator confirmation.`;
            cleanup();
          }
          if (name === 'error') fail(new Error('Media element failed to decode or play'), attempt);
          display();
        },
        { signal: listeners.signal }
      );
    }
    let lastProgress = -4;
    audio.addEventListener(
      'timeupdate',
      () => {
        if (report !== attempt || control.signal.aborted || attempt.firstPlayingEventMs == null || attempt.events.length >= 200) return;
        if (audio.currentTime < lastProgress || audio.currentTime >= lastProgress + 4) {
          lastProgress = audio.currentTime;
          const bufferedUntilMediaSeconds = audio.buffered.length ? audio.buffered.end(audio.buffered.length - 1) : 0;
          attempt.events.push({
            name: 'progress',
            elapsedMs: Math.round(performance.now() - began),
            mediaSeconds: audio.currentTime,
            bufferedUntilMediaSeconds
          });
          display();
        }
      },
      { signal: listeners.signal }
    );
    display();
    const wholeAttempt = setTimeout(
      () => fail(new Error(`Clip did not finish within ${profile.attemptLimitMs / 1000} seconds`), attempt),
      profile.attemptLimitMs
    );
    control.signal.addEventListener('abort', () => clearTimeout(wholeAttempt), { once: true });
    const deadline = setTimeout(() => fail(new Error('No first playing event within 45 seconds'), attempt), profile.firstPlayingLimitMs);
    control.signal.addEventListener('abort', () => clearTimeout(deadline), { once: true });
    audio.addEventListener('playing', () => clearTimeout(deadline), { once: true, signal: listeners.signal });
    let key: Uint8Array | undefined;
    let session: any;
    try {
      session = await options.loadSession(control.signal);
      control.signal.throwIfAborted();
      if (
        session.schema !== 'dotify.bulletin.host-canary.v1' ||
        session.audioProof?.kind !== profile.kind ||
        session.audioProof?.durationSeconds !== profile.durationSeconds ||
        (session.fixtureProfile ?? 'short') !== profile.id
      )
        throw new Error('Unexpected test fixture');
      key = Uint8Array.from(session.key);
      attempt.root = session.root;
      attempt.audioProof = session.audioProof;
      attempt.implementation = session.implementation;
      if (mode !== 'local') {
        attempt.insideHost = await bounded(isInsideContainer(), control.signal);
        if (!attempt.insideHost) {
          key.fill(0);
          throw new Error('Native mode needs Polkadot Desktop/mobile. Select local control for a browser test.');
        }
      }
      let native = mode === 'native' ? hostBlockReader({ fetchBytes: queryBytes }, { lookupTimeoutMs: attempt.lookupTimeoutMs }) : undefined;
      if (mode === 'rpc') {
        const provider = await bounded(getHostProvider(NATIVE_GENESIS), control.signal);
        if (!provider) throw new Error('The Host did not expose the approved Bulletin chain');
        control.signal.throwIfAborted();
        nativeClient = createClient(provider);
        native = await nativeRpcReader(nativeClient, control.signal);
        attempt.genesisVerified = true;
      }
      const cache = new Map<string, Uint8Array>();
      const readBlock = async (cid: string) => {
        control.signal.throwIfAborted();
        if (session.archiveRawCids.includes(cid)) throw new Error('Playback tried to fetch the archival master');
        if (cache.has(cid)) return cache.get(cid)!;
        const readStart = performance.now();
        const bytes = mode !== 'local' ? await native!(cid) : await options.readControlBlock(cid, control.signal);
        control.signal.throwIfAborted();
        attempt.reads.push({
          cid,
          bytes: bytes.length,
          elapsedMs: Math.round(performance.now() - readStart),
          attemptElapsedMs: Math.round(performance.now() - began),
          mediaSeconds: audio.currentTime
        });
        cache.set(cid, bytes);
        return bytes;
      };
      try {
        const playback = await createStreamingPlayback({
          cid: session.root,
          scope: session.scope,
          key,
          signal: control.signal,
          audio: () => audio,
          onError: error => fail(error, attempt),
          bufferAheadSeconds: () => 30,
          managedProducer: finalizationProducer(
            finishPolicy,
            event => {
              if (control.signal.aborted || report !== attempt) return;
              attempt.finalizationExperimentApplied = true;
              if (attempt.events.length < 200) attempt.events.push({ ...event, elapsedMs: Math.round(performance.now() - began) });
              // Do not synchronously persist/render every extra SourceBuffer event.
              // Existing progress/terminal events flush these bounded snapshots.
            },
            error => fail(error, attempt)
          ),
          fetchObject: async (cid, path, maxBytes, signal, observe) => {
            signal.throwIfAborted();
            if (!/^(manifest\.json|(?:96|160|320)\/(init|segment-[0-9]{3})\.bin)$/.test(path)) throw new Error('Playback path refused');
            const { bytes } = await readPath(readBlock, cid, path, { maxBytes: maxBytes + 64 * 1024 });
            if (bytes.length > maxBytes || (path !== 'manifest.json' && bytes.length !== maxBytes)) throw new Error('Incomplete object');
            observe?.({ fromCache: false });
            return bytes;
          },
          onMetric: metric => {
            if (attempt.metrics.length < 100) attempt.metrics.push({ ...metric, elapsedMs: Math.round(performance.now() - began) });
            display();
          }
        });
        control.signal.throwIfAborted();
        mediaUrl = playback.url;
        attempt.progressive = playback.progressive;
        audio.volume = 0.25;
        configureStreamingAudioElement(audio, playback.url);
        audio.src = playback.url;
        audio.load();
        await audio.play();
        // A resolved play promise does not assert physical audibility.
        display();
      } finally {
        key.fill(0);
      }
    } catch (error) {
      if (!control.signal.aborted) fail(error, attempt);
    } finally {
      key?.fill(0);
      if (session) session.key = [];
    }
  };
  stop.onclick = () => {
    if (report && report.outcome !== 'failed') report.outcome = 'stopped';
    cleanup();
    status.textContent = 'Stopped.';
    display();
  };
  if (networkMarker)
    networkMarker.onclick = () => {
      if (!report || !controller || controller.signal.aborted || report.events.length >= 200) return;
      report.events.push({
        name: 'network-switch-marked',
        elapsedMs: Math.round(performance.now() - began),
        mediaSeconds: audio.currentTime,
        networkNote: element<HTMLInputElement>('network').value.slice(0, 160)
      });
      display(); // A human marker is not automatic verification of a network handover.
    };
  if (cutMarker)
    cutMarker.onclick = () => {
      if (!report || !controller || controller.signal.aborted || report.events.length >= 200) return;
      report.events.push({ name: 'audible-cut-marked', elapsedMs: Math.round(performance.now() - began), mediaSeconds: audio.currentTime });
      display(); // Human reaction time is not an exact audio-gap measurement.
    };
  heard.onchange = () => {
    if (report) report.operatorHeardAudio = heard.checked;
    display();
  };
  download.onclick = () => {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `bulletin-audio-${Date.now()}.json`;
    link.click();
    // Native save dialogs may open asynchronously; keep their Blob alive.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  document.addEventListener('visibilitychange', () => {
    if (!report || !controller || report.events.length >= 200) return;
    report.events.push({ name: document.hidden ? 'hidden' : 'visible', at: new Date().toISOString(), mediaSeconds: audio.currentTime });
    display(); // Observing backgrounding does not stop a healthy audio session.
  });
  window.addEventListener('pagehide', () => {
    if (report && controller) {
      report.outcome = 'interrupted';
      display();
    }
    cleanup();
  });
}
