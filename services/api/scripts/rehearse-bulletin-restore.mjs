#!/usr/bin/env node
// Only public generated fixtures; never accepts a custody directory or key.
import { writeFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { prepareRestoreRehearsal, restoreRehearsal } from '../src/services/bulletinRestoreRehearsal.fixture.ts';
const [mode, file, digest, ...extra] = process.argv.slice(2);
if (!isAbsolute(file ?? '') || extra.length || !['prepare', 'restore'].includes(mode) || (mode === 'prepare' ? digest !== undefined : !digest))
  throw new Error('Usage: prepare ABSOLUTE_GENERATED_BUNDLE | restore ABSOLUTE_GENERATED_BUNDLE EXPECTED_SHA256');
if (mode === 'prepare') {
  const result = await prepareRestoreRehearsal();
  await writeFile(file, result.bytes, { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ schema: 'dotify.generated-bulletin-backup-report.v1', sha256: result.sha256, bytes: result.bytes.length, syntheticOnly: true }));
} else console.log(JSON.stringify(await restoreRehearsal(file, digest)));
