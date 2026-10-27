// Child process used only by the explicit real-PostgreSQL integration suite.
import { buildApp } from '../../app.js';
import { sharedState } from './index.js';
const app = await buildApp({ logging: false });
const origin = await app.listen({ host: '127.0.0.1', port: 0 });
process.send?.({ origin });
process.on('message', () => {
  void app
    .close()
    .then(() => sharedState?.close())
    .finally(() => process.exit(0));
});
