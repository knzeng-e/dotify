import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { PostgresState } from '../services/sharedState/postgres.js';
import { cutOverManagedNamespace, initializeSharedNamespace } from '../services/sharedState/migration.js';

const args = process.argv.slice(2);
const fresh = args.length === 1 && args[0] === '--fresh';
const importing = args.length === 5 && args[0] === '--import-quiesced' && args[1] === '--revocations' && args[3] === '--catalog';
const managedCutover = args.length === 3 && args[0] === '--fresh-managed-cutover' && args[1] === '--from-namespace';
if (!fresh && !importing && !managedCutover)
  throw new Error(
    'Use --fresh, --fresh-managed-cutover --from-namespace <namespace>, or --import-quiesced --revocations <file> --catalog <file>. Stop ALL old API writers first.'
  );
if (!config.DATABASE_URL || !config.SESSION_EPOCH || !config.SESSION_SECRET)
  throw new Error('Configure DATABASE_URL, SESSION_EPOCH and the independent SESSION_SECRET locally');
const store = new PostgresState(config.STATE_NAMESPACE, config.DATABASE_URL);
try {
  const boundedJson = async (file: string) => {
    const bytes = await readFile(file);
    if (bytes.length > 16 * 1024 * 1024) throw new Error('Import exceeds budget');
    return JSON.parse(bytes.toString('utf8')) as unknown;
  };
  const legacy = importing ? { revocations: await boundedJson(args[2]), catalog: await boundedJson(args[4]) } : undefined;
  const sql = await readFile(fileURLToPath(new URL('../../migrations/001-shared-state.sql', import.meta.url)), 'utf8');
  await store.transaction(async client => {
    await client.query(sql);
    const identity = {
      version: 1 as const,
      chainId: config.DOTIFY_CHAIN_ID,
      directory: config.DOTIFY_DIRECTORY_ADDRESS?.toLowerCase() ?? '',
      sessionEpoch: config.SESSION_EPOCH!
    };
    if (managedCutover) await cutOverManagedNamespace(client, args[2], config.STATE_NAMESPACE, identity);
    else await initializeSharedNamespace(client, config.STATE_NAMESPACE, identity, legacy);
  });
  console.info('Shared namespace initialized. No content secrets, encrypted jobs or permanent nonce reservations were changed.');
} catch {
  console.error('Shared-state initialization failed. Existing state was not reset. Check database access, namespace and import identities locally.');
  process.exitCode = 1;
} finally {
  await store.close();
}
