// Run the cross-package trust rehearsal without inheriting deployment credentials,
// database settings, NODE_OPTIONS or a repository .env. No listener is opened.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = await mkdtemp(join(tmpdir(), 'dotify-protected-rehearsal-'));
try {
  const code = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--import', import.meta.resolve('tsx'), '--test', fileURLToPath(new URL('./protected-release.test.mjs', import.meta.url))],
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
