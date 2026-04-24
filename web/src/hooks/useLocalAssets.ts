const LOCAL_ASSET_PREFIX = 'dotify.localAsset.';
const LOCAL_ASSET_URI_PREFIX = 'local://dotify/assets/';

export type LocalAssetKind = 'audio' | 'cover' | 'artist-contract';

export type LocalAssetMetadata = {
  kind: LocalAssetKind;
  id: string;
  uri: string;
  name: string;
  mimeType: string;
  size: number;
  contentHash: `0x${string}`;
  storageMode: 'local';
  encrypted?: boolean;
};

type StoredLocalAsset = LocalAssetMetadata & {
  dataBase64: string;
};

export type LoadedLocalAsset = {
  metadata: LocalAssetMetadata;
  bytes: Uint8Array;
};

/** Stores a browser File in localStorage and returns a local asset reference. */
export async function storeAssetLocally(file: File, kind: LocalAssetKind, contentHash: `0x${string}`): Promise<LocalAssetMetadata> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return storeAssetBytesLocally(bytes, {
    kind,
    contentHash,
    name: file.name,
    mimeType: file.type || 'application/octet-stream'
  });
}

/** Stores raw bytes in localStorage and returns a local asset reference. */
export function storeAssetBytesLocally(
  bytes: Uint8Array,
  metadata: Pick<LocalAssetMetadata, 'kind' | 'contentHash' | 'name' | 'mimeType'> & { encrypted?: boolean }
): LocalAssetMetadata {
  const id = createLocalAssetId(metadata.kind, metadata.contentHash);
  const asset: StoredLocalAsset = {
    ...metadata,
    id,
    uri: toLocalAssetUri(id),
    size: bytes.byteLength,
    storageMode: 'local',
    dataBase64: bytesToBase64(bytes)
  };

  try {
    localStorage.setItem(toLocalAssetStorageKey(id), JSON.stringify(asset));
  } catch (error) {
    throw new Error(error instanceof DOMException ? 'Browser storage is full for this asset' : 'Unable to store asset');
  }

  return toLocalAssetMetadata(asset);
}

/** Loads bytes previously stored with a local asset URI. */
export function loadLocalAssetBytes(uri: string): Uint8Array {
  return loadLocalAsset(uri).bytes;
}

/** Loads metadata and bytes previously stored with a local asset URI. */
export function loadLocalAsset(uri: string): LoadedLocalAsset {
  const id = parseLocalAssetId(uri);
  const payload = localStorage.getItem(toLocalAssetStorageKey(id));
  if (!payload) {
    throw new Error('Asset not found in this browser');
  }

  const asset = JSON.parse(payload) as StoredLocalAsset;
  return {
    metadata: toLocalAssetMetadata(asset),
    bytes: base64ToBytes(asset.dataBase64)
  };
}

/** Returns true when a URI points to a Dotify browser-local asset. */
export function isLocalAssetUri(uri: string) {
  return uri.startsWith(LOCAL_ASSET_URI_PREFIX);
}

function createLocalAssetId(kind: LocalAssetKind, contentHash: `0x${string}`) {
  return `${kind}-${contentHash.slice(2, 18)}-${Date.now().toString(36)}`;
}

function toLocalAssetUri(id: string) {
  return `${LOCAL_ASSET_URI_PREFIX}${encodeURIComponent(id)}`;
}

function parseLocalAssetId(uri: string) {
  if (!isLocalAssetUri(uri)) {
    throw new Error('Unsupported asset URI');
  }
  return decodeURIComponent(uri.slice(LOCAL_ASSET_URI_PREFIX.length));
}

function toLocalAssetStorageKey(id: string) {
  return `${LOCAL_ASSET_PREFIX}${id}`;
}

function toLocalAssetMetadata(asset: StoredLocalAsset): LocalAssetMetadata {
  const { dataBase64: _dataBase64, ...metadata } = asset;
  return metadata;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
