// Builds a standalone diagnostic. No deployment, signer, artist key or network write.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, lstat, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CID } from 'multiformats/cid';
import { loadFixture, verifyFiles } from './canary.mjs';
import { generatedWav } from './aac-fixture.mjs';
import { fixtureProfile } from './fixture-profile.mjs';
import { readPath } from './reader.mjs';
import { BLAKE2B256 } from './hashes.mjs';
import { parseStreamingManifest, verifyStreamingManifest, decryptStreamingObject } from '../../services/api/src/services/streamingFormat.ts';
const here = dirname(fileURLToPath(import.meta.url));

export async function mobilePayload(directory, { acknowledgePublicTestKey = false, profile: profileId = 'short' } = {}) {
  const profile = fixtureProfile(profileId);
  assert.equal(acknowledgePublicTestKey, true, 'Explicit --allow-public-generated-key required: the synthetic key becomes public');
  const fixture = await loadFixture(directory, { profile: profile.id });
  assert.equal(fixture.audioProof?.kind, profile.kind, 'Only the generated AAC chord is allowed');
  assert.equal(fixture.audioProof.durationSeconds, profile.durationSeconds);
  const expectedMaster = generatedWav(profile.durationSeconds);
  assert.equal(fixture.audioProof.sourceSha256, createHash('sha256').update(expectedMaster).digest('hex'), 'Generated source identity changed');
  assert.ok(
    fixture.graph.blocks.every(b => CID.parse(b.cid).multihash.code === BLAKE2B256),
    'Mobile diagnostic requires BLAKE2b addressing'
  );
  const keyPath = join(directory, 'key.bin');
  const info = await lstat(keyPath);
  assert.ok(info.isFile() && !(info.mode & 0o077) && info.size === 32, 'Synthetic key must be a private regular file');
  const key = await readFile(keyPath);
  try {
    const blocks = new Map(fixture.graph.blocks.map(b => [b.cid, b.bytes]));
    const used = new Set();
    const read = async cid => {
      assert.ok(blocks.has(cid));
      used.add(cid);
      return blocks.get(cid);
    };
    const manifest = parseStreamingManifest((await readPath(read, fixture.graph.root, 'manifest.json')).bytes);
    verifyStreamingManifest(manifest, key, fixture.scope);
    const archive = new Set();
    const masterBytes = (
      await readPath(
        cid => {
          archive.add(cid);
          return blocks.get(cid);
        },
        fixture.graph.root,
        manifest.master.path,
        { maxBytes: profile.archiveReadBytes }
      )
    ).bytes;
    const master = decryptStreamingObject(masterBytes, key, manifest, manifest.master);
    try {
      assert.ok(master.equals(expectedMaster), 'Refusing to distribute anything except the reproducible generated chord');
    } finally {
      master.fill(0);
    }
    const transport = {
      reads: [],
      readBlock: async cid => {
        const bytes = await read(cid);
        transport.reads.push({ cid, bytes: bytes.length });
        return bytes;
      }
    };
    await verifyFiles(transport, fixture, key, { profile: profile.id });
    const archiveRawCids = fixture.graph.blocks.filter(b => b.codec === 0x55 && archive.has(b.cid)).map(b => b.cid);
    assert.ok(
      archiveRawCids.every(cid => !used.has(cid)),
      'The bundled decoder control must exclude the master'
    );
    // An explicit projection: never serialize operator state, journal, path, signer or ledger.
    return {
      session: {
        schema: 'dotify.bulletin.host-canary.v1',
        fixtureProfile: profile.id,
        root: fixture.graph.root,
        scope: Object.fromEntries(['chainId', 'runtimeAddress', 'contentHash', 'keyVersion'].map(field => [field, fixture.scope[field]])),
        key: [...key],
        audioProof: {
          kind: profile.kind,
          durationSeconds: profile.durationSeconds,
          sourceSha256: fixture.audioProof.sourceSha256
        },
        archiveRawCids,
        productionAccessTested: false,
        implementation: {
          sha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: here, encoding: 'utf8' }).trim(),
          dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: here, encoding: 'utf8' }).trim())
        }
      },
      controlBlocks: Object.fromEntries([...used].map(cid => [cid, Buffer.from(blocks.get(cid)).toString('base64')])),
      publicGeneratedKey: true,
      productionStorageActivated: false
    };
  } finally {
    key.fill(0);
    expectedMaster.fill(0);
  }
}

export async function buildMobile(directory, output, options) {
  const payload = await mobilePayload(directory, options);
  const { build } = await import('../../web/node_modules/vite/dist/node/index.js');
  await mkdir(output, { mode: 0o700 }); // Never overwrite a fixture, deployed app or prior diagnostic.
  const sdk = resolve(here, '../../web/node_modules/@parity/product-sdk/dist');
  await build({
    configFile: false,
    envDir: false,
    envPrefix: 'CANARY_PUBLIC_',
    publicDir: false,
    root: join(here, 'mobile'),
    base: './',
    resolve: {
      alias: {
        '@parity/product-sdk/cloud-storage': join(sdk, 'cloud-storage/index.js'),
        '@parity/product-sdk/host': join(sdk, 'host/index.js')
      }
    },
    plugins: [
      {
        name: 'verified-generated-only-fixture',
        resolveId(id) {
          if (id === 'virtual:generated-fixture') return '\0generated-fixture';
          if (id === 'virtual:decoder-blocks') return '\0decoder-blocks';
        },
        load(id) {
          if (id === '\0generated-fixture') {
            const { controlBlocks, ...identity } = payload;
            return `export default ${JSON.stringify(identity)}`;
          }
          if (id === '\0decoder-blocks') return `export default ${JSON.stringify(payload.controlBlocks)}`;
        }
      }
    ],
    build: {
      outDir: resolve(output),
      emptyOutDir: false,
      target: 'esnext',
      sourcemap: false,
      rollupOptions: { output: { manualChunks: id => (id === '\0decoder-blocks' ? 'decoder-control' : undefined) } }
    }
  });
  const summary = {
    schema: 'dotify.bulletin.mobile-package.v1',
    implementation: payload.session.implementation,
    root: payload.session.root,
    fixtureProfile: payload.session.fixtureProfile,
    durationSeconds: payload.session.audioProof.durationSeconds,
    publicGeneratedKey: true,
    requiresSeparateDestinationApproval: true,
    networkWrites: 0,
    controlBlocks: Object.keys(payload.controlBlocks).length,
    productionStorageActivated: false
  };
  await writeFile(join(output, 'diagnostic-build.json'), JSON.stringify(summary, null, 2), { flag: 'wx', mode: 0o600 });
  return summary;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [source, output, acknowledgement, ...extra] = process.argv.slice(2);
    assert.ok(
      source && output && !extra.length && acknowledgement === '--allow-public-generated-key',
      'Usage: mobile-package.mjs PRIVATE_GENERATED_BLAKE_FIXTURE NEW_OUTPUT --allow-public-generated-key'
    );
    console.log(JSON.stringify(await buildMobile(resolve(source), resolve(output), { acknowledgePublicTestKey: true }), null, 2));
  } catch (error) {
    console.error(String(error.message).slice(0, 500));
    process.exitCode = 1;
  }
}
