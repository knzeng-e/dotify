import { build, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, readdirSync, statSync, renameSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative } from 'node:path';
import { readGitBuildIdentity, computeBuildConfigDigest, resolveEmbeddedBuildIdentity } from './build-identity.mjs';
import {
  assertQualificationBuild,
  assertQualificationGraph,
  QUALIFICATION_PRODUCT_ID,
  QUALIFICATION_APP_VERSION,
  ACCOUNT_QUALIFICATION_APP_VERSION,
  ARTIST_QUALIFICATION_APP_VERSION
} from './qualification-profile.mjs';

const root = process.cwd();
const args = process.argv.slice(2);
if (args.some(arg => !['--account', '--artist'].includes(arg)) || args.length > 1) throw new Error('Unknown qualification build argument');
const account = args.includes('--account');
const artist = args.includes('--artist');
const profile = artist ? 'artist-qualification' : account ? 'account-qualification' : 'qualification';
const purpose = artist ? 'host-artist-runtime-only' : account ? 'host-account-addresses-only' : 'host-info-only';
const appVersion = artist ? ARTIST_QUALIFICATION_APP_VERSION : account ? ACCOUNT_QUALIFICATION_APP_VERSION : QUALIFICATION_APP_VERSION;
const entry = `${profile}.html`;
const outputDirectory = `dist-${profile}`;
const env = { ...loadEnv('qualification', root, ''), ...process.env };
const identity = readGitBuildIdentity(root);
assertQualificationBuild(identity, env);
resolveEmbeddedBuildIdentity('build', env, identity);
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const sdk = { product: pkg.dependencies['@parity/product-sdk'], host: pkg.dependencies['@parity/product-sdk-host'], truapi: pkg.overrides['@parity/truapi'] };
const digest = computeBuildConfigDigest(
  profile,
  {},
  {
    source: identity.gitSha,
    productId: QUALIFICATION_PRODUCT_ID,
    appVersion,
    ...(account || artist ? { purpose, derivationIndex: 0, ss58Prefix: 42 } : {}),
    ...sdk
  }
);
const result = await build({
  configFile: false,
  root,
  mode: 'qualification',
  envPrefix: 'DOTIFY_QUALIFICATION_PUBLIC_',
  base: './',
  publicDir: false,
  plugins: [react()],
  define: {
    'import.meta.env.VITE_DOTIFY_BUILD_SHA': JSON.stringify(identity.gitSha),
    'import.meta.env.VITE_DOTIFY_BUILD_CLEAN': JSON.stringify('true'),
    'import.meta.env.VITE_DOTIFY_BUILD_CONFIG_DIGEST': JSON.stringify(digest),
    'import.meta.env.VITE_DOTIFY_PRODUCT_APP_VERSION': JSON.stringify(appVersion.join('.')),
    'import.meta.env.VITE_DOTIFY_QUALIFICATION_SDK': JSON.stringify(JSON.stringify(sdk))
  },
  build: { outDir: outputDirectory, target: 'esnext', rollupOptions: { input: resolve(root, entry) } }
});
assertQualificationGraph(Array.isArray(result) ? result : [result], purpose);
const out = resolve(root, outputDirectory);
renameSync(resolve(out, entry), resolve(out, 'index.html'));
function files(directory) {
  return readdirSync(directory)
    .sort()
    .flatMap(name => {
      const file = resolve(directory, name);
      if (statSync(file).isDirectory()) return files(file);
      const bytes = readFileSync(file);
      return [{ path: relative(out, file), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }];
    });
}
const manifest = {
  schema: 'dotify.host-qualification-artifact.v1',
  source: identity.gitSha,
  clean: true,
  configDigest: digest,
  productId: QUALIFICATION_PRODUCT_ID,
  appVersion,
  purpose,
  sdk,
  files: files(out)
};
if (manifest.files.length > 100 || manifest.files.reduce((n, file) => n + file.bytes, 0) > (artist ? 12 : 3) * 1024 * 1024)
  throw new Error('Qualification exceeds its file/byte envelope');
writeFileSync(resolve(out, 'qualification-build.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`${purpose} built from ${identity.gitSha}; ${manifest.files.length} byte-hashed files. No publication performed.`);
