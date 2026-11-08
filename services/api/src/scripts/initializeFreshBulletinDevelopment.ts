import { dirname } from 'node:path';
import { load, privateDirectory } from '../services/bulletinMediaState.js';
import { initializeFreshBulletinDevelopment } from '../services/freshBulletinDevelopment.js';
try {
  const [file, ...extra] = process.argv.slice(2);
  if (!file || extra.length) throw new Error('Expected one private request file');
  await privateDirectory(dirname(file));
  console.log(JSON.stringify(await initializeFreshBulletinDevelopment(await load(file)), null, 2));
} catch {
  console.error('FRESH_DEVELOPMENT_REFUSED: provide one reviewed private request and an absent destination. Preserve partial state; no activation performed.');
  process.exitCode = 1;
}
