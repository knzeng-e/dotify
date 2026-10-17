import { CID } from 'multiformats/cid';

// Discovery may load immutable artwork, never arbitrary host-supplied URLs,
// data/blob URLs, signed links, source audio or release manifests.
export function publicCoverRef(value) {
  if (typeof value !== 'string' || value.length > 512) return null;
  const match = /^ipfs:\/\/([^/]+)(\/[^?#]*)?$/.exec(value);
  if (!match) return null;
  const path = match[2] ?? '';
  if (path && (!/^\/[a-zA-Z0-9_./-]+$/.test(path) || path.split('/').some(part => part === '..' || part === '.'))) return null;
  try {
    CID.parse(match[1]);
    return value;
  } catch {
    return null;
  }
}
