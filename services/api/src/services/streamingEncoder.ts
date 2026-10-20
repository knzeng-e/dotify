import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { blake2b } from '@noble/hashes/blake2';
import { detectAudioMedia } from './mediaValidation.js';
import { STREAM_BITRATES, STREAM_MIME, StreamingEncryptor, type StreamingManifest, type StreamingScope } from './streamingFormat.js';
import type { StreamingNonceLedger } from './streamingNonces.js';

const MAX_OUTPUT_BYTES = 80 * 1024 * 1024;
const MAX_DURATION_SECONDS = 900;
const MAX_PROCESS_LOG = 128 * 1024;
const DEMUXERS = 'wav,mp3,flac,ogg,matroska,webm,mov,aac';
export type StreamingEncodingResult = { manifest: StreamingManifest; files: Array<{ name: string; bytes: Buffer }>; elapsedMs: number };

async function directorySize(directory: string): Promise<number> {
  const entries = await readdir(directory, { withFileTypes: true });
  let size = 0;
  for (const entry of entries) {
    if (!entry.isFile()) throw new Error('Unexpected encoder output');
    try {
      size += (await stat(path.join(directory, entry.name))).size;
    } catch (error) {
      // DASH atomically renames completed .tmp segments. A name disappearing
      // between readdir/stat is not an unreadable output or an encode failure;
      // the next bounded scan and final scan include its completed name.
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return size;
}

/** Fixed argv only: caller-provided names, URLs and options never reach a shell. */
async function ffmpeg(binary: string, args: string[], signal?: AbortSignal, outputDirectory?: string): Promise<string> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = spawn(
      binary,
      [
        '-nostdin',
        '-hide_banner',
        '-threads',
        '1',
        '-filter_threads',
        '1',
        '-protocol_whitelist',
        'file,pipe',
        '-format_whitelist',
        DEMUXERS,
        ...args
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] }
    );
    let log = '';
    let failure: Error | undefined;
    const stop = (error: Error) => {
      failure ??= error;
      child.kill('SIGKILL');
    };
    const aborted = () => stop(new Error('Streaming encoding cancelled'));
    signal?.addEventListener('abort', aborted, { once: true });
    const deadline = setTimeout(() => stop(new Error('Streaming encoding deadline exceeded')), 180_000);
    let checking = false;
    const guard = setInterval(() => {
      if (!outputDirectory || checking) return;
      checking = true;
      void directorySize(outputDirectory)
        .then(size => {
          if (size > MAX_OUTPUT_BYTES) stop(new Error('Streaming output exceeds byte budget'));
        })
        .catch(() => stop(new Error('Streaming output could not be bounded')))
        .finally(() => {
          checking = false;
        });
    }, 100);
    const cleanup = () => {
      clearTimeout(deadline);
      clearInterval(guard);
      signal?.removeEventListener('abort', aborted);
    };
    child.stderr.on('data', (bytes: Buffer) => {
      log += bytes.toString();
      if (Buffer.byteLength(log) > MAX_PROCESS_LOG) stop(new Error('Streaming encoder log exceeded byte budget'));
    });
    child.once('error', () => {
      cleanup();
      reject(new Error('Streaming encoder unavailable'));
    });
    child.once('close', code => {
      cleanup();
      if (failure) reject(failure);
      else if (code !== 0) reject(new Error('Audio could not be encoded'));
      else resolve(log);
    });
    // Close the abort race between the initial check and listener installation.
    if (signal?.aborted) aborted();
  });
}

function durationFromMpd(mpd: string): number {
  const match = /mediaPresentationDuration="PT(?:(\d+)H)?(?:(\d+)M)?([0-9.]+)S"/.exec(mpd);
  const seconds = match ? Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3]) : NaN;
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > MAX_DURATION_SECONDS)
    throw new Error('Streaming audio must be at most 15 minutes');
  return seconds;
}

export function streamingLoudness(log: string): { integratedLufs: number | null; gainDb: number } {
  const values = [...log.matchAll(/I:\s*(-?[0-9.]+)\s+LUFS/g)];
  const integrated = Number(values.at(-1)?.[1]);
  const peaks = [...log.matchAll(/Peak:\s*(-?[0-9.]+)\s+dBFS/g)];
  const peak = Number(peaks.at(-1)?.[1]);
  if (!Number.isFinite(integrated)) throw new Error('Loudness measurement unavailable');
  // EBU R128 uses a -70 LUFS floor for silence. Never amplify that floor.
  if (integrated <= -69.9) return { integratedLufs: null, gainDb: 0 };
  if (!Number.isFinite(peak)) throw new Error('True-peak measurement unavailable');
  const gainDb = Math.max(-24, Math.min(12, -14 - integrated, -1 - peak));
  return { integratedLufs: integrated, gainDb: Math.round(gainDb * 100) / 100 };
}

/**
 * Caller owns global job admission. This function owns one private temporary
 * directory, fixed FFmpeg commands and cleanup, including cancellation/failure.
 * It never pins files, changes catalog state, derives keys or grants access.
 */
