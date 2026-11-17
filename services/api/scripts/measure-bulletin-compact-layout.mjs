// Fixed synthetic inputs only. No file arguments, artist media, app/config,
// network transport, key vault, signer or permanent nonce ledger is imported.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compactFixture } from './research/compactLayoutFixture.mjs';
import { buildResearchGraph, packRenditions, readPackedObject } from './research/bulletinCompactLayout.mjs';
import { buildBulletinDirectoryGraph, readBulletinMediaPath } from '../src/services/bulletinGraph.ts';
import { planBulletinWaves } from '../src/services/bulletinPipeline.ts';
import { decryptStreamingObject, verifyStreamingManifest } from '../src/services/streamingFormat.ts';

assert.equal(process.argv.length, 2, 'This research command accepts no input paths or options');
const signal = () => new AbortController().signal;
const pipeline = { concurrency: 2, maxInFlightBytes: 524288, writeWindow: { concurrency: 16, maxInFlightBytes: 4194304 } };
const cases = [
  ['small-archive-23-segments', { masterBytes: 2302865, segments: 23 }],
  ['medium-archive-29-segments', { masterBytes: 2781953, segments: 29 }],
  ['large-archive-25-segments', { masterBytes: 17045850, segments: 25 }]
];
const results = [];
for (const [name, parameters] of cases) {
  const fixture = compactFixture(parameters);
  verifyStreamingManifest(fixture.manifest, fixture.key, fixture.scope);
  const original = new Map(fixture.files.map(f => [f.path, f.bytes]));
  const variants = [];
  for (const mode of ['standard', 'packed-segments', 'packed-after-first'])
    for (const chunkSize of [256 * 1024, 512 * 1024]) {
      const files = mode === 'standard' ? fixture.files : packRenditions(fixture.files, chunkSize, mode === 'packed-after-first').files;
      const raw = await buildResearchGraph(files, chunkSize, signal());
      if (mode === 'standard' && chunkSize === 256 * 1024) assert.deepEqual(raw, await buildBulletinDirectoryGraph(fixture.files, signal()));
      const graph = { ...raw, scope: fixture.scope, generation: fixture.manifest.generation };
      const schedule = planBulletinWaves(graph, pipeline),
        byCid = new Map(graph.blocks.map(b => [b.cid, b.bytes]));
      const read = async cid => {
        assert(byCid.has(cid));
        return byCid.get(cid);
      };
      const reads = [];
      for (const rendition of fixture.manifest.renditions) {
        const selected = [rendition.init, ...[0, Math.floor(parameters.segments / 2), parameters.segments - 1].map(i => rendition.segments[i])];
        for (const object of selected) {
          let value;
          if (mode !== 'standard') value = await readPackedObject(read, graph.root, fixture.manifestBytes, object.path, object.encryptedLength, signal());
          else {
            let calls = 0,
              fetched = 0;
            const bytes = await readBulletinMediaPath(
              async (cid, s) => {
                const b = await read(cid, s);
                calls++;
                fetched += b.length;
                return b;
              },
              graph.root,
              object.path,
              object.encryptedLength,
              signal()
            );
            value = { bytes, reads: calls, fetchedBytes: fetched };
          }
          assert.deepEqual(value.bytes, original.get(object.path));
          assert.deepEqual(decryptStreamingObject(value.bytes, fixture.key, fixture.manifest, object), fixture.plain.get(object.path));
          reads.push({
            quality: rendition.bitrateKbps,
            object: object.kind === 'init' ? 'init' : object.index === 0 ? 'first' : object.index === parameters.segments - 1 ? 'last' : 'middle',
            objectBytes: object.encryptedLength,
            blockReads: value.reads,
            fetchedBytes: value.fetchedBytes
          });
        }
      }
      variants.push({
        mode,
        chunkSize,
        files: files.length,
        blocks: graph.blocks.length,
        bytes: graph.bytes,
        fileOrderWaves: schedule.legacyWaveCount,
        selectedWaves: schedule.waveCount,
        peakWaveBytes: Math.max(...schedule.waves.map(w => w.bytes)),
        sampledObjectsRoundTrip: true,
        originalManifestAndArchiveRetained: true,
        coldObjectReads: reads
      });
    }
  results.push({ name, masterBytes: parameters.masterBytes, segmentsPerRendition: parameters.segments, variants });
}
const syntheticFile = (path, size) => ({ path, bytes: createHash('shake256', { outputLength: size }).update(path).digest() });
const publicAssets = [];
for (const [name, files] of [
  [
    'cover',
    ['placeholder.webp', '64.webp', '160.webp', '320.webp', '640.webp', 'original.jpg'].map((n, i) =>
      syntheticFile(`cover/${n}`, [200, 800, 2000, 8000, 32000, 97000][i])
    )
  ],
  ['metadata', [syntheticFile('release.json', 1024)]]
]) {
  const variants = [];
  for (const chunkSize of [256 * 1024, 512 * 1024]) {
    const graph = {
      ...(await buildResearchGraph(files, chunkSize, signal())),
      scope: { chainId: 1, runtimeAddress: '0x' + '11'.repeat(20), contentHash: '0x' + '22'.repeat(32), keyVersion: 'dotify-content-key-v3' },
      generation: 'public-synthetic'
    };
    const plan = planBulletinWaves(graph, pipeline);
    variants.push({ chunkSize, blocks: graph.blocks.length, bytes: graph.bytes, waves: plan.waveCount });
  }
  publicAssets.push({ name, variants });
}
console.log(
  JSON.stringify(
    {
      schema: 'dotify.bulletin.compact-layout-study.v1',
      synthetic: true,
      artistInputUsed: false,
      networkWrites: 0,
      productionKeysRead: false,
      permanentNonceStateUsed: false,
      productionReaderOrWriterChanged: false,
      pipeline,
      results,
      publicAssets,
      limitations: [
        'Equal-duration waves and cold fetched-byte counts, not an ETA, network benchmark or physical-device first-sound measurement.',
        'Packed segments require a new explicit storage-layout/reference contract and range-aware Web/API/Host readers; old paths do not work.',
        'Ciphertext and authentication round-trip is verified with synthetic bytes, not AAC decoding, seeking, adaptive quality or Room playback.',
        'Fewer stores can amplify a cold segment read by fetching whole verified chunks. Init stays separate; packed-after-first also retains the first media segment.',
        'Packed cold counts include layout/manifest revalidation; standard cold counts use existing per-path reads. These are not a warmed playback profile.',
        'The original encrypted archive and all renditions are retained. Cover/metadata paths and their stage tail remain unchanged.',
        'No admission, budget, journal, deployed format, retention check or finalized child/root barrier is changed.'
      ]
    },
    null,
    2
  )
);
