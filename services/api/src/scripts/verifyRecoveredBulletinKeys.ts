// Explicit offline recovered-key readback; never load application environment.
import { verifyRecoveredBulletinKeys } from '../services/bulletinRecoveredKeys.js';
const [directory, expectedManifestSha256, keyFile, ...extra] = process.argv.slice(2);
try {
  if (!directory || !expectedManifestSha256 || !keyFile || extra.length) throw new Error('Invalid arguments');
  console.log(JSON.stringify(await verifyRecoveredBulletinKeys({ directory, expectedManifestSha256, keyFile, signal: AbortSignal.timeout(6 * 60_000) })));
} catch {
  console.error(
    'BULLETIN_RECOVERED_KEYS_STOPPED: preserve the guarded workspace; review the original digest, separately recovered versions and retained ciphertext.'
  );
  process.exitCode = 1;
}
