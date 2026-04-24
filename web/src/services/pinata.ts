const JWT = import.meta.env.VITE_PINATA_JWT as string;
const GATEWAY = (import.meta.env.VITE_PINATA_GATEWAY as string | undefined) ?? 'https://paseo-ipfs.polkadot.io';

const PIN_FILE_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
const PIN_JSON_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';
const PIN_LIST_URL = 'https://api.pinata.cloud/data/pinList';

export type AccessMode = 'human-free' | 'classic';
export type PersonhoodLevel = 'DIM1' | 'DIM2';

export interface DotifyTrackManifest {
  schema: 'dotify.track.v1';
  createdAt: string;
  assets: {
    audioCID: string;
    coverCID: string;
  };
  track: {
    contentHash: string;
    title: string;
    artistName: string;
    description: string;
    accessMode: AccessMode;
    priceDot: string;
    requiredPersonhood: string;
    zone: string;
  };
  royalties: Array<{ recipient: string; bps: number }>;
  settlement: {
    target: 'evm';
    royaltyBps: number;
    pricePlanck: string;
  };
  evm?: {
    txHash: string;
    contractAddress: string;
  };
}

export function getGatewayUrl(cid: string): string {
  console.log(`Using gateway URL: ${GATEWAY}/ipfs/${cid}`);
  return `${GATEWAY}/ipfs/${cid}`;
}

export async function uploadFileToPinata(file: File, name: string, keyvalues: Record<string, string> = {}): Promise<string> {
  const form = new FormData();
  form.append('file', file, name);
  form.append('pinataMetadata', JSON.stringify({ name, keyvalues }));

  const res = await fetch(PIN_FILE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${JWT}` },
    body: form
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pinata file upload failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { IpfsHash: string };
  return data.IpfsHash;
}

export async function uploadJsonToPinata(json: unknown, name: string, keyvalues: Record<string, string> = {}): Promise<string> {
  const res = await fetch(PIN_JSON_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${JWT}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ pinataContent: json, pinataMetadata: { name, keyvalues } })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pinata JSON upload failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { IpfsHash: string };
  return data.IpfsHash;
}

interface PinListRow {
  ipfs_pin_hash: string;
  date_pinned: string;
}

export async function fetchCatalogFromPinata(): Promise<DotifyTrackManifest[]> {
  const query = new URLSearchParams({
    status: 'pinned',
    'metadata[keyvalues][app]': JSON.stringify({ value: 'dotify', op: 'eq' }),
    'metadata[keyvalues][type]': JSON.stringify({ value: 'track-metadata', op: 'eq' })
  });

  const res = await fetch(`${PIN_LIST_URL}?${query}`, {
    headers: { Authorization: `Bearer ${JWT}` }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Pinata catalog: ${res.statusText}`);
  }

  const data = (await res.json()) as { rows: PinListRow[] };

  const sorted = [...data.rows].sort((a, b) => a.date_pinned.localeCompare(b.date_pinned));

  const manifests = await Promise.allSettled(
    sorted.map(async pin => {
      const r = await fetch(getGatewayUrl(pin.ipfs_pin_hash));
      if (!r.ok) throw new Error(`Failed to fetch manifest ${pin.ipfs_pin_hash}`);
      const manifest = (await r.json()) as DotifyTrackManifest;
      if (manifest.schema !== 'dotify.track.v1') throw new Error('Unknown schema');
      return manifest;
    })
  );

  return manifests.filter((r): r is PromiseFulfilledResult<DotifyTrackManifest> => r.status === 'fulfilled').map(r => r.value);
}
