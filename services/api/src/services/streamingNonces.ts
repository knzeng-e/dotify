import { createHash, randomBytes } from 'node:crypto';
import { mkdir, open, readFile } from 'node:fs/promises';
import path from 'node:path';

export const STREAM_NONCE_SCHEME = 'dotify.gcm.high-counter.v1';
export const STREAM_COUNTER_LIMIT = 0x7fffffff;
const MARKER = 'dotify.streaming.nonce-ledger.v1';
const RESERVATION_CAPABILITY = Symbol('durable nonce reservation');

async function syncDirectory(directory: string): Promise<void> {
  const handle = await open(directory, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

/** Explicit operator setup only. Never auto-recreate a lost reservation ledger. */
export async function initializeStreamingNonceLedger(directory: string): Promise<void> {
  await mkdir(directory, { mode: 0o700 });
  const file = await open(path.join(directory, 'ledger.json'), 'wx', 0o600);
  try {
    await file.writeFile(JSON.stringify({ schema: MARKER }));
    await file.sync();
  } finally {
    await file.close();
  }
  await syncDirectory(directory);
  await syncDirectory(path.dirname(directory));
}

export function streamingKeyFingerprint(key: Uint8Array): string {
  if (key.length !== 32) throw new Error('Streaming encryption requires a 32-byte key');
  return createHash('sha256').update(key).digest('hex');
}

export function streamingNonce(generation: string, counter: number): Buffer {
  if (!/^[0-9a-f]{16}$/.test(generation)) throw new Error('Invalid streaming nonce generation');
  if (!Number.isSafeInteger(counter) || counter < 0 || counter > STREAM_COUNTER_LIMIT) throw new Error('Streaming nonce counter exhausted');
  const nonce = Buffer.alloc(12);
  Buffer.from(generation, 'hex').copy(nonce);
  nonce.writeUInt32BE(0x80000000 + counter, 8);
  return nonce;
}

/**
 * Prefix files are permanent, exclusive reservations, not a mutable checkpoint.
 * The constructor deliberately does not create directories. Every failed job
 * burns its generation, so no persisted counter can reset after a crash.
 */
export class StreamingNonceLedger {
  constructor(
    private readonly directory: string,
    private readonly candidate: () => Buffer = () => randomBytes(8)
  ) {}

  async reserve(key: Uint8Array): Promise<ReservedStreamingGeneration> {
    const fingerprint = streamingKeyFingerprint(key);
    const marker = JSON.parse(await readFile(path.join(this.directory, 'ledger.json'), 'utf8')) as { schema?: unknown };
    if (marker.schema !== MARKER) throw new Error('Streaming nonce ledger unavailable');
    const keyDirectory = path.join(this.directory, fingerprint);
    await mkdir(keyDirectory, { recursive: true, mode: 0o700 });
    // Persist the key-directory entry as well as the eventual reservation file.
    await syncDirectory(this.directory);
    for (let attempt = 0; attempt < 64; attempt += 1) {
      const prefix = this.candidate();
      if (prefix.length !== 8) throw new Error('Invalid nonce generation source');
      const generation = prefix.toString('hex');
      let file;
      try {
        file = await open(path.join(keyDirectory, `${generation}.json`), 'wx', 0o600);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') continue;
        throw error;
      }
      try {
        await file.writeFile(JSON.stringify({ schema: MARKER, fingerprint, generation }));
        await file.sync();
      } finally {
        await file.close();
      }
      await syncDirectory(keyDirectory);
      // Nothing capable of producing an IV escapes until both fsyncs succeed.
      return new ReservedStreamingGeneration(generation, fingerprint, RESERVATION_CAPABILITY);
    }
    throw new Error('Streaming nonce reservation exhausted');
  }
}

export class ReservedStreamingGeneration {
  private counter = 0;
  constructor(
    readonly generation: string,
    private readonly fingerprint: string,
    capability: symbol
  ) {
    if (capability !== RESERVATION_CAPABILITY) throw new Error('Nonce generation must be durably reserved');
  }

  next(key: Uint8Array): { counter: number; nonce: Buffer } {
    if (streamingKeyFingerprint(key) !== this.fingerprint) throw new Error('Nonce reservation belongs to another key');
    const counter = this.counter;
    // Burn before returning. A crypto error can never cause this IV to be reused.
    const nonce = streamingNonce(this.generation, counter);
    this.counter += 1;
    return { counter, nonce };
  }
}
