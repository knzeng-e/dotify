// Local-only fixture server. Never expose this port through a tunnel/public host.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, lstat } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from '../../web/node_modules/vite/dist/node/index.js';
import { loadFixture } from './canary.mjs';
import { readPath } from './reader.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const sdkDist = resolve(here, '../../web/node_modules/@parity/product-sdk/dist');
export const ORIGIN = 'http://localhost:5278';

export function admitRequest(request) {
  return ['GET', 'HEAD'].includes(request.method) &&
    ['localhost:5278', '127.0.0.1:5278'].includes(request.headers.host) &&
    (!request.headers.origin || [ORIGIN, 'http://127.0.0.1:5278'].includes(request.headers.origin)) &&
    request.headers['sec-fetch-site'] !== 'cross-site';
}

export async function fixturePayload(directory) {
  const fixture = await loadFixture(directory);
  assert.equal(fixture.audioProof?.kind, 'generated-chord-aac-v1', 'Only the generated AAC canary is allowed; never use artist music');
  const keyFile = join(directory, 'key.bin');
  const info = await lstat(keyFile);
  assert.ok(info.isFile() && !(info.mode & 0o077) && info.size === 32, 'Synthetic key must be a private regular file');
  const key = await readFile(keyFile);
  try {
    const blocks = new Map(fixture.graph.blocks.map(b => [b.cid, b.bytes]));
    const archive = new Set();
    const manifest = JSON.parse(new TextDecoder().decode((await readPath(cid => blocks.get(cid), fixture.graph.root, 'manifest.json')).bytes));
    await readPath(cid => { archive.add(cid); return blocks.get(cid); }, fixture.graph.root, manifest.master.path);
    return {
      blocks,
      session: {
        schema: 'dotify.bulletin.host-canary.v1', root: fixture.graph.root,
        scope: fixture.scope, key: [...key], audioProof: fixture.audioProof,
        archiveRawCids: fixture.graph.blocks.filter(b => b.codec === 0x55 && archive.has(b.cid)).map(b => b.cid),
        // This is a locally generated test key, not an access entitlement.
        productionAccessTested: false,
        implementation: {
          sha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: here, encoding: 'utf8' }).trim(),
          dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: here, encoding: 'utf8' }).trim())
        }
      }
    };
  } finally { key.fill(0); }
}

export async function serveFixture(directory) {
  const { blocks, session } = await fixturePayload(directory);
  const server = await createServer({
    configFile: false, envDir: false, envPrefix: 'CANARY_PUBLIC_',
    root: join(here, 'host'), publicDir: false,
    resolve: { alias: {
      '@parity/product-sdk/cloud-storage': join(sdkDist, 'cloud-storage/index.js'),
      '@parity/product-sdk/host': join(sdkDist, 'host/index.js')
    } },
    server: {
      host: '127.0.0.1', port: 5278, strictPort: true, cors: false,
      fs: { strict: true, allow: [resolve(here, '../..')] }
    },
    plugins: [{ name: 'private-generated-aac-fixture', configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!admitRequest(req)) { res.statusCode = 403; res.end('Local same-origin reads only'); return; }
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'no-referrer');
        const url = new URL(req.url, ORIGIN);
        if (url.pathname === '/canary/session') {
          res.setHeader('Content-Type', 'application/json');
          res.end(req.method === 'HEAD' ? undefined : JSON.stringify(session)); return;
        }
        if (url.pathname.startsWith('/canary/block/')) {
          const bytes = blocks.get(url.pathname.slice('/canary/block/'.length));
          if (!bytes) { res.statusCode = 404; res.end(); return; }
          res.setHeader('Content-Type', 'application/octet-stream');
          res.end(req.method === 'HEAD' ? undefined : bytes); return;
        }
        next();
      });
    } }]
  });
  await server.listen();
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    assert.equal(process.argv.length, 3, 'Usage: node --import tsx host-server.mjs PRIVATE_AAC_DIRECTORY');
    await serveFixture(resolve(process.argv[2]));
    console.log(`Generated audio only. Open ${ORIGIN} in Desktop or a browser. No public binding, upload, signer or DotNS change.`);
  } catch (error) { console.error(String(error.message).slice(0, 500)); process.exitCode = 1; }
}
