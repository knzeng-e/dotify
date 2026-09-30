// Offline experiment only. No host, credentials, network or production routing.
import { createCipheriv, createDecipheriv, createHash, diffieHellman, generateKeyPairSync, randomBytes } from 'node:crypto';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { encodeData, MAX_STATEMENT_SIZE, MAX_USER_TOTAL } from '@parity/product-sdk-statement-store';

const MAX_FRAGMENTS = 16;
const CHUNK_BYTES = 240;

export function experimentKeys() {
  const a = generateKeyPairSync('x25519');
  const b = generateKeyPairSync('x25519');
  const derive = (privateKey, publicKey) => createHash('sha256').update(diffieHellman({ privateKey, publicKey })).digest();
  return { sender: derive(a.privateKey, b.publicKey), receiver: derive(b.privateKey, a.publicKey) };
}

export function fragmentExperiment(text, key, now = Date.now()) {
  if (Buffer.byteLength(text) > 16384) throw new Error('Experiment input limit');
  const id = randomBytes(8).toString('hex');
  const nonce = randomBytes(12);
  const compressed = deflateRawSync(Buffer.from(text));
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(id));
  const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const body = Buffer.concat([nonce, cipher.getAuthTag(), encrypted]);
  const n = Math.ceil(body.length / CHUNK_BYTES);
  if (n > MAX_FRAGMENTS) throw new Error('Experiment fragmentation limit');
  const fragments = Array.from({ length: n }, (_, i) => ({
    v: 1,
    id,
    i,
    n,
    expires: now + 10000,
    body: body.subarray(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES).toString('base64')
  }));
  const sizes = fragments.map(fragment => encodeData(fragment).length);
  return { fragments, rawBytes: Buffer.byteLength(text), compressedBytes: compressed.length, encryptedBytes: body.length, sizes };
}

export function experimentAssembler(key) {
  const pending = new Map();
  const consumed = new Map();
  function prune(now) {
    for (const [id, entry] of pending) if (entry.expires <= now) pending.delete(id);
    for (const [id, expires] of consumed) if (expires <= now) consumed.delete(id);
  }
  return {
    pending: now => {
      prune(now);
      return pending.size;
    },
    accept(fragment, now = Date.now()) {
      prune(now);
      if (
        fragment.v !== 1 ||
        !/^[a-f0-9]{16}$/.test(fragment.id) ||
        !Number.isInteger(fragment.n) ||
        fragment.n < 1 ||
        fragment.n > MAX_FRAGMENTS ||
        !Number.isInteger(fragment.i) ||
        fragment.i < 0 ||
        fragment.i >= fragment.n ||
        !Number.isSafeInteger(fragment.expires) ||
        fragment.expires <= now ||
        fragment.expires > now + 10000 ||
        typeof fragment.body !== 'string' ||
        fragment.body.length > 320
      )
        throw new Error('Invalid fragment');
      encodeData(fragment);
      if (consumed.has(fragment.id)) return null;
      if (!pending.has(fragment.id)) {
        if (pending.size + consumed.size >= 32) throw new Error('Experiment capacity');
        pending.set(fragment.id, { n: fragment.n, expires: fragment.expires, parts: new Map() });
      }
      const entry = pending.get(fragment.id);
      const old = entry.parts.get(fragment.i);
      if (entry.n !== fragment.n || entry.expires !== fragment.expires || (old !== undefined && old !== fragment.body)) throw new Error('Conflicting fragment');
      entry.parts.set(fragment.i, fragment.body);
      if (entry.parts.size !== entry.n) return null;
      pending.delete(fragment.id);
      consumed.set(fragment.id, entry.expires);
      const body = Buffer.concat(Array.from({ length: entry.n }, (_, i) => Buffer.from(entry.parts.get(i), 'base64')));
      const decipher = createDecipheriv('aes-256-gcm', key, body.subarray(0, 12));
      decipher.setAAD(Buffer.from(fragment.id));
      decipher.setAuthTag(body.subarray(12, 28));
      return inflateRawSync(Buffer.concat([decipher.update(body.subarray(28)), decipher.final()]), { maxOutputLength: 16384 }).toString();
    }
  };
}

export function syntheticSdp(candidateCount) {
  const header = 'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\n';
  return (
    header +
    Array.from(
      { length: candidateCount },
      (_, i) => `a=candidate:${createHash('sha256').update(String(i)).digest('hex')} 1 udp 2122260223 192.0.2.${i + 1} ${5000 + i} typ host\r\n`
    ).join('')
  );
}

export function runExperiment() {
  const keys = experimentKeys();
  const cases = [4, 16, 32].map(count => {
    const text = syntheticSdp(count);
    const capture = fragmentExperiment(text, keys.sender);
    const receiver = experimentAssembler(keys.receiver);
    let decoded;
    for (const fragment of [...capture.fragments].reverse()) decoded = receiver.accept(fragment) ?? decoded;
    if (decoded !== text) throw new Error('Experiment roundtrip failed');
    const encodedBytes = capture.sizes.reduce((a, b) => a + b, 0);
    return {
      candidates: count,
      rawBytes: capture.rawBytes,
      compressedBytes: capture.compressedBytes,
      encryptedBytes: capture.encryptedBytes,
      fragments: capture.fragments.length,
      maxEncodedFragmentBytes: Math.max(...capture.sizes),
      encodedBytes,
      fitsAccountWithoutOtherStatements: encodedBytes <= MAX_USER_TOTAL,
      retryWholeMessageBytes: encodedBytes * 2
    };
  });
  return {
    kind: 'offline-synthetic-not-live',
    sdk: '0.6.9',
    limits: { statement: MAX_STATEMENT_SIZE, account: MAX_USER_TOTAL },
    cases,
    decision: 'retain Socket.IO',
    limitations: [
      'No authenticated peer key agreement',
      'No network latency/loss or mobile measurements',
      'Host-sponsored shared account may have less available budget',
      'No retry or rendezvous route is installed'
    ]
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(runExperiment(), null, 2));
