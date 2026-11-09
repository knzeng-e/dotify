import { load } from '../services/bulletinMediaState.js';
import { extendBulletinAdmission } from '../services/bulletinAdmissionExtension.js';
try {
  const [mode, file, quiesced, ...extra] = process.argv.slice(2);
  if (!file || extra.length || !((mode === '--inspect' && !quiesced) || (mode === '--apply' && quiesced === '--quiesced')))
    throw new Error('Use --inspect REQUEST, or --apply REQUEST --quiesced after reviewed maintenance approval');
  console.log(JSON.stringify(await extendBulletinAdmission(await load(file), mode === '--apply'), null, 2));
} catch {
  // Never echo request paths, raw file contents, keys or native parser errors.
  console.error('ADMISSION_EXTENSION_REFUSED: inspect the reviewed request and stopped-writer state privately; do not reset or blindly retry.');
  process.exitCode = 1;
}
