const IPFS_UPLOAD_URL = import.meta.env.VITE_IPFS_UPLOAD_URL as string | undefined;
const IPFS_GATEWAY_URL = (import.meta.env.VITE_IPFS_GATEWAY_URL as string | undefined) ?? 'https://ipfs.io/ipfs/';

export type IpfsAssetKind = 'audio' | 'cover' | 'artist-contract';

export type IpfsAssetMetadata = {
  kind: IpfsAssetKind;
  cid: string;
  uri: string;
  gatewayUrl: string;
  name: string;
  mimeType: string;
  size: number;
  contentHash: `0x${string}`;
  uploadMode: 'remote' | 'staged';
  encrypted?: boolean;
};

/** Uploads an asset to the configured IPFS endpoint, or stages it locally when no endpoint is set. */
export async function uploadAssetToIpfs(file: File, kind: IpfsAssetKind, contentHash: `0x${string}`): Promise<IpfsAssetMetadata> {
  if (!IPFS_UPLOAD_URL) {
    return createStagedAsset(file, kind, contentHash);
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('kind', kind);
  formData.append('contentHash', contentHash);

  const response = await fetch(IPFS_UPLOAD_URL, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(`IPFS upload failed with ${response.status}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const cid = parseCid(payload);
  return {
    kind,
    cid,
    uri: `ipfs://${cid}`,
    gatewayUrl: parseGatewayUrl(payload, cid),
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    contentHash,
    uploadMode: 'remote'
  };
}

/** Builds placeholder IPFS metadata for an asset that has not been uploaded yet. */
function createStagedAsset(file: File, kind: IpfsAssetKind, contentHash: `0x${string}`): IpfsAssetMetadata {
  const cid = `pending-${kind}-${contentHash.slice(2, 18)}`;
  return {
    kind,
    cid,
    uri: `ipfs://${cid}`,
    gatewayUrl: toGatewayUrl(cid),
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    contentHash,
    uploadMode: 'staged'
  };
}

/** Extracts the CID from a supported IPFS upload response shape. */
function parseCid(payload: Record<string, unknown>) {
  const candidates = [payload.cid, payload.Cid, payload.IpfsHash, payload.Hash, payload.path];
  const cid = candidates.find(candidate => typeof candidate === 'string' && candidate.length > 0);
  if (!cid) {
    throw new Error('IPFS upload response did not include a CID');
  }
  return cid as string;
}

/** Reads a gateway URL from the upload response, falling back to the configured gateway. */
function parseGatewayUrl(payload: Record<string, unknown>, cid: string) {
  const candidates = [payload.gatewayUrl, payload.url, payload.Url];
  const gatewayUrl = candidates.find(candidate => typeof candidate === 'string' && candidate.length > 0);
  return (gatewayUrl as string | undefined) ?? toGatewayUrl(cid);
}

/** Converts a CID into a fetchable URL using the configured IPFS gateway. */
export function toGatewayUrl(cid: string) {
  return `${IPFS_GATEWAY_URL.replace(/\/?$/, '/')}${cid}`;
}
