// Operator-only explicit capture; verification has no network or key dependency.
import { capturePublishedBulletinArchive, verifyPublishedBulletinArchive } from '../services/bulletinPublishedArchive.js';
import { createBulletinHttpBlockReader } from '../services/bulletinHttpReader.js';
try {
  const [mode, directory, reference, endpoint, ...extra] = process.argv.slice(2);
  if (extra.length) throw new Error('Invalid archive command');
  const signal = AbortSignal.timeout(360_000);
  let result;
  if (mode === 'verify' && directory && reference && !endpoint) result = await verifyPublishedBulletinArchive(directory, reference, signal);
  else if (mode === 'capture' && directory && reference && endpoint) {
    const reader = createBulletinHttpBlockReader(endpoint);
    try {
      result = await capturePublishedBulletinArchive({ root: reference, destination: directory, readBlock: reader, signal });
    } finally {
      reader.clear();
    }
  } else throw new Error('Invalid archive command');
  console.log(JSON.stringify(result));
} catch {
  console.error(
    'BULLETIN_PUBLISHED_ARCHIVE_STOPPED: preserve the incomplete artifact and check the trusted root/digest, source availability and private destination.'
  );
  process.exitCode = 1;
}
