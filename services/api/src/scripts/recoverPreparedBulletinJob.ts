// Run only inside stopped private custody, as its normal non-root operator.
// Inspection authenticates local bytes and reads canonical artist authority;
// it opens no Bulletin session or signer.
import { config } from '../config.js';
import { checkArtistAuthority } from '../services/chainAccess.js';
import { deriveContentKeyBytes } from '../services/keyVault.js';
import { recoverPreparedBulletinJob } from '../services/bulletinPreparedRecovery.js';
const [mode, jobId, owner, planSha256, ...extra] = process.argv.slice(2);
if (!['inspect', 'execute'].includes(mode) || !jobId || !owner || extra.length || (mode === 'inspect' ? planSha256 !== undefined : !planSha256))
  throw new Error('Usage: recoverPreparedBulletinJob.js inspect|execute JOB_UUID ARTIST_H160 [INSPECTED_PLAN_SHA256]');
if (config.API_ROLE !== 'custody' || config.STREAMING_AUDIO_STORAGE !== 'bulletin' || !config.BULLETIN_PUBLICATION_PROFILE)
  throw new Error('Recovery requires the existing private Bulletin custody configuration');
if (config.NODE_ENV === 'production' && process.getuid?.() !== 1000) throw new Error('Use the normal custody UID 1000');
const abort = new AbortController();
const stop = () => abort.abort(new Error('Operator stopped recovery'));
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
try {
  const result = await recoverPreparedBulletinJob(
    {
      queue: config.STREAMING_STATE_PATH,
      profileFile: config.BULLETIN_PUBLICATION_PROFILE,
      jobId,
      owner,
      ...(mode === 'execute' ? { executePlan: planSha256 } : {}),
      signal: AbortSignal.any([abort.signal, AbortSignal.timeout(6 * 60_000)])
    },
    {
      deriveKey: deriveContentKeyBytes,
      authority: async (artist, runtime, chainId) => {
        if (chainId !== config.DOTIFY_CHAIN_ID) return false;
        const result = await checkArtistAuthority(artist);
        return result.allowed && result.runtime.toLowerCase() === runtime;
      }
    }
  );
  console.log(JSON.stringify(result, null, 2));
} catch {
  // RPC/provider errors can contain private payloads. Inspect durable, bounded
  // inventories and audit state instead of printing arbitrary exceptions.
  console.error('PREPARED_RECOVERY_STOPPED: preserve custody state; inspect the job, authority, locks and publication receipts before another attempt.');
  process.exitCode = 1;
} finally {
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', stop);
}
