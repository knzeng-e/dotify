// Local operator tool only. No production imports, automatic signer or live CI writes.
import assert from 'node:assert/strict';
import { lstat, mkdir, open, readFile, rm, writeFile } from 'node:fs/promises';
import { readSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from 'polkadot-api';
import { getWsProvider } from 'polkadot-api/ws';
import { getTxCreator } from 'polkadot-api/tx-creator';
import { AsyncBulletinClient } from '@parity/bulletin-sdk';
import { sr25519CreateDerive } from '@polkadot-labs/hdkd';
import { entropyToMiniSecret, mnemonicToEntropy, ss58Address } from '@polkadot-labs/hdkd-helpers';
import { encryptedFixture } from './fixture.mjs';
import { buildDirectory, readPath, verifyGraph } from './graph.mjs';
import { publish, requestRenewal, verifyRenewal } from './publication.mjs';
import { ENDPOINT, CANARY_ACCOUNT, CANARY_BUDGET, liveTransport } from './live-transport.mjs';
import { parseStreamingManifest, verifyStreamingManifest, decryptStreamingObject } from '../../services/api/src/services/streamingFormat.ts';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2);

export async function prepare(directory, makeFixture = encryptedFixture) {
  await mkdir(directory, { mode: 0o700 }); // Refuse to overwrite an earlier fixture/nonce ledger.
  const fixture = await makeFixture(directory);
  try {
    const graph = await buildDirectory(fixture.files);
    assert.ok(graph.bytes <= CANARY_BUDGET.maxBytes && graph.blocks.length * 2 <= CANARY_BUDGET.maxTransactions, 'Fixture exceeds the approved canary');
    await writeFile(join(directory, 'key.bin'), fixture.key, { flag: 'wx', mode: 0o600 });
    await writeFile(join(directory, 'fixture.json'), json({
      schema: 'dotify.bulletin.canary.v1', account: CANARY_ACCOUNT, scope: fixture.scope,
      ...(fixture.audioProof ? { audioProof: fixture.audioProof } : {}),
      originals: Object.fromEntries([...fixture.originals].map(([path, bytes]) => [path, hash(bytes)])),
      graph: { ...graph, blocks: graph.blocks.map(b => ({ ...b, bytes: Buffer.from(b.bytes).toString('base64') })) }
    }), { flag: 'wx', mode: 0o600 });
    return { root: graph.root, blocks: graph.blocks.length, bytes: graph.bytes, prospectiveTransactions: graph.blocks.length * 2 };
  } finally {
    fixture.key.fill(0);
    for (const bytes of fixture.originals.values()) bytes.fill(0);
  }
}

export async function loadFixture(directory) {
  const dir = await lstat(directory);
  assert.ok(dir.isDirectory() && (dir.mode & 0o077) === 0, 'Canary directory must be private');
  const file = join(directory, 'fixture.json');
  const fileStat = await lstat(file);
  assert.ok(fileStat.isFile() && (fileStat.mode & 0o077) === 0 && fileStat.size <= 2 * CANARY_BUDGET.maxBytes, 'Fixture must be a private regular file within budget');
  const fixture = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(fixture.schema, 'dotify.bulletin.canary.v1');
  assert.equal(fixture.account, CANARY_ACCOUNT, 'Canary account changed');
  const graph = { ...fixture.graph, blocks: fixture.graph.blocks.map(b => ({ ...b, bytes: Buffer.from(b.bytes, 'base64') })) };
  await verifyGraph(graph);
  assert.ok(graph.bytes <= CANARY_BUDGET.maxBytes && graph.blocks.length * 2 <= CANARY_BUDGET.maxTransactions, 'Fixture exceeds the approved canary');
  return { ...fixture, graph };
}

export async function withLease(directory, run) {
  const path = join(directory, 'operator.lock');
  const file = await open(path, 'wx', 0o600);
  try {
    await file.writeFile(json({ pid: process.pid, createdAt: new Date().toISOString() }));
    await file.sync();
    return await run();
  } finally { await file.close(); await rm(path); }
}

export async function verifyFiles(transport, fixture, key) {
  assert.equal(key.length, 32, 'Invalid synthetic content key');
  const { graph, scope, originals } = fixture;
  transport.reads.length = 0;
  const start = performance.now();
  const result = await readPath(transport.readBlock, graph.root, 'manifest.json');
  const manifest = parseStreamingManifest(result.bytes);
  verifyStreamingManifest(manifest, key, scope);
  const paths = [];
  let firstObjectsMs;
  let startupReads;
  for (const rendition of manifest.renditions) {
    for (const object of [rendition.init, ...rendition.segments]) {
      const fetched = await readPath(transport.readBlock, graph.root, object.path);
      const plain = decryptStreamingObject(fetched.bytes, key, manifest, object);
      try { assert.equal(hash(plain), originals[object.path], 'Decrypted fixture differs'); }
      finally { plain.fill(0); }
      paths.push(object.path);
      if (startupReads == null && object.kind === 'media') {
        firstObjectsMs = performance.now() - start;
        startupReads = [...transport.reads];
      }
    }
  }
  // Establish which raw blocks belong only to the archival master, locally.
  const archive = new Set();
  const local = new Map(graph.blocks.map(b => [b.cid, b.bytes]));
  await readPath(async cid => { archive.add(cid); return local.get(cid); }, graph.root, manifest.master.path);
  const masterOnly = new Set(graph.blocks.filter(b => b.codec === 0x55 && archive.has(b.cid)).map(b => b.cid));
  assert.ok(masterOnly.size > 0 && transport.reads.every(r => !masterOnly.has(r.cid)), 'Selective playback fetched the master');
  return {
    verifiedObjects: paths.length, paths, masterFetched: false,
    startupRawReads: startupReads.length, startupBytes: startupReads.reduce((sum, r) => sum + r.bytes, 0),
    firstAuthenticatedObjectsMs: Math.round(firstObjectsMs),
    totalRawReads: transport.reads.length, totalReadBytes: transport.reads.reduce((sum, r) => sum + r.bytes, 0),
    audibleStartupMeasured: false, physicalHostTested: false
  };
}

