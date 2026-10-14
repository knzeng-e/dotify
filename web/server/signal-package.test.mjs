import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

test('signaling boots with only the runtime directories copied by its Dockerfile', async () => {
  const web = fileURLToPath(new URL('../', import.meta.url));
  const packaged = mkdtempSync(join(tmpdir(), 'dotify-signal-package-'));
  let server;
  try {
    // Use the actual COPY rules, not the source checkout's full directory tree.
    const dockerfile = readFileSync(join(web, 'Dockerfile.signal'), 'utf8');
    for (const [, source, destination] of dockerfile.matchAll(/^COPY (server|shared) \.\/([a-z-]+)$/gm)) {
      cpSync(join(web, source), join(packaged, destination), { recursive: true });
    }
    symlinkSync(join(web, 'node_modules'), join(packaged, 'node_modules'), 'dir');
    const { startSignalingServer } = await import(pathToFileURL(join(packaged, 'server/signaling.mjs')).href);
    server = startSignalingServer({ host: '127.0.0.1', port: 0, logger: () => {} });
    const port = await server.listen();
    const health = await (await fetch(`http://127.0.0.1:${port}/health`)).json();
    assert.equal(health.ok, true);
    assert.equal(health.nearbyEnabled, true);
    assert.equal(health.rooms, 0);
  } finally {
    await server?.close();
    rmSync(packaged, { recursive: true, force: true });
  }
});
