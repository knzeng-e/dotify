// Build the CDM metadata blobs that `cdm install` fetches, and compute their CIDs.
//
// The registry stores `(name -> address)` and `(name -> metadata_uri)`. Without the
// second, another product can resolve where Dotify's contracts are but not what they
// expose, so `cdm install` fails and composability is nominal only. These blobs close
// that gap.
//
// Shape comes from CDM's own consumers, not guesswork:
//   - install validates exactly one thing: `abi` must be a non-empty array
//     (contract-dependency-manager `src/lib/contracts/src/install.ts`);
//   - contracts.dot.li additionally renders `description`, `readme`, `homepage`,
//     `repository`, `license`, `keywords`, `authors`, `dependencies`, `published_at`
//     (`src/apps/frontend/src/data/registry-queries.ts`).
// Everything else is stored verbatim and ignored.
//
// Output is deterministic on purpose. A content-addressed blob whose bytes depend on
// wall-clock time gets a new CID on every run, which makes it impossible to check that
// what is published still matches the repository. `published_at` is therefore opt-in
// via --published-at; omitted by default so `npm run generate:cdm-metadata` twice gives
// byte-identical output and the same CIDs.
//
// Run: npm run generate:cdm-metadata
// Publishing the blobs to Bulletin needs a storage authorization and is a separate,
// credentialed step - see docs/operations/product-devnet-deployment.md.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateCid } from '@parity/product-sdk-cloud-storage';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../..');
const artifactsRoot = resolve(repoRoot, 'contracts/evm/artifacts/contracts');
const outDir = resolve(repoRoot, 'web/src/generated/contracts/cdm-metadata');

// Bulletin's raw codec + blake2b-256, matching @parity/bulletin-sdk defaults.
const CID_CODEC_RAW = 0x55;
const HASH_BLAKE2B_256 = 45600;

const publishedAtArg = process.argv.indexOf('--published-at');
const publishedAt = publishedAtArg !== -1 ? process.argv[publishedAtArg + 1] : null;

const COMMON = {
  homepage: 'https://muzinga.netlify.app',
  repository: 'https://github.com/knzeng-e/dotify',
  license: 'MIT',
  authors: ['Dotify'],
  keywords: ['music', 'dotify', 'artist-runtime', 'access-control']
};

const PACKAGES = [
  {
    name: '@dotify/artist-directory',
    artifact: 'ArtistDirectory.sol/ArtistDirectory.json',
    description: 'Registry mapping each artist address to their owned SmartRuntime. Entry point for enumerating the Dotify catalog.',
    readme: [
      '# @dotify/artist-directory',
      '',
      'Maps an artist address to the address of the SmartRuntime they own, and enumerates',
      'every registered artist.',
      '',
      'Start here to read the Dotify catalog: `artistCount()` and `artistsPage(offset, limit)`',
      'enumerate artists with their runtimes, and `runtimeOf(artist)` resolves one directly.',
      'Each runtime then exposes its own tracks and access policy.',
      '',
      'Registration is performed by the artist runtime factory, not by callers.'
    ].join('\n')
  },
  {
    name: '@dotify/artist-runtime-factory',
    artifact: 'ArtistRuntimeFactory.sol/ArtistRuntimeFactory.json',
    description: 'Deploys one artist-owned SmartRuntime per artist and registers it in the artist directory.',
    readme: [
      '# @dotify/artist-runtime-factory',
      '',
      'Deploys a SmartRuntime for an artist and registers it in `@dotify/artist-directory`.',
      '',
      'A runtime is a diamond: music registry, royalties, access, and NFT pallets are',
      'installed as facets, and the artist is set as its owner. Because each artist owns',
      'their own runtime, catalog, access policy, and royalty splits stay under the',
      "artist's control rather than the platform's.",
      '',
      'Creation is staged - `createRuntime()` then `installRuntimeStep()` until',
      '`pendingRuntimeStageOf(artist)` reports completion - so that installation fits',
      'within block limits.'
    ].join('\n')
  }
];

function readAbi(artifact) {
  const artifactPath = resolve(artifactsRoot, artifact);
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(artifactPath, 'utf8'));
  } catch {
    throw new Error(`Missing artifact ${artifact}. Run "cd contracts/evm && npm run compile" first.`);
  }
  if (!Array.isArray(parsed.abi) || parsed.abi.length === 0) {
    // install.ts rejects an empty ABI, so fail here rather than publish a blob that
    // every consumer will reject after it is already immutable on Bulletin.
    throw new Error(`Artifact ${artifact} has no usable abi array.`);
  }
  return parsed.abi;
}

mkdirSync(outDir, { recursive: true });

const index = {};

for (const pkg of PACKAGES) {
  const metadata = {
    name: pkg.name,
    description: pkg.description,
    readme: pkg.readme,
    abi: readAbi(pkg.artifact),
    ...COMMON,
    ...(publishedAt ? { published_at: publishedAt } : {})
  };

  // Two spaces, trailing newline: the bytes are the identity, so the formatting is
  // part of the contract with the CID and must not drift.
  const bytes = new TextEncoder().encode(`${JSON.stringify(metadata, null, 2)}\n`);
  const cid = (await calculateCid(bytes, CID_CODEC_RAW, HASH_BLAKE2B_256)).toString();

  const fileName = `${pkg.name.replace(/^@/, '').replace(/\//g, '-')}.json`;
  writeFileSync(resolve(outDir, fileName), bytes);

  index[pkg.name] = { file: fileName, cid, bytes: bytes.length };
  console.log(`${pkg.name}\n  file: ${fileName}\n  size: ${bytes.length} bytes\n  cid:  ${cid}\n`);
}

writeFileSync(resolve(outDir, 'cids.json'), `${JSON.stringify(index, null, 2)}\n`);

console.log(`Wrote ${PACKAGES.length} metadata blobs + cids.json into web/src/generated/contracts/cdm-metadata/`);
console.log('CIDs are computed locally and are deterministic; publishing the blobs to Bulletin is a separate credentialed step.');
