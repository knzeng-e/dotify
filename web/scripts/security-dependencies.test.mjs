// Exercise the exact CLI dependency boundary whose major override we carry.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm, writeFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseForESLint, clearCaches } from '@typescript-eslint/parser';
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

test('TypeScript project-service allowlisting keeps dotfile matching and rejects unlisted files', async t => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'dotify-parser-compat-')));
  t.after(async () => {
    clearCaches();
    await rm(directory, { recursive: true, force: true });
  });
  await writeFile(join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true }, files: ['included.ts'] }));
  await writeFile(join(directory, 'included.ts'), 'export {};');
  const code = 'export const answer: number = "not a number";';
  await writeFile(join(directory, '.settings.ts'), code);
  await writeFile(join(directory, 'unlisted.js'), 'export const answer = 42;');
  const options = {
    tsconfigRootDir: directory,
    projectService: { allowDefaultProject: ['*.ts'] },
    sourceType: 'module'
  };
  // This exercises the actual parser consumer of minimatch (with dot:true),
  // rather than substituting a standalone pattern helper for the integration.
  const parsed = parseForESLint(code, { ...options, filePath: join(directory, '.settings.ts') });
  assert.ok(parsed.services.program);
  assert.ok(parsed.services.program.getSemanticDiagnostics().some(diagnostic => diagnostic.code === 2322));
  assert.throws(
    () => parseForESLint('export const answer = 42;', { ...options, filePath: join(directory, 'unlisted.js') }),
    /not found by the project service|not included in allowDefaultProject/
  );
});
