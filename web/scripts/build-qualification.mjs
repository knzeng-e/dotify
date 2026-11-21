import { build, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, readdirSync, statSync, renameSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative } from 'node:path';
import { readGitBuildIdentity, computeBuildConfigDigest, resolveEmbeddedBuildIdentity } from './build-identity.mjs';
import { assertQualificationBuild, assertQualificationGraph, QUALIFICATION_PRODUCT_ID, QUALIFICATION_APP_VERSION } from './qualification-profile.mjs';

const root = process.cwd();
const env = { ...loadEnv('qualification', root, ''), ...process.env };
const identity = readGitBuildIdentity(root);
assertQualificationBuild(identity, env);
resolveEmbeddedBuildIdentity('build', env, identity);
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const sdk = { product: pkg.dependencies['@parity/product-sdk'], host: pkg.dependencies['@parity/product-sdk-host'], truapi: pkg.overrides['@parity/truapi'] };
const digest = computeBuildConfigDigest(
  'qualification',
  {},
  { source: identity.gitSha, productId: QUALIFICATION_PRODUCT_ID, appVersion: QUALIFICATION_APP_VERSION, ...sdk }
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
    'import.meta.env.VITE_DOTIFY_PRODUCT_APP_VERSION': JSON.stringify(QUALIFICATION_APP_VERSION.join('.')),
    'import.meta.env.VITE_DOTIFY_QUALIFICATION_SDK': JSON.stringify(JSON.stringify(sdk))
  },
  build: { outDir: 'dist-qualification', target: 'esnext', rollupOptions: { input: resolve(root, 'qualification.html') } }
});
assertQualificationGraph(Array.isArray(result) ? result : [result]);
const out = resolve(root, 'dist-qualification');
renameSync(resolve(out, 'qualification.html'), resolve(out, 'index.html'));
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
  appVersion: QUALIFICATION_APP_VERSION,
  purpose: 'host-info-only',
  sdk,
  files: files(out)
};
if (manifest.files.length > 100 || manifest.files.reduce((n, file) => n + file.bytes, 0) > 3 * 1024 * 1024)
  throw new Error('Qualification exceeds its file/byte envelope');
writeFileSync(resolve(out, 'qualification-build.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Read-only qualification built from ${identity.gitSha}; ${manifest.files.length} byte-hashed files. No publication performed.`);
