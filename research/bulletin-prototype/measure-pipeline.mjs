// Offline scheduling evidence, not a speed benchmark or native audio test.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encryptedFixture } from './fixture.mjs';
import { buildDirectory } from './graph.mjs';
import { planPipeline } from './pipeline-plan.mjs';
const directory = await mkdtemp(join(tmpdir(), 'dotify-pipeline-plan-'));
let fixture;
try {
  fixture = await encryptedFixture(directory);
  const graph = await buildDirectory(fixture.files);
  const results = await Promise.all([1, 2, 4].map(concurrency => planPipeline(graph, { concurrency })));
  const evidence = {
    observedAt: new Date().toISOString(),
    synthetic: true,
    networkWrites: 0,
    physicalHostTested: false,
    audibleStartupMeasured: false,
    livePublicationSpeedMeasured: false,
    graph: { blocks: graph.blocks.length, bytes: graph.bytes },
    model: results[0].model,
    schedules: results.map(p => ({
      concurrency: p.concurrency,
      maxInFlightBytes: p.maxInFlightBytes,
      modeledFinalityWaves: p.modeledFinalityWaves,
      peakWaveBytes: Math.max(...p.waves.map(w => w.bytes))
    }))
  };
  await writeFile(new URL('./pipeline-results.json', import.meta.url), JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  fixture?.key.fill(0);
  await rm(directory, { recursive: true, force: true });
}
