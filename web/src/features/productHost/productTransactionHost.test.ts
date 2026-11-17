import { expect, it } from 'vitest';
import { requireProductTransactionHost } from './productTransactionHost';
import type { HostSoftwareObservation } from './productHostInfo';

const info = { status: 'reported', platform: 'Desktop', name: 'Host', version: '0.9.4' } as const;
it('allows the reviewed transaction wire family without asserting payment support', async () => {
  await expect(requireProductTransactionHost(async () => ({ ...info, runtimeVersion: '0.31.0' }))).resolves.toBeUndefined();
});
it.each(['0.25.0', '0.26.0', '0.29.0', '0.32.0', '', undefined])('refuses an unknown or different transaction protocol: %s', async runtimeVersion => {
  await expect(requireProductTransactionHost(async () => ({ ...info, runtimeVersion }))).rejects.toThrow('No transaction was requested');
});
it.each([null, { status: 'timeout' }, { status: 'unavailable' }] as (HostSoftwareObservation | null)[])(
  'does not authorize from missing Host information: %j',
  async observation => {
    await expect(requireProductTransactionHost(async () => observation)).rejects.toThrow('Runtime 0.31.x');
  }
);
