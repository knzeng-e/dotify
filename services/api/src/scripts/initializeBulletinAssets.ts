import { readFile } from 'node:fs/promises';
import { readBulletinPublisherProfile } from '../services/bulletinPublisherProfile.js';
import { initializePublicAssetPolicy, publicAssetPolicySchema } from '../services/bulletinPublicAssets.js';
const [profile, policy] = process.argv.slice(2);
if (!profile || !policy || process.argv.length !== 4)
  throw new Error('Specify the existing publisher profile and an explicit public-asset policy. Stop custody first.');
await initializePublicAssetPolicy(await readBulletinPublisherProfile(profile), publicAssetPolicySchema.parse(JSON.parse(await readFile(policy, 'utf8'))));
console.log('Public asset policy bound to the existing publisher. Audio state unchanged; no network access or signing.');
