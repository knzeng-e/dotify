import { buildApp } from './app.js';
import { config } from './config.js';

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