export function localSigner(fd) {
  assert.ok(Number.isSafeInteger(fd) && fd >= 3, 'Writes require --signer-fd N (N >= 3); never pass a phrase as an argument');
  const input = Buffer.alloc(1025);
  let entropy, mini;
  try {
    let length = 0;
    for (;;) {
      const count = readSync(fd, input, length, input.length - length, null);
      if (!count) break;
      length += count;
      assert.ok(length < input.length, 'Signer input is too large');
    }
    assert.ok(length > 0 && length < 512, 'Missing or oversized local signer input');
    try { entropy = mnemonicToEntropy(input.subarray(0, length).toString().trim()); }
    catch { throw new Error('Invalid local signer input'); }
    mini = entropyToMiniSecret(entropy);
    const pair = sr25519CreateDerive(mini)('');
    assert.equal(ss58Address(pair.publicKey), CANARY_ACCOUNT, 'Signer does not match the approved canary account');
    return getTxCreator(pair.publicKey, 'Sr25519', pair.sign);
  } finally { input.fill(0); entropy?.fill(0); mini?.fill(0); }
}

export async function main(argv) {
  const [command, input, ...options] = argv;
  assert.ok(['prepare', 'check', 'publish', 'reconcile', 'verify', 'renew-now'].includes(command) && input, 'Usage: canary.mjs prepare|check|publish|reconcile|verify|renew-now PRIVATE_DIRECTORY [--signer-fd N]');
  const writing = ['publish', 'renew-now'].includes(command);
  assert.ok(options.length === 0 || writing && options.length === 2 && options[0] === '--signer-fd', 'Unexpected canary arguments');
  const directory = resolve(input);
  if (command === 'prepare') return prepare(directory);
  const fixture = await loadFixture(directory);
  return withLease(directory, async () => {
    // npm scripts do not preserve arbitrary descriptors. Validate the explicit
    // descriptor/account before even opening a network connection.
    const signer = writing ? localSigner(Number(options[1])) : null;
    const client = createClient(getWsProvider(ENDPOINT));
    // Independent wall clock bound; a hard exit leaves the lease for manual reconciliation.
    const watchdog = setTimeout(() => { console.error('Canary exceeded 30 minutes; reconcile the lease and receipts before retrying.'); process.exit(2); }, 30 * 60_000);
    let key;
    try {
      const sdk = signer ? new AsyncBulletinClient(client.getUnsafeApi(), signer, client.submit) : null;
      const transport = liveTransport(client, sdk, CANARY_ACCOUNT);
      const before = await transport.status();
      const checkpoint = join(directory, 'checkpoint');
      const base = { observedAt: new Date().toISOString(), endpoint: ENDPOINT, genesis: transport.genesis, account: transport.account, root: fixture.graph.root, before };
      let result;
      if (command === 'check') {
        const a = before.authorization;
        assert.ok(a.remainingTransactions >= fixture.graph.blocks.length * 2 && a.remainingBytes >= BigInt(fixture.graph.bytes) && a.remainingRenewBytes >= BigInt(fixture.graph.bytes), 'Quota does not cover stores plus one renewal');
        result = { readyForBoundedWrite: true, blocks: fixture.graph.blocks.length, bytes: fixture.graph.bytes, budget: CANARY_BUDGET };
      } else if (command === 'publish' || command === 'reconcile') {
        result = await publish(fixture.graph, transport, checkpoint, CANARY_BUDGET);
      } else if (command === 'renew-now') {
        const requested = await requestRenewal(fixture.graph, transport, checkpoint, CANARY_BUDGET);
        result = { requested, verified: await verifyRenewal(fixture.graph, transport, checkpoint) };
      } else {
        const keyStat = await lstat(join(directory, 'key.bin'));
        assert.ok(keyStat.isFile() && (keyStat.mode & 0o077) === 0 && keyStat.size === 32, 'Content key must be a private regular file');
        key = await readFile(join(directory, 'key.bin'));
        result = await verifyFiles(transport, fixture, key);
      }
      return { ...base, command, result, after: await transport.status(), attemptedTransactions: transport.attemptedTransactions };
    } finally { key?.fill(0); clearTimeout(watchdog); client.destroy(); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(json(await main(process.argv.slice(2)))); }
  catch (error) { console.error(String(error.message).slice(0, 500)); process.exitCode = 1; }
}
