// Public bytes only. No wallet, content-key request or provider fallback.
import { isBulletinMediaRoot } from '../features/catalog/streamingTransport';
export function bulletinAssetLocation(value: string): { root: string; path: string; maxBytes: number; mime: string } | null {
  const match = value.match(/^(b[a-z2-7]+)\/(.+)$/);
  if (!match || !isBulletinMediaRoot(match[1])) return null;
  const path = match[2];
  if (path === 'release.json') return { root: match[1], path, maxBytes: 50 * 1024, mime: 'application/json' };
  if (/^cover\/(?:placeholder|64|160|320|640)\.webp$/.test(path)) return { root: match[1], path, maxBytes: 1024 * 1024, mime: 'image/webp' };
  const original = path.match(/^cover\/original\.(jpg|png|webp|gif)$/);
  if (original) return { root: match[1], path, maxBytes: 5 * 1024 * 1024, mime: `image/${original[1] === 'jpg' ? 'jpeg' : original[1]}` };
  return null;
}
export function bulletinAssetUrl(value: string, api: string | undefined): string[] | null {
  if (!isBulletinMediaRoot(value.split('/')[0])) return null;
  return bulletinAssetLocation(value) && api ? [`${api}/api/assets/ipfs/${value}`] : [];
}
export async function fetchBulletinPublicAsset(url: string, signal?: AbortSignal): Promise<Response> {
  const value = url.split('/api/assets/ipfs/')[1];
  const asset = value && bulletinAssetLocation(value);
  if (!asset) throw new Error('Unsupported Bulletin artwork or release details.');
  const owner = signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000);
  owner.throwIfAborted();
  try {
    const { readHostBulletinAsset } = await import('../features/catalog/bulletinHostMedia');
    const bytes = await readHostBulletinAsset(asset.root, asset.path, asset.maxBytes, owner);
    if (bytes) return new Response(Uint8Array.from(bytes), { headers: { 'content-type': asset.mime } });
  } catch (error) {
    if (owner.aborted) throw error; /* Existing HTTPS API is a bounded recovery path. */
  }
  owner.throwIfAborted();
  return fetch(url, { signal: owner, credentials: 'omit', redirect: 'error' });
}
