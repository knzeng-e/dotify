// Exercise the exact CLI dependency boundary whose major override we carry.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writePackage, updatePackage, updatePackageSync } from 'write-package';

test('PAPI package updates preserve nested fields through the scoped deepmerge override', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'dotify-package-compat-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'package.json');
  await writePackage(file, {
    name: 'synthetic-codegen-fixture',
    version: '1.0.0',
    dependencies: { old: '1' },
    scripts: { build: 'fixture' },
    exports: { '.': './index.js' }
  });
  await updatePackage(file, { dependencies: { added: '2' }, exports: { './types': './types.js' } });
  updatePackageSync(file, { dependencies: { old: '3' }, scripts: { test: 'fixture' } });
  const result = JSON.parse(await readFile(file, 'utf8'));
  assert.deepEqual(result.dependencies, { old: '3', added: '2' });
  assert.deepEqual(result.scripts, { build: 'fixture', test: 'fixture' });
  assert.deepEqual(result.exports, { '.': './index.js', './types': './types.js' });
});
