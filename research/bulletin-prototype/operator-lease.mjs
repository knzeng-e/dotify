import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GENESIS } from './graph.mjs';
import { CANARY_ACCOUNT } from './live-transport.mjs';
import { withLease } from './canary.mjs';

/** Coordinates this CLI across fixtures. Other tools/wallets must remain idle. */
export async function withAccountLease(run, { parent = tmpdir() } = {}) {
  const id = createHash('sha256').update(`${GENESIS}:${CANARY_ACCOUNT}`).digest('hex').slice(0, 32);
  const directory = join(parent, `dotify-bulletin-pipeline-${process.getuid()}-${id}`);
  try {
    await mkdir(directory, { mode: 0o700 });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  const info = await lstat(directory);
  assert.ok(info.isDirectory() && !(info.mode & 0o077) && info.uid === process.getuid(), 'Account lease must be an owned private directory');
  return withLease(directory, run);
}
