import { createCipheriv, createDecipheriv } from 'node:crypto';
import { z } from 'zod';
import { STREAM_NONCE_SCHEME, streamingNonce, type ReservedStreamingGeneration } from './streamingNonces.js';

export const STREAM_SCHEMA = 'dotify.audio.v3';
export const STREAM_MIME = 'audio/mp4; codecs="mp4a.40.2"';
export const STREAM_BITRATES = [96, 160, 320] as const;
export type StreamingScope = { chainId: number; runtimeAddress: string; contentHash: string; keyVersion: string };
export type StreamingIdentity = StreamingScope & {
  schema: typeof STREAM_SCHEMA;
  version: 1;
  nonceScheme: typeof STREAM_NONCE_SCHEME;
  generation: string;
};
export type StreamingObject = {
  rendition: string;
  kind: 'init' | 'media' | 'master';
  index: number;
  counter: number;
  plainLength: number;
  encryptedLength: number;
  path: string;
};
export type StreamingRendition = {
  bitrateKbps: 96 | 160 | 320;
  mediaMime: typeof STREAM_MIME;
  init: StreamingObject;
  segments: StreamingObject[];
};
export type StreamingManifest = StreamingIdentity & {
  durationSeconds: number;
  integratedLufs: number | null;
  gainDb: number;
  master: StreamingObject;
  renditions: StreamingRendition[];
  authentication: { counter: number; tag: string };
};

const objectSchema = z
  .object({
    rendition: z.enum(['96', '160', '320', 'archive']),
    kind: z.enum(['init', 'media', 'master']),
    index: z.number().int().min(0).max(255),
    counter: z.number().int().min(0).max(0x7fffffff),
    plainLength: z
      .number()
      .int()
      .positive()
      .max(50 * 1024 * 1024),
    encryptedLength: z
      .number()
      .int()
      .positive()
      .max(50 * 1024 * 1024 + 16),
    path: z.string().max(64)
  })
  .strict();
const manifestSchema = z
  .object({
    schema: z.literal(STREAM_SCHEMA),
    version: z.literal(1),
    nonceScheme: z.literal(STREAM_NONCE_SCHEME),
    chainId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    runtimeAddress: z.string().regex(/^0x[0-9a-f]{40}$/),
    contentHash: z.string().regex(/^0x[0-9a-f]{64}$/),
    keyVersion: z.string().max(80),
    generation: z.string().regex(/^[0-9a-f]{16}$/),
    durationSeconds: z.number().positive().max(900),
    integratedLufs: z.number().min(-70).max(10).nullable(),
    gainDb: z.number().min(-24).max(12),
    master: objectSchema,
    renditions: z
      .array(
        z
          .object({
            bitrateKbps: z.union([z.literal(96), z.literal(160), z.literal(320)]),
            mediaMime: z.literal(STREAM_MIME),
            init: objectSchema,
            segments: z.array(objectSchema).min(1).max(256)
          })
          .strict()
      )
      .length(3),
    authentication: z.object({ counter: z.number().int().min(0).max(0x7fffffff), tag: z.string().regex(/^[0-9a-f]{32}$/) }).strict()
  })
  .strict();

/** Bound untrusted JSON before canonicalization, allocation or AES operations. */
export function parseStreamingManifest(bytes: Uint8Array): StreamingManifest {
  if (!bytes.length || bytes.length > 256 * 1024) throw new Error('Streaming manifest exceeds byte budget');
  const manifest = manifestSchema.parse(JSON.parse(Buffer.from(bytes).toString('utf8')));
  validateStreamingScope(manifest);
  const counters = new Set<number>([manifest.authentication.counter]);
  function check(object: StreamingObject, rendition: string, kind: StreamingObject['kind'], index: number, objectPath: string) {
    if (
      object.rendition !== rendition ||
      object.kind !== kind ||
      object.index !== index ||
      object.path !== objectPath ||
      object.encryptedLength !== object.plainLength + 16 ||
      counters.has(object.counter)
    )
      throw new Error('Invalid streaming object binding');
    if (kind !== 'master' && object.plainLength > 1024 * 1024) throw new Error('Streaming segment exceeds byte budget');
    counters.add(object.counter);
  }
  check(manifest.master, 'archive', 'master', 0, 'archive/master.bin');
  for (const [index, rendition] of manifest.renditions.entries()) {
    if (rendition.bitrateKbps !== STREAM_BITRATES[index]) throw new Error('Invalid streaming rendition order');
    const id = String(rendition.bitrateKbps);
    check(rendition.init, id, 'init', 0, `${id}/init.bin`);
    for (const [segmentIndex, segment] of rendition.segments.entries())
      check(segment, id, 'media', segmentIndex, `${id}/segment-${String(segmentIndex).padStart(3, '0')}.bin`);
  }
  return manifest;
}

