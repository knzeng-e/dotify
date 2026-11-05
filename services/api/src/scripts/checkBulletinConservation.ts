// Explicit operator invocation only. No application configuration or seed file.
import { dirname } from 'node:path';
import { createClient } from 'polkadot-api';
import { getWsProvider } from 'polkadot-api/ws';
import { WebSocket } from 'ws';
import { load, privateDirectory } from '../services/bulletinMediaState.js';
import { conservationPlanSchema, assessBulletinConservation } from '../services/bulletinConservation.js';
import { readBulletinConservation } from '../services/bulletinConservationRpc.js';

const args = process.argv.slice(2);
const offline = args[0] === '--snapshot';
const [file, endpoint, ...extra] = offline ? args.slice(1) : args;
let client: ReturnType<typeof createClient> | undefined;
const controller = new AbortController();
const stop = () => controller.abort();
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
try {
  if (!file || !endpoint || extra.length) throw new Error('Expected plan file and explicit endpoint');
  await privateDirectory(dirname(file));
  const plan = conservationPlanSchema.parse(await load(file));
  let snapshot: unknown;
  if (offline) {
    await privateDirectory(dirname(endpoint));
    snapshot = await load(endpoint);
  } else {
    const url = new URL(endpoint);
    if (url.protocol !== 'wss:' || url.username || url.password || url.search || url.hash)
      throw new Error('Expected explicit public wss endpoint without credentials');
    class BoundedSocket extends WebSocket {
      constructor(address: string) {
        super(address, { maxPayload: 5 * 1024 * 1024, perMessageDeflate: false, followRedirects: false, handshakeTimeout: 10_000 });
      }
    }
    client = createClient(getWsProvider(url.toString(), { websocketClass: BoundedSocket as unknown as typeof globalThis.WebSocket }));
    const selected = client;
    snapshot = await readBulletinConservation(
      plan,
      (method, params) => selected._request(method, params),
      AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)])
    );
  }
  const report = assessBulletinConservation(plan, snapshot);
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.severity === 'ok' ? 0 : report.severity === 'warning' ? 2 : 3;
} catch {
  // Never emit arbitrary provider exceptions or private input contents.
  console.error('CONSERVATION_CHECK_INCOMPLETE: no retention guarantee. Check the explicit plan, network identity and read-only RPC.');
  process.exitCode = 1;
} finally {
  client?.destroy();
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', stop);
}
