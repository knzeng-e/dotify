import { config } from './config.js';
import { verifyApiStorage } from './services/storagePreflight.js';
import { listenApi } from './httpListener.js';

// Verify permissions before importing the session/catalog singletons. A bad
// volume must not silently discard revocations or start with a cold catalog.
if (config.API_ROLE !== 'edge')
  await verifyApiStorage([
    ...(config.STATE_STORE === 'local'
      ? [
          { name: 'CATALOG_SNAPSHOT_PATH', path: config.CATALOG_SNAPSHOT_PATH },
          { name: 'SESSION_REVOCATIONS_PATH', path: config.SESSION_REVOCATIONS_PATH }
        ]
      : []),
    { name: 'NATIVE_CONTRIBUTION_SNAPSHOT_PATH', path: config.NATIVE_CONTRIBUTION_SNAPSHOT_PATH }
  ]);
console.info(JSON.stringify({ event: 'api:storage-ready', uid: process.getuid?.(), gid: process.getgid?.() }));
const { sharedState } = await import('./services/sharedState/index.js');
const { buildApp } = await import('./app.js');

const app = await buildApp();
await listenApi(app, config.API_PORT);

// Fly stops machines with SIGTERM: finish in-flight requests, then exit.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    const forceExit = setTimeout(() => process.exit(1), 10_000);
    forceExit.unref();
    // Close the server/worker/election hooks before ending the pool: a custody
    // hook still owns a checked-out lock connection until app.close resolves.
    void app
      .close()
      .then(() => sharedState?.close())
      .then(
        () => process.exit(0),
        () => process.exit(1)
      );
  });
}
