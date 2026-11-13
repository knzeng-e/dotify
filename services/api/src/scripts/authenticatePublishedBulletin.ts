// Explicit offline inputs only; do not load application environment.
import { authenticatePublishedBulletinAudio } from '../services/bulletinPublishedAudio.js';
const [directory, planFile, expectedPlanSha256, keyFile, ...extra] = process.argv.slice(2);
try {
  if (!directory || !planFile || !expectedPlanSha256 || !keyFile || extra.length) throw new Error('Invalid arguments');
  console.log(
    JSON.stringify(await authenticatePublishedBulletinAudio({ directory, planFile, expectedPlanSha256, keyFile, signal: AbortSignal.timeout(360_000) }))
  );
} catch {
  console.error('BULLETIN_PUBLISHED_AUDIO_STOPPED: preserve the archive; review the separate trust plan and recovered key versions.');
  process.exitCode = 1;
}
