// Private server signer only. It never reads MNEMONIC or the desktop keychain.
import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { dirname } from 'node:path';
import { AccountId } from '@polkadot-api/substrate-bindings';
import { getPublicKey, secretFromSeed, sign } from '@scure/sr25519';
import { createClient } from 'polkadot-api';
import { getWsProvider } from 'polkadot-api/ws';
import { getTxCreator } from 'polkadot-api/tx-creator';
import { WebSocket, type ClientOptions } from 'ws';
import { privateDirectory } from './bulletinMediaState.js';
import { createPapiMediaTransport, type BulletinSigner } from './bulletinPapiTransport.js';
import type { BulletinPublisherProfile } from './bulletinPublisherProfile.js';

class BoundedWebSocket extends WebSocket {
  constructor(url: string) {
    const options: ClientOptions & { maxFragments: number; maxBufferedChunks: number } = {
      maxPayload: 20 * 1024 * 1024,
      perMessageDeflate: false,
      followRedirects: false,
      handshakeTimeout: 10_000,
      maxFragments: 1024,
      maxBufferedChunks: 4096
    };
    super(url, options);
  }
}
export async function loadBulletinSigner(profile: BulletinPublisherProfile): Promise<BulletinSigner> {
  await privateDirectory(dirname(profile.seedFile));
  const handle = await open(profile.seedFile, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  const seed = Buffer.alloc(32);
  let secret: Uint8Array | undefined;
  try {
    const info = await handle.stat();
    assert.ok(
      info.isFile() && info.nlink === 1 && info.size === 32 && !(info.mode & 0o077) && info.uid === process.getuid?.(),
      'Invalid private storage signer file'
    );
    assert.equal((await handle.read(seed, 0, 32, 0)).bytesRead, 32, 'Incomplete storage signer');
    secret = secretFromSeed(seed);
    const publicKey = getPublicKey(secret);
    assert.equal(AccountId(42).dec(publicKey), profile.account, 'Storage signer does not match configured account');
    const selected = secret;
    let disposed = false;
    return {
      account: profile.account,
      createTransaction: getTxCreator(publicKey, 'Sr25519', payload => {
        assert.ok(!disposed, 'Storage signer has been disposed');
        return sign(selected, payload);
      }),
      dispose() {
        disposed = true;
        selected.fill(0);
      }
    };
  } catch (error) {
    secret?.fill(0);
    throw error;
  } finally {
    seed.fill(0);
    await handle.close();
  }
}
export function openBulletinPublicationSession(
  profile: BulletinPublisherProfile,
  signer: BulletinSigner | null,
  reserved: { transactions: number; bytes: number }
) {
  const client = createClient(getWsProvider(profile.endpoint, { websocketClass: BoundedWebSocket as unknown as typeof globalThis.WebSocket }));
  try {
    return createPapiMediaTransport({ client, identity: { genesis: profile.genesis, account: profile.account }, signer, budget: profile.budget, reserved });
  } catch (error) {
    client.destroy();
    throw error;
  }
}
