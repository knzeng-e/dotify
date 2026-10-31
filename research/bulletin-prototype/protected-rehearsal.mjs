// Run the cross-package trust rehearsal without inheriting deployment credentials,
// database settings, NODE_OPTIONS or a repository .env. No listener is opened.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const canary = process.argv.length === 3 && process.argv[2] === '--canary';
if (process.argv.length > 2 && !canary) throw new Error('Unexpected rehearsal arguments');
const tests = canary ? ['protected-canary.test.mjs', 'protected-socket.test.mjs'] : ['protected-release.test.mjs'];
const cwd = await mkdtemp(join(tmpdir(), 'dotify-protected-rehearsal-'));
try {
  const code = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--import', import.meta.resolve('tsx'), '--test', ...tests.map(name => fileURLToPath(new URL(name, import.meta.url)))],
      {
        cwd,
        env: {
          PATH: process.env.PATH ?? '/usr/bin:/bin',
          LANG: 'C',
          LC_ALL: 'C',
          DOTIFY_CHAIN_ID: '420420417',
          DOTIFY_PROTECTED_REHEARSAL: 'isolated-offline'
        },
        stdio: 'inherit'
      }
    );
    child.once('error', reject);
    child.once('exit', (status, signal) => resolve(status ?? (signal ? 1 : 0)));
  });
  process.exitCode = code;
} finally {
  await rm(cwd, { recursive: true, force: true });
}
