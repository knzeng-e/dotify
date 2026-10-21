import { inspectApiStorage, prepareApiStorage } from '../services/storageOwnership.js';

// A fixed namespace prevents this root-only utility from becoming a recursive chown tool.
const directory = '/data/contributions';
try {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--inspect') {
    console.log(JSON.stringify(await inspectApiStorage(directory)));
  } else if (args.length === 3 && args[0] === '--apply' && args[1] === '--quiesced' && args[2].startsWith('--expect=')) {
    console.log(JSON.stringify(await prepareApiStorage(directory, args[2].slice('--expect='.length))));
  } else {
    throw new Error('Use --inspect, or --apply --quiesced --expect=<reviewed fingerprint>; stop the API writer and preserve a backup before applying');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Storage maintenance failed');
  process.exitCode = 1;
}
