// Browser suites share one loopback address across otherwise isolated users.
// Raise only their creation budget; production CLI keeps 10 creations/minute.
// This fixture is outside server/ and is never copied into the signal image.
import process from 'node:process';
import { readConfigFromEnv, startSignalingServer } from '../../server/signaling.mjs';

const server = startSignalingServer({
  ...readConfigFromEnv(),
  roomCreateRateLimit: { limit: 1000, windowMs: 60_000 }
});
await server.listen();
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => {
    void server.close().finally(() => process.exit(0));
  });
}
