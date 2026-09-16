import { CID } from 'multiformats/cid';

export function normalizeIpfsCid(value) {
  if (typeof value !== 'string') return null;
  const raw = value.trim().replace(/^ipfs:\/\//i, '');
  if (!raw || raw.includes('/')) return null;
  try {
    return CID.parse(raw).toString();
  } catch {
    return null;
  }
}
