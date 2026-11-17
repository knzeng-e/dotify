import { initializeBulletinPublisher, readBulletinPublisherProfile } from '../services/bulletinPublisherProfile.js';
const [profileFile, queue] = process.argv.slice(2);
if (!profileFile || !queue || process.argv.length !== 4)
  throw new Error('Specify an absolute private profile and NEW queue directory. Never repair lost state with this command.');
await initializeBulletinPublisher(queue, await readBulletinPublisherProfile(profileFile));
console.log(
  'Fresh Bulletin publication custody initialized. Preserve queue, inventories and permanent nonce history together. No network access or signing performed.'
);
