import { createFakeHost } from '@parity/product-sdk-host/testing';
import { errAsync, okAsync, ResultAsync } from 'neverthrow';

const host = createFakeHost();
const query = new URLSearchParams(location.search);
window.qualificationFixture = { calls: [], release: () => {} };
host.client.system.info = () => {
  window.qualificationFixture.calls.push('system.info');
  return okAsync({ platform: 'Ios' as const, name: 'Polkadot App', version: '0.10.0 (23)', runtimeVersion: query.get('runtime') ?? '0.31.0' });
};
// Public fixture vector, not a fallback account in the delivered application.
const publicKey = '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d';
host.client.account.getAccount = ((args: unknown) => {
  window.qualificationFixture.calls.push(`account.getAccount:${JSON.stringify(args)}`);
  if (query.has('denied')) return errAsync({ reason: 'PRIVATE_ERROR' });
  const wait = query.has('delayed')
    ? new Promise<void>(resolve => {
        window.qualificationFixture.release = resolve;
      })
    : Promise.resolve();
  return ResultAsync.fromSafePromise(
    wait.then(() => ({ account: { publicKey: query.has('malformed') ? '0x12' : publicKey }, secret: 'PRIVATE_ACCOUNT_FIELD' }))
  );
}) as typeof host.client.account.getAccount;
for (const domain of ['chain', 'permissions', 'payment', 'storage', 'signing'] as const) {
  const deny = new Proxy(
    {},
    {
      get: (_target, method) => () => {
        window.qualificationFixture.calls.push(`${domain}.${String(method)}`);
        throw new Error('Unexpected qualification request');
      }
    }
  );
  Object.defineProperty(host.client, domain, { value: deny });
}
host.client.account.getUserId = (() => {
  throw new Error('Profile request forbidden');
}) as typeof host.client.account.getUserId;
host.client.account.requestLogin = (() => {
  throw new Error('Login request forbidden');
}) as typeof host.client.account.requestLogin;
await import('../../src/qualification/account-main');