/** Same sorted-key encoding is used by the reader; arrays retain their order. */
export function streamingCanonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(streamingCanonicalJson).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${streamingCanonicalJson((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  throw new Error('Invalid streaming authenticated value');
}

export function validateStreamingScope(scope: StreamingScope): void {
  if (
    !Number.isSafeInteger(scope.chainId) ||
    scope.chainId <= 0 ||
    !/^0x[0-9a-f]{40}$/.test(scope.runtimeAddress) ||
    !/^0x[0-9a-f]{64}$/.test(scope.contentHash)
  )
    throw new Error('Invalid streaming release scope');
  // Legacy v1 may have used arbitrary 96-bit nonces. Its migration is blocked.
  if (!/^dotify-content-key-v(?:[2-9]|[1-9][0-9]+)$/.test(scope.keyVersion)) throw new Error('Unproven legacy nonce namespace');
}

function identityAad(identity: StreamingIdentity, context: unknown): Buffer {
  return Buffer.from(
    streamingCanonicalJson([
      identity.schema,
      identity.version,
      identity.nonceScheme,
      identity.chainId,
      identity.runtimeAddress,
      identity.contentHash,
      identity.keyVersion,
      identity.generation,
      context
    ])
  );
}

function objectAad(identity: StreamingIdentity, object: StreamingObject): Buffer {
  return identityAad(identity, [object.rendition, object.kind, object.index, object.counter, object.plainLength, object.path]);
}

function encrypt(plain: Uint8Array, key: Buffer, nonce: Buffer, aad: Buffer): Buffer {
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(aad);
  return Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
}

export class StreamingEncryptor {
  readonly identity: StreamingIdentity;
  constructor(
    private readonly key: Buffer,
    private readonly reservation: ReservedStreamingGeneration,
    scope: StreamingScope
  ) {
    validateStreamingScope(scope);
    this.identity = { ...scope, schema: STREAM_SCHEMA, version: 1, nonceScheme: STREAM_NONCE_SCHEME, generation: reservation.generation };
  }

  object(
    plain: Uint8Array,
    context: Pick<StreamingObject, 'rendition' | 'kind' | 'index' | 'path'>
  ): { descriptor: StreamingObject; bytes: Buffer } {
    if (!plain.length || plain.length > 50 * 1024 * 1024) throw new Error('Streaming object exceeds byte budget');
    if (
      !/^(96|160|320|archive)$/.test(context.rendition) ||
      !Number.isSafeInteger(context.index) ||
      context.index < 0 ||
      context.index > 255 ||
      !/^(?:96|160|320|archive)\/(?:init|master|segment-[0-9]{3})\.bin$/.test(context.path)
    )
      throw new Error('Invalid streaming object context');
    const { counter, nonce } = this.reservation.next(this.key);
    const descriptor: StreamingObject = { ...context, counter, plainLength: plain.length, encryptedLength: plain.length + 16 };
    return { descriptor, bytes: encrypt(plain, this.key, nonce, objectAad(this.identity, descriptor)) };
  }

  manifest(payload: Omit<StreamingManifest, keyof StreamingIdentity | 'authentication'>): StreamingManifest {
    const manifest = { ...payload, ...this.identity };
    const { counter, nonce } = this.reservation.next(this.key);
    const tag = encrypt(Buffer.alloc(0), this.key, nonce, identityAad(this.identity, ['manifest', counter, manifest]));
    return parseStreamingManifest(Buffer.from(JSON.stringify({ ...manifest, authentication: { counter, tag: tag.toString('hex') } })));
  }
}

export function verifyStreamingManifest(manifest: StreamingManifest, key: Buffer, expected: StreamingScope): void {
  parseStreamingManifest(Buffer.from(JSON.stringify(manifest)));
  validateStreamingScope(expected);
  for (const field of ['chainId', 'runtimeAddress', 'contentHash', 'keyVersion'] as const)
    if (manifest[field] !== expected[field]) throw new Error('Streaming release identity mismatch');
  if (manifest.schema !== STREAM_SCHEMA || manifest.version !== 1 || manifest.nonceScheme !== STREAM_NONCE_SCHEME)
    throw new Error('Unsupported streaming schema');
  const { authentication, ...payload } = manifest;
  if (!authentication || !/^[0-9a-f]{32}$/.test(authentication.tag)) throw new Error('Invalid streaming manifest authentication');
  const decipher = createDecipheriv('aes-256-gcm', key, streamingNonce(manifest.generation, authentication.counter));
  decipher.setAAD(identityAad(manifest, ['manifest', authentication.counter, payload]));
  decipher.setAuthTag(Buffer.from(authentication.tag, 'hex'));
  decipher.final();
}

export function decryptStreamingObject(bytes: Uint8Array, key: Buffer, identity: StreamingIdentity, object: StreamingObject): Buffer {
  if (bytes.length !== object.encryptedLength || bytes.length !== object.plainLength + 16)
    throw new Error('Invalid streaming object length');
  const decipher = createDecipheriv('aes-256-gcm', key, streamingNonce(identity.generation, object.counter));
  decipher.setAAD(objectAad(identity, object));
  decipher.setAuthTag(Buffer.from(bytes.subarray(bytes.length - 16)));
  return Buffer.concat([decipher.update(bytes.subarray(0, bytes.length - 16)), decipher.final()]);
}
