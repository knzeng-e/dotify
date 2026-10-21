import { config } from './config.js';
import { verifyApiStorage } from './services/storagePreflight.js';

// Verify permissions before importing the session/catalog singletons. A bad
// volume must not silently discard revocations or start with a cold catalog.
await verifyApiStorage([
  { name: 'CATALOG_SNAPSHOT_PATH', path: config.CATALOG_SNAPSHOT_PATH },
  { name: 'SESSION_REVOCATIONS_PATH', path: config.SESSION_REVOCATIONS_PATH },
  { name: 'NATIVE_CONTRIBUTION_SNAPSHOT_PATH', path: config.NATIVE_CONTRIBUTION_SNAPSHOT_PATH }
]);
console.info(JSON.stringify({ event: 'api:storage-ready', uid: process.getuid?.(), gid: process.getgid?.() }));
const { buildApp } = await import('./app.js');

const app = await buildApp();
await app.listen({ port: config.API_PORT, host: '0.0.0.0' });

// Fly stops machines with SIGTERM: finish in-flight requests, then exit.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    const forceExit = setTimeout(() => process.exit(1), 10_000);
    forceExit.unref();
    void app.close().finally(() => process.exit(0));
  });
}
