import { Binary, createClient, Enum, type PolkadotClient, type PolkadotSigner } from 'polkadot-api';
import { withPolkadotSdkCompat } from 'polkadot-api/polkadot-sdk-compat';
import { getWsProvider } from 'polkadot-api/ws-provider/web';
import { bulletin } from '@polkadot-api/descriptors';
import { BULLETIN_WS_URL } from '../config/network';
import { hashBytes } from '../utils/hash';

export const BULLETIN_MAX_DATA_BYTES = 8 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 60_000;

let bulletinClient: PolkadotClient | null = null;

function getBulletinClient(): PolkadotClient {
  if (!bulletinClient) {
    bulletinClient = createClient(withPolkadotSdkCompat(getWsProvider(BULLETIN_WS_URL)));
  }
  return bulletinClient;
}

function getBulletinApi() {
  return getBulletinClient().getTypedApi(bulletin);
}

export async function checkBulletinAuthorization(address: string, dataSize: number) {
  try {
    const api = getBulletinApi();
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
  const api = getBulletinApi();
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
  bulletinClient?.destroy();
  bulletinClient = null;
}

export function encodeBulletinJson(payload: unknown) {
  const json = JSON.stringify(payload, null, 2);
  return {
    json,
    bytes: new TextEncoder().encode(json)
  };
}
