/** Browser half of the v3 wire contract. No key derivation or access bypass. */
export type StreamingScope = { chainId: number; runtimeAddress: string; contentHash: string; keyVersion: string };
export type StreamingObject = {
  rendition: string;
  kind: 'init' | 'media' | 'master';
  index: number;
  counter: number;
  plainLength: number;
  encryptedLength: number;
  path: string;
};
export type StreamingManifest = StreamingScope & {
  schema: 'dotify.audio.v3';
  version: 1;
  nonceScheme: 'dotify.gcm.high-counter.v1';
  generation: string;
  durationSeconds: number;
  integratedLufs: number | null;
  gainDb: number;
  master: StreamingObject;
  renditions: Array<{ bitrateKbps: 96 | 160 | 320; mediaMime: 'audio/mp4; codecs="mp4a.40.2"'; init: StreamingObject; segments: StreamingObject[] }>;
  authentication: { counter: number; tag: string };
};
export type VerifiedStreamingManifest = { readonly manifest: StreamingManifest };
const verified = new WeakMap<VerifiedStreamingManifest, { key: CryptoKey; media: Set<StreamingObject> }>();
const encoder = new TextEncoder();

function canonical(value: unknown, depth = 0, budget = { remaining: 15000 }): string {
  if (depth > 12 || --budget.remaining < 0) throw new Error('Streaming manifest nesting exceeds budget');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(item => canonical(item, depth + 1, budget)).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    if (keys.length > 32) throw new Error('Streaming manifest field budget exceeded');
    return `{${keys.map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key], depth + 1, budget)}`).join(',')}}`;
  }
  throw new Error('Invalid streaming authenticated value');
}

function hex(value: string): Uint8Array {
  return Uint8Array.from(value.match(/../g) ?? [], pair => Number.parseInt(pair, 16));
}

function nonce(generation: string, counter: number): Uint8Array {
  if (!/^[0-9a-f]{16}$/.test(generation) || !Number.isSafeInteger(counter) || counter < 0 || counter > 0x7fffffff) throw new Error('Invalid streaming nonce');
  const bytes = new Uint8Array(12);
  bytes.set(hex(generation));
  new DataView(bytes.buffer).setUint32(8, 0x80000000 + counter);
  return bytes;
}

function aad(manifest: StreamingManifest, context: unknown): Uint8Array {
  return encoder.encode(
    canonical([
      manifest.schema,
      manifest.version,
      manifest.nonceScheme,
      manifest.chainId,
      manifest.runtimeAddress,
      manifest.contentHash,
      manifest.keyVersion,
      manifest.generation,
      context
    ])
  );
}

function finite(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function freeze(value: object): void {
  for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child);
  Object.freeze(value);
}

/** Authenticate and bind the manifest before exposing gain or media paths. */
export async function readStreamingManifest(bytes: Uint8Array, key: Uint8Array, expected: StreamingScope): Promise<VerifiedStreamingManifest> {
  if (!bytes.length || bytes.length > 256 * 1024 || key.length !== 32) throw new Error('Invalid streaming manifest budget');
  const manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as StreamingManifest;
  if (!manifest || manifest.schema !== 'dotify.audio.v3' || manifest.version !== 1 || manifest.nonceScheme !== 'dotify.gcm.high-counter.v1')
    throw new Error('Unsupported streaming manifest');
  if (
    !Number.isSafeInteger(expected.chainId) ||
    expected.chainId <= 0 ||
    !/^0x[0-9a-f]{40}$/.test(expected.runtimeAddress) ||
    !/^0x[0-9a-f]{64}$/.test(expected.contentHash) ||
    !/^dotify-content-key-v(?:[2-9]|[1-9][0-9]+)$/.test(expected.keyVersion)
  )
    throw new Error('Invalid streaming release scope');
  for (const field of ['chainId', 'runtimeAddress', 'contentHash', 'keyVersion'] as const)
    if (manifest[field] !== expected[field]) throw new Error('Streaming release identity mismatch');
  if (
    !finite(manifest.durationSeconds, 0.001, 900) ||
    !finite(manifest.gainDb, -24, 12) ||
    (manifest.integratedLufs !== null && !finite(manifest.integratedLufs, -70, 10))
  )
    throw new Error('Invalid streaming audio metadata');
  if (
    !Array.isArray(manifest.renditions) ||
    manifest.renditions.length !== 3 ||
    !manifest.authentication ||
    !/^[0-9a-f]{32}$/.test(manifest.authentication.tag)
  )
    throw new Error('Invalid streaming manifest layout');
  const counters = new Set<number>([manifest.authentication.counter]);
  const media = new Set<StreamingObject>();
  function check(object: StreamingObject, rendition: string, kind: StreamingObject['kind'], index: number, objectPath: string) {
    if (
      !object ||
      object.rendition !== rendition ||
      object.kind !== kind ||
      object.index !== index ||
      object.path !== objectPath ||
      !Number.isSafeInteger(object.counter) ||
      object.counter < 0 ||
      object.counter > 0x7fffffff ||
      counters.has(object.counter)
    )
      throw new Error('Invalid streaming object binding');
    const max = kind === 'master' ? 50 * 1024 * 1024 : 1024 * 1024;
    if (!Number.isSafeInteger(object.plainLength) || object.plainLength <= 0 || object.plainLength > max || object.encryptedLength !== object.plainLength + 16)
      throw new Error('Invalid streaming object length');
    counters.add(object.counter);
    if (kind !== 'master') media.add(object);
  }
  check(manifest.master, 'archive', 'master', 0, 'archive/master.bin');
  for (const [index, rendition] of manifest.renditions.entries()) {
    if (
      !rendition ||
      rendition.bitrateKbps !== [96, 160, 320][index] ||
      rendition.mediaMime !== 'audio/mp4; codecs="mp4a.40.2"' ||
      !Array.isArray(rendition.segments) ||
      !rendition.segments.length ||
      rendition.segments.length > 256
    )
      throw new Error('Invalid streaming rendition');
    const id = String(rendition.bitrateKbps);
    check(rendition.init, id, 'init', 0, `${id}/init.bin`);
    for (const [segmentIndex, segment] of rendition.segments.entries())
      check(segment, id, 'media', segmentIndex, `${id}/segment-${String(segmentIndex).padStart(3, '0')}.bin`);
  }
  const cryptoKey = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['decrypt']);
  const { authentication, ...payload } = manifest;
  await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce(manifest.generation, authentication.counter), additionalData: aad(manifest, ['manifest', authentication.counter, payload]) },
    cryptoKey,
    hex(authentication.tag)
  );
  freeze(manifest);
  const result = Object.freeze({ manifest });
  verified.set(result, { key: cryptoKey, media });
  return result;
}

/** Playback is deliberately unable to select the archival master. */
export async function decryptStreamingMedia(context: VerifiedStreamingManifest, object: StreamingObject, bytes: Uint8Array): Promise<Uint8Array> {
  const authorization = verified.get(context);
  if (!authorization || !authorization.media.has(object) || bytes.length !== object.encryptedLength) throw new Error('Unverified streaming media object');
  return new Uint8Array(
    await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: nonce(context.manifest.generation, object.counter),
        additionalData: aad(context.manifest, [object.rendition, object.kind, object.index, object.counter, object.plainLength, object.path])
      },
      authorization.key,
      bytes
    )
  );
}
