import { createFakeHost } from '@parity/product-sdk-host/testing';
import { ResultAsync } from 'neverthrow';

declare global {
  interface Window {
    qualificationFixture: { calls: string[]; release: () => void };
  }
}
const host = createFakeHost();
const runtimeVersion = new URLSearchParams(location.search).get('runtime') ?? '0.31.0';
const delayed = new URLSearchParams(location.search).has('delayed');
window.qualificationFixture = { calls: [], release: () => {} };
host.client.system.info = () => {
  window.qualificationFixture.calls.push('system.info');
  const wait = delayed
    ? new Promise<void>(resolve => {
        window.qualificationFixture.release = resolve;
      })
    : Promise.resolve();
  return ResultAsync.fromSafePromise(
    wait.then(() => ({ platform: 'Ios' as const, name: 'Polkadot App', version: '0.10.0 (23)', runtimeVersion, token: 'PRIVATE_UNRELATED_FIELD' }))
  );
};
for (const domain of ['account', 'chain', 'permissions', 'payment', 'storage'] as const) {
  Object.defineProperty(host.client, domain, {
    get() {
      window.qualificationFixture.calls.push(domain);
      throw new Error('Unexpected qualification capability');
    }
  });
}
await import('../../src/qualification/main');
