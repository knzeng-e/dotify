import { CID } from 'multiformats/cid';
import { createEncryptedMediaReader, MediaError } from './encryptedMedia.js';
import { createBulletinMediaReader } from './bulletinReader.js';
import { createBulletinHttpBlockReader } from './bulletinHttpReader.js';

/** Catalog routes remain the admission boundary. Never expose the raw reader. */
export function createMediaDeliveryReader(options: { bulletinRpcUrl?: string; dedicatedGateway?: string; fetchImpl?: typeof fetch } = {}) {
  const pinata = createEncryptedMediaReader(options.fetchImpl, options.dedicatedGateway);
  const raw = options.bulletinRpcUrl ? createBulletinHttpBlockReader(options.bulletinRpcUrl, options.fetchImpl) : undefined;
  const bulletin = raw ? createBulletinMediaReader(raw) : undefined;
  return {
    async read(object: string, signal?: AbortSignal) {
      signal?.throwIfAborted();
      let cid;
      try {
        cid = CID.parse(object.split('/')[0]);
      } catch {
        throw new MediaError(404, 'MEDIA_NOT_FOUND');
      }
      if (cid.multihash.code === 0xb220) {
        if (cid.version !== 1 || cid.code !== 0x70 || cid.multihash.digest.length !== 32) throw new MediaError(404, 'MEDIA_NOT_FOUND');
        if (!bulletin) throw new MediaError(502, 'MEDIA_UNAVAILABLE');
        return bulletin.read(object, signal);
      }
      return pinata.read(object, signal);
    },
    clear() {
      bulletin?.clear();
      raw?.clear();
      pinata.clear();
    }
  };
}
