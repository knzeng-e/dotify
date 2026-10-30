// Browser-safe comparison. This never selects a transport or submits data.
import { CID } from 'multiformats/cid';
import { hashBytes, SHA256, BLAKE2B256 } from './hashes.mjs';
import { readPath, verifyBlock } from './reader.mjs';
const hex = bytes => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
export function addressingCases(session) {
  if (session.schema !== 'dotify.bulletin.addressing.v1' || session.kind !== 'public-addressing-marker-v1' ||
      !Number.isSafeInteger(session.payloadBytes) || session.payloadBytes < 1 || session.payloadBytes > 512 ||
      !/^[a-f0-9]{64}$/.test(session.payloadSha256)) throw new Error('Invalid addressing session');
  for (const [id, codec, hash] of [
    [session.sha256RawCid, 0x55, SHA256], [session.blake2bRawCid, 0x55, BLAKE2B256], [session.directoryCid, 0x70, BLAKE2B256]
  ]) {
    const cid = CID.parse(id);
    if (cid.version !== 1 || cid.code !== codec || cid.multihash.code !== hash || cid.multihash.digest.length !== 32)
      throw new Error('Unexpected addressing CID');
  }
  return [
    { name: 'SHA-256 raw', cid: session.sha256RawCid, payload: true },
    { name: 'BLAKE2b-256 raw', cid: session.blake2bRawCid, payload: true },
    { name: 'BLAKE2b-256 directory', cid: session.directoryCid, payload: false },
    { name: 'BLAKE2b-256 directory to BLAKE2b-256 leaf', cid: session.directoryCid, path: 'blake2b.txt', payload: true },
    { name: 'BLAKE2b-256 directory to SHA-256 leaf', cid: session.directoryCid, path: 'sha256.txt', payload: true }
  ];
}
export async function readAddressingCase(readBlock, session, item) {
  if (!addressingCases(session).some(c => JSON.stringify(c) === JSON.stringify(item))) throw new Error('Unknown addressing case');
  const bytes = item.path
    ? (await readPath(readBlock, item.cid, item.path, { maxBytes: 2048, maxReads: 2 })).bytes
    : await readBlock(item.cid);
  if (!item.path) await verifyBlock(item.cid, bytes);
  if (item.payload && (bytes.length !== session.payloadBytes || hex((await hashBytes(SHA256, bytes)).digest) !== session.payloadSha256))
    throw new Error('Marker payload differs');
  return { verifiedBytes: bytes.length };
}
