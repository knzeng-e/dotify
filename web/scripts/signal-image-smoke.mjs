// Check the actual production image after its production-only npm install.
// No published port, mounted state, wallet, key or external network is needed.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const image = process.argv[2];
if (!image || image.startsWith('-')) throw new Error('Supply the local signaling image tag');
const name = `dotify-signal-smoke-${randomUUID()}`;
const docker = args => execFileSync('docker', args, { encoding: 'utf8', timeout: 30_000 });
const probe = `
  const { default: assert } = await import('node:assert/strict');
  assert.equal(process.getuid(), 1000, 'the signaling image must run as node');
  let health;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const response = await fetch('http://127.0.0.1:8788/health', { signal: AbortSignal.timeout(500) });
      assert.equal(response.status, 200);
      health = await response.json();
      break;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  assert.ok(health, 'the isolated signaling image did not become healthy');
  assert.equal(health.ok, true);
  assert.equal(health.nearbyEnabled, true);
  assert.equal(health.rooms, 0);
  console.log('production-only signaling image: non-root startup and health passed');
`;

let created = false;
try {
  docker(['run', '--detach', '--network', 'none', '--name', name, '--env', 'SIGNAL_HOST=127.0.0.1', '--env', 'SIGNAL_PORT=8788', image]);
  created = true;
  process.stdout.write(docker(['exec', name, 'node', '--input-type=module', '-e', probe]));
} finally {
  // The name belongs only to this invocation; never remove another container.
  if (created) execFileSync('docker', ['rm', '--force', name], { stdio: 'ignore', timeout: 10_000 });
}
