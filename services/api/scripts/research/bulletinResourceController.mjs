// Executed as Node stdin inside the production API image, never bundled there.
// All media/keys/authority below are public synthetic fixtures.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { blake2b } from '@noble/hashes/blake2';
import { CID } from 'multiformats/cid';
import { StreamingJobs, initializeStreamingJobs } from './dist/services/streamingJobs.js';
import { createStreamingWorkerClient } from './dist/services/streamingWorkerClient.js';
import { buildBulletinMediaGraph, readBulletinMediaPath } from './dist/services/bulletinGraph.js';
import { buildBulletinCompactMediaGraph } from './dist/services/bulletinCompactGraph.js';
import { readAuthenticatedCompactObject } from './dist/services/bulletinCompactReader.js';
import { formatStreamingReference } from './dist/services/streamingReference.js';
import { parseStreamingManifest, verifyStreamingManifest, decryptStreamingObject } from './dist/services/streamingFormat.js';

const seconds = Number(process.env.DOTIFY_RESOURCE_SECONDS);
const layout = process.env.DOTIFY_RESOURCE_LAYOUT;
assert.ok([97, 900].includes(seconds) && ['unixfs-files-v1', 'rendition-pack-v1'].includes(layout));
assert.equal(process.getuid(), 1000);
const MiB = 1024 * 1024;
const limit = Number(await readFile('/sys/fs/cgroup/memory.max', 'utf8'));
assert.equal(limit, 1024 * MiB);
const phases = [];
function observe(phase) {
  const { rss, heapUsed, external, arrayBuffers } = process.memoryUsage();
  phases.push({
    phase,
    rssBytes: rss,
    heapUsedBytes: heapUsed,
    externalBytes: external,
    arrayBufferBytes: arrayBuffers,
    processPeakRssKiB: process.resourceUsage().maxRSS
  });
}
observe('start');
const endpoint = 'http://encoder.internal:8791';
for (let n = 0; ; n++) {
  try {
    await fetch(endpoint, { signal: AbortSignal.timeout(1000) });
    break;
  } catch {
    assert.ok(n < 60, 'Synthetic encoder failed to become reachable');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
const sampleRate = seconds === 900 ? 24000 : 48000;
const frames = sampleRate * seconds;
const source = Buffer.alloc(44 + frames * 2);
source.write('RIFF');
source.writeUInt32LE(source.length - 8, 4);
source.write('WAVEfmt ', 8);
source.writeUInt32LE(16, 16);
source.writeUInt16LE(1, 20);
source.writeUInt16LE(1, 22);
source.writeUInt32LE(sampleRate, 24);
source.writeUInt32LE(sampleRate * 2, 28);
source.writeUInt16LE(2, 32);
source.writeUInt16LE(16, 34);
source.write('data', 36);
source.writeUInt32LE(frames * 2, 40);
for (let n = 0; n < frames; n++) source.writeInt16LE(Math.round(Math.sin((n * 2 * Math.PI * 440) / sampleRate) * 2000), 44 + n * 2);
const key = Buffer.alloc(32, 31);
const scope = {
  chainId: 420420417,
  runtimeAddress: `0x${'12'.repeat(20)}`,
  contentHash: `0x${Buffer.from(blake2b(source, { dkLen: 32 })).toString('hex')}`,
  keyVersion: 'dotify-content-key-v3'
};
observe('generated-source');
const owner = `0x${'34'.repeat(20)}`;
const signal = new AbortController().signal;
let publication;
let graphRoot;
await initializeStreamingJobs('/state/streaming');
const queue = new StreamingJobs({
  directory: '/state/streaming',
  deriveKey: () => Buffer.from(key),
  authority: async () => true,
  transcode: createStreamingWorkerClient(endpoint, process.env.STREAMING_WORKER_TOKEN),
  pin: async files => {
    observe('encrypted-output');
    const manifestBytes = files.find(file => file.path === 'manifest.json').bytes;
    const manifest = parseStreamingManifest(manifestBytes);
    verifyStreamingManifest(manifest, key, scope);
    assert.ok(Math.abs(manifest.durationSeconds - seconds) < 0.1);
    const graphStart = performance.now();
    const graph = await (layout === 'rendition-pack-v1' ? buildBulletinCompactMediaGraph : buildBulletinMediaGraph)(files, signal);
    const graphMs = Math.round(performance.now() - graphStart);
    graphRoot = graph.root;
    observe('built-graph');
    const blocks = new Map(graph.blocks.map(block => [block.cid, block.bytes]));
    let readBytes = 0;
    const readBlock = async cid => {
      const bytes = blocks.get(cid);
      assert.ok(bytes, 'Generated graph dependency missing');
      readBytes += bytes.length;
      return bytes;
    };
    const archived = await readBulletinMediaPath(readBlock, graph.root, manifest.master.path, manifest.master.encryptedLength, signal);
    const original = decryptStreamingObject(archived, key, manifest, manifest.master);
    assert.deepEqual(original, source);
    original.fill(0);
    observe('authenticated-archive');
    let objects = 0;
    const readStart = performance.now();
    for (const rendition of manifest.renditions) {
      // Start cold at the last object, then read init and the entire sequence.
      // This covers packed tail offsets as well as ordinary ordered consumption.
      for (const object of [rendition.segments.at(-1), rendition.init, ...rendition.segments]) {
        const encrypted =
          layout === 'rendition-pack-v1'
            ? await readAuthenticatedCompactObject({
                readBlock,
                root: graph.root,
                manifestBytes,
                key,
                scope,
                objectPath: object.path,
                maxBytes: object.encryptedLength,
                signal
              })
            : await readBulletinMediaPath(readBlock, graph.root, object.path, object.encryptedLength, signal);
        const clear = decryptStreamingObject(encrypted, key, manifest, object);
        assert.ok(clear.length > 0);
        clear.fill(0);
        objects++;
      }
      observe(`authenticated-${rendition.bitrateKbps}`);
    }
    assert.equal(
      objects,
      manifest.renditions.reduce((count, rendition) => count + rendition.segments.length + 2, 0)
    );
    publication = {
      graphBlocks: graph.blocks.length,
      graphBytes: graph.bytes,
      graphMs,
      authenticatedReadMs: Math.round(performance.now() - readStart),
      playbackObjectReads: objects,
      logicalBlockReadBytes: readBytes
    };
    return graph.root;
  },
  audioReference: async (_scope, root) => formatStreamingReference(root, scope.keyVersion, layout, value => CID.parse(value))
});
const started = performance.now();
try {
  await queue.start(false);
  const job = await queue.enqueue({ owner, scope, master: source });
  await queue.runNext();
  const ready = queue.get(job.id, owner, scope.chainId);
  assert.equal(ready.state, 'ready');
  assert.equal(
    ready.result.ref,
    formatStreamingReference(graphRoot, scope.keyVersion, layout, value => CID.parse(value))
  );
  assert.ok(publication);
} finally {
  await queue.stop();
  key.fill(0);
}
observe('ready');
const peak = Number(await readFile('/sys/fs/cgroup/memory.peak', 'utf8'));
const events = Object.fromEntries(
  (await readFile('/sys/fs/cgroup/memory.events', 'utf8'))
    .trim()
    .split('\n')
    .map(line => line.split(/\s+/).map((value, i) => (i ? Number(value) : value)))
);
assert.ok(Number.isSafeInteger(peak) && peak > 0 && peak <= limit);
assert.equal(events.oom, 0);
assert.equal(events.oom_kill, 0);
console.log(
  JSON.stringify({
    schema: 'dotify.generated-bulletin-resource-controller.v1',
    seconds,
    layout,
    sourceBytes: source.length,
    elapsedMs: Math.round(performance.now() - started),
    ...publication,
    phases,
    cgroup: { limitBytes: limit, observedPeakBytes: peak, events },
    productionAccessTested: false,
    networkStores: 0,
    syntheticOnly: true
  })
);
