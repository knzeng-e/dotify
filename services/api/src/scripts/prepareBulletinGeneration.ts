// Offline, explicit operator invocation. Does not load app config or signer.
import { dirname } from 'node:path';
import { load } from '../services/bulletinMediaState.js';
import { canonicalPrivate } from '../services/bulletinMigrationSnapshot.js';
import { inspectGenerationMigration, stageGenerationMigration, verifyGenerationPackage } from '../services/bulletinGenerationMigration.js';
const [mode, file, hash, ...extra] = process.argv.slice(2);
try {
  if (!file || extra.length || !['inspect', 'stage', 'verify'].includes(mode) || (mode === 'stage' ? !hash : mode === 'inspect' && Boolean(hash)))
    throw new Error('Invalid arguments');
  await canonicalPrivate(dirname(file));
  const result =
    mode === 'verify'
      ? await verifyGenerationPackage(file, hash)
      : mode === 'stage'
        ? await stageGenerationMigration(await load(file), hash!)
        : (await inspectGenerationMigration(await load(file))).report;
  console.log(JSON.stringify(result, null, 2));
} catch {
  // No private inputs, provider exception or path contents in routine output.
  console.error(
    'GENERATION_PREPARATION_REFUSED: use inspect request.json, stage request.json PLAN_SHA256, or verify PACKAGE [PACKAGE_SHA256]. Preserve any partial candidate; no activation performed.'
  );
  process.exitCode = 1;
}