export async function encodeStreamingRelease(input: {
  master: Buffer;
  key: Buffer;
  scope: StreamingScope;
  ledger: StreamingNonceLedger;
  ffmpegPath?: string;
  temporaryRoot?: string;
  signal?: AbortSignal;
  onProgress?: (phase: 'measuring' | 'encoding' | 'encrypting', bitrate?: number) => void;
}): Promise<StreamingEncodingResult> {
  const started = performance.now();
  if (!input.master.length || input.master.length > 50 * 1024 * 1024) throw new Error('Audio exceeds streaming upload budget');
  const media = detectAudioMedia(input.master);
  if (!media) throw new Error('Unsupported streaming master');
  const hash = `0x${Buffer.from(blake2b(input.master, { dkLen: 32 })).toString('hex')}`;
  if (input.scope.contentHash !== hash) throw new Error('Streaming master hash mismatch');
  // Validate scope before reserving or touching plaintext on disk.
  const reservation = await input.ledger.reserve(input.key);
  const encryptor = new StreamingEncryptor(input.key, reservation, input.scope);
  const directory = await mkdtemp(path.join(input.temporaryRoot ?? os.tmpdir(), 'dotify-stream-'));
  try {
    const source = path.join(directory, `source.${media.extension}`);
    await writeFile(source, input.master, { mode: 0o600, flag: 'wx' });
    input.onProgress?.('measuring');
    const binary = input.ffmpegPath ?? 'ffmpeg';
    const loudnessLog = await ffmpeg(
      binary,
      [
        '-loglevel',
        'info',
        '-i',
        source,
        '-map',
        '0:a:0',
        '-vn',
        '-sn',
        '-dn',
        '-t',
        '901',
        '-threads',
        '1',
        '-af',
        'ebur128=peak=true:framelog=verbose',
        '-f',
        'null',
        '-'
      ],
      input.signal
    );
    const loudness = streamingLoudness(loudnessLog);
    const files: StreamingEncodingResult['files'] = [];
    input.onProgress?.('encrypting');
    const archive = encryptor.object(input.master, { rendition: 'archive', kind: 'master', index: 0, path: 'archive/master.bin' });
    files.push({ name: archive.descriptor.path, bytes: archive.bytes });
    const renditions: StreamingManifest['renditions'] = [];
    let durationSeconds = 0;
    let outputBytes = 0;
    for (const bitrateKbps of STREAM_BITRATES) {
      input.signal?.throwIfAborted();
      const output = path.join(directory, String(bitrateKbps));
      await mkdir(output, { mode: 0o700 });
      input.onProgress?.('encoding', bitrateKbps);
      await ffmpeg(
        binary,
        [
          '-loglevel',
          'error',
          '-i',
          source,
          '-map',
          '0:a:0',
          '-vn',
          '-sn',
          '-dn',
          '-t',
          '901',
          '-threads',
          '1',
          '-c:a',
          'aac',
          '-profile:a',
          'aac_low',
          '-b:a',
          `${bitrateKbps}k`,
          '-ar',
          '48000',
          '-ac',
          '2',
          '-f',
          'dash',
          '-seg_duration',
          '4',
          '-use_template',
          '1',
          '-use_timeline',
          '1',
          '-init_seg_name',
          'init.mp4',
          '-media_seg_name',
          'segment-$Number%05d$.m4s',
          path.join(output, 'index.mpd')
        ],
        input.signal,
        output
      );
      const size = await directorySize(output);
      outputBytes += size;
      if (outputBytes > MAX_OUTPUT_BYTES) throw new Error('Streaming output exceeds byte budget');
      const mpdFile = path.join(output, 'index.mpd');
      if ((await stat(mpdFile)).size > 64 * 1024) throw new Error('Streaming segment index exceeds byte budget');
      const duration = durationFromMpd(await readFile(mpdFile, 'utf8'));
      if (durationSeconds && Math.abs(durationSeconds - duration) > 0.1) throw new Error('Streaming rendition durations disagree');
      durationSeconds = duration;
      const names = (await readdir(output)).filter(name => /^segment-[0-9]{5}\.m4s$/.test(name)).sort();
      if (!names.length || names.length > 256) throw new Error('Streaming segment count exceeds budget');
      input.onProgress?.('encrypting', bitrateKbps);
      const init = encryptor.object(await readFile(path.join(output, 'init.mp4')), {
        rendition: String(bitrateKbps),
        kind: 'init',
        index: 0,
        path: `${bitrateKbps}/init.bin`
      });
      files.push({ name: init.descriptor.path, bytes: init.bytes });
      const segments: StreamingManifest['renditions'][number]['segments'] = [];
      for (const [index, name] of names.entries()) {
        input.signal?.throwIfAborted();
        if (name !== `segment-${String(index + 1).padStart(5, '0')}.m4s`) throw new Error('Streaming segment order invalid');
        const file = path.join(output, name);
        if ((await stat(file)).size > 1024 * 1024) throw new Error('Streaming segment exceeds byte budget');
        const encrypted = encryptor.object(await readFile(file), {
          rendition: String(bitrateKbps),
          kind: 'media',
          index,
          path: `${bitrateKbps}/segment-${String(index).padStart(3, '0')}.bin`
        });
        segments.push(encrypted.descriptor);
        files.push({ name: encrypted.descriptor.path, bytes: encrypted.bytes });
      }
      renditions.push({ bitrateKbps, mediaMime: STREAM_MIME, init: init.descriptor, segments });
      await rm(output, { recursive: true, force: true });
    }
    input.signal?.throwIfAborted();
    const manifest = encryptor.manifest({ durationSeconds, ...loudness, master: archive.descriptor, renditions });
    files.push({ name: 'manifest.json', bytes: Buffer.from(JSON.stringify(manifest)) });
    return { manifest, files, elapsedMs: Math.round(performance.now() - started) };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
