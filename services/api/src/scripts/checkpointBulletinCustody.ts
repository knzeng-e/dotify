// Maintenance only. Deliberately no app config, secret/vault or signer import.
import { inspectBulletinCheckpoint, copyBulletinCheckpoint, verifyBulletinCheckpoint } from '../services/bulletinCheckpoint.js';
const [mode, ...args] = process.argv.slice(2);
const signal = AbortSignal.timeout(6 * 60_000);
try {
  if (mode === 'inspect' && args.length === 2) {
    const result = await inspectBulletinCheckpoint({ queue: args[0], profileFile: args[1], signal });
    console.log(JSON.stringify({ mode, ...result.report }));
  } else if (mode === 'copy' && args.length === 4) {
    console.log(
      JSON.stringify({
        mode,
        ...(await copyBulletinCheckpoint({ queue: args[0], profileFile: args[1], destination: args[2], expectedPlanSha256: args[3], signal }))
      })
    );
  } else if (mode === 'verify' && args.length === 2) {
    console.log(JSON.stringify({ mode, ...(await verifyBulletinCheckpoint(args[0], args[1], signal)) }));
  } else throw new Error('Invalid checkpoint arguments');
} catch {
  // Never turn private file contents/provider errors into support output.
  console.error('BULLETIN_CHECKPOINT_STOPPED: preserve source and any incomplete copy; review private paths, settled state and the exact plan/digest.');
  process.exitCode = 1;
}
