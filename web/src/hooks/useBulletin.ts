import { hashBytes } from '../shared/utils/hash';
import { BULLETIN_WS_URL } from '../shared/config/network';
import { createChainClient } from '@polkadot-apps/chain-client';
import { bulletin } from '@polkadot-apps/descriptors/bulletin';
import { Binary, Enum, type PolkadotSigner, type TypedApi } from 'polkadot-api';

const UPLOAD_TIMEOUT_MS = 60_000;
export const BULLETIN_MAX_DATA_BYTES = 8 * 1024 * 1024;

let cachedApi: TypedApi<typeof bulletin> | null = null;
let cachedDestroy: (() => void) | null = null;

async function getBulletinApi(): Promise<TypedApi<typeof bulletin>> {
  if (!cachedApi) {
    const client = await createChainClient({
      chains: { bulletin },
      rpcs: { bulletin: [BULLETIN_WS_URL] }
    });
    cachedApi = client.bulletin;
    cachedDestroy = () => client.destroy();
  }
  return cachedApi;
}

export async function checkBulletinAuthorization(address: string, dataSize: number) {
  try {
    const api = await getBulletinApi();
    const auth = await api.query.TransactionStorage.Authorizations.getValue(Enum('Account', address));
    return Boolean(auth && auth.extent.transactions > 0n && auth.extent.bytes >= BigInt(dataSize));
  } catch {
    return false;
  }
}

export async function uploadToBulletin(fileBytes: Uint8Array, signer: PolkadotSigner) {
  if (fileBytes.length > BULLETIN_MAX_DATA_BYTES) {
    throw new Error('Bulletin Chain payloads are limited to 8 MiB.');
  }

  const contentHash = hashBytes(fileBytes);
  const api = await getBulletinApi();
  const tx = api.tx.TransactionStorage.store({
    data: Binary.fromBytes(fileBytes)
  });

  return new Promise<{ contentHash: `0x${string}` }>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      subscription.unsubscribe();
      reject(new Error('Bulletin Chain upload timeout'));
    }, UPLOAD_TIMEOUT_MS);

    const subscription = tx.signSubmitAndWatch(signer).subscribe({
      next: event => {
        if (event.type === 'txBestBlocksState' && event.found) {
          window.clearTimeout(timeout);
          subscription.unsubscribe();
          resolve({ contentHash });
        }
      },
      error: error => {
        window.clearTimeout(timeout);
        subscription.unsubscribe();
        reject(error);
      }
    });
  });
}

export function destroyBulletinClient() {
  cachedDestroy?.();
  cachedDestroy = null;
  cachedApi = null;
}

export function encodeBulletinJson(payload: unknown) {
  const json = JSON.stringify(payload, null, 2);
  return {
    json,
    bytes: new TextEncoder().encode(json)
  };
}
