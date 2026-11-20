import { readProductHostInfo, type HostSoftwareObservation } from './productHostInfo';

/** Wire preflight only: it grants no signing, payment or access permission. */
export async function requireProductTransactionHost(read = readProductHostInfo): Promise<void> {
  const observation: HostSoftwareObservation | null = await read(new AbortController().signal);
  if (observation?.status === 'reported' && /^0\.31\.\d+$/.test(observation.runtimeVersion ?? '')) return;
  // SDK 0.45 sends createTransaction V2. Known 0.25/0.26/0.29 Hosts use V1.
  // Refuse before building a signer; never reinterpret or retry that operation.
  throw new Error(
    'This Dotify build requires Polkadot Runtime 0.31.x for transactions. Check the Runtime version in the Polkadot app. No transaction was requested.'
  );
}
