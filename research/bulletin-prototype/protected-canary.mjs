// Spawn before importing config/custody/network code: no inherited deployment
// credentials, .env, NODE_OPTIONS or implicit mnemonic. FD 3 only for publish.
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const argv = process.argv.slice(2);
const writing = argv[0] === 'publish';
const at = argv.indexOf('--signer-fd');
const fd = writing && at >= 0 && /^[0-9]+$/.test(argv[at + 1]) ? Number(argv[at + 1]) : null;
if ((writing && (!Number.isSafeInteger(fd) || fd < 3 || fd > 64)) || (!writing && at >= 0)) {
  console.error('Only publish accepts an explicit --signer-fd 3..64');
  process.exitCode = 1;
} else {
  // Resolve all user filesystem paths before changing the child working dir.
  const { resolve } = await import('node:path');
  if (argv[1]) argv[1] = resolve(argv[1]);
  for (const flag of ['--backup', '--destination']) {
    const i = argv.indexOf(flag);
    if (i >= 0 && argv[i + 1]) argv[i + 1] = resolve(argv[i + 1]);
  }
  if (writing) argv[at + 1] = '3';
  const cwd = await mkdtemp(join(tmpdir(), 'dotify-protected-operator-'));
  try {
    process.exitCode = await new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ['--import', import.meta.resolve('tsx'), fileURLToPath(new URL('./protected-entry.mjs', import.meta.url)), ...argv],
        {
          cwd,
          env: { PATH: process.env.PATH ?? '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C', DOTIFY_CHAIN_ID: '420420417', DOTIFY_PROTECTED_OPERATOR: 'isolated' },
          stdio: ['ignore', 'inherit', 'inherit', ...(writing ? [fd] : [])]
        }
      );
      // Child owns graceful cancellation/journals. Parent waits for its close.
      const interrupt = () => child.kill('SIGINT'),
        terminate = () => child.kill('SIGTERM');
      process.on('SIGINT', interrupt);
      process.on('SIGTERM', terminate);
      child.once('error', reject);
      child.once('close', (code, signal) => {
        process.removeListener('SIGINT', interrupt);
        process.removeListener('SIGTERM', terminate);
        resolve(code ?? (signal ? 1 : 0));
      });
    });
  } catch {
    console.error('Operator could not start; no automatic retry. Check descriptor and custody state.');
    process.exitCode = 1;
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}
