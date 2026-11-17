// Admission only: stopped custody, no signer or Bulletin stores.
import { config } from '../config.js';
import { readBulletinPublisherProfile } from '../services/bulletinPublisherProfile.js';
import { prepareMetadataNameRepair } from '../services/bulletinMetadataRepair.js';
import { checkUnregisteredRelease } from '../services/unregisteredRelease.js';
const [mode, artistName, plan, ...extra] = process.argv.slice(2);
if (!['inspect', 'admit'].includes(mode) || !artistName || extra.length || (mode === 'inspect' ? plan !== undefined : !plan))
  throw new Error('Usage: prepareMetadataNameRepair.js inspect|admit "EXACT_ARTIST_NAME" [INSPECTED_PLAN_SHA256]');
if (
  config.API_ROLE !== 'custody' ||
  config.STREAMING_AUDIO_STORAGE !== 'bulletin' ||
  config.PUBLIC_ASSET_STORAGE !== 'bulletin' ||
  !config.BULLETIN_PUBLICATION_PROFILE ||
  !config.BULLETIN_PUBLIC_ASSET_POLICY
)
  throw new Error('Use the existing private Bulletin custody profile and public-asset policy');
if (config.NODE_ENV === 'production' && process.getuid?.() !== 1000) throw new Error('Use normal custody UID 1000');
try {
  const result = await prepareMetadataNameRepair(
    {
      profile: await readBulletinPublisherProfile(config.BULLETIN_PUBLICATION_PROFILE),
      queue: config.STREAMING_STATE_PATH,
      policyFile: config.BULLETIN_PUBLIC_ASSET_POLICY,
      artistName,
      signal: AbortSignal.timeout(30_000),
      ...(mode === 'admit' ? { admitPlan: plan } : {})
    },
    checkUnregisteredRelease
  );
  console.log(JSON.stringify(result, null, 2));
} catch {
  console.error(
    'METADATA_REPAIR_STOPPED: preserve inventories, original metadata and account state; inspect locks, authority and the exact plan before retrying.'
  );
  process.exitCode = 1;
}
