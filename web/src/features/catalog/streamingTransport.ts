import { CID } from 'multiformats/cid';

/** Public ciphertext endpoints only: never accept a token-bearing cache URL. */
export function mediaEdgeOrigin(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    url.pathname !== '/' ||
    url.hostname === 'localhost' ||
    url.hostname.endsWith('.local') ||
    /^[\d.]+$/.test(url.hostname) ||
    url.hostname.includes(':')
  )
    throw new Error('Media edge must be a public HTTPS origin without credentials or a path.');
  return url.origin;
}

export function streamingObjectUrls(cid: string, path: string, options: { edge?: string; api?: string; gateways: string[] }): string[] {
  const edge = mediaEdgeOrigin(options.edge);
  return [
    ...new Set([
      ...(edge ? [`${edge}/ipfs/${cid}/${path}`] : []),
      ...(options.api ? [`${options.api}/api/media/${cid}/stream/${path}`] : []),
      ...options.gateways
    ])
  ];
}
/** Storage identity comes from the registered reference, never a user URL. */
export function isBulletinMediaRoot(value: string): boolean {
  try {
    const cid = CID.parse(value);
    return cid.version === 1 && cid.code === 0x70 && cid.multihash.code === 0xb220 && cid.multihash.digest.length === 32;
  } catch {
    return false;
  }
}
