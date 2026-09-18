import { config } from '../config.js';

const PIN_FILE_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
const PIN_JSON_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';

export class PinataError extends Error {
  constructor(message: string, public readonly httpStatus: number) {
    super(message);
    this.name = 'PinataError';
  }
}

export class PinataUnconfiguredError extends PinataError {
  constructor() {
    super('PINATA_JWT is not configured on the backend', 503);
  }
}

function authHeaders(): Record<string, string> {
  if (!config.PINATA_JWT) {
    throw new PinataUnconfiguredError();
  }
  return { Authorization: `Bearer ${config.PINATA_JWT}` };
}

export async function pinFileToPinata(
  bytes: Uint8Array,
  filename: string,
  keyvalues: Record<string, string> = {},
  signal?: AbortSignal,
): Promise<string> {
  const headers = authHeaders();
  const form = new FormData();
  form.append('file', new Blob([bytes]), filename);
  form.append('pinataMetadata', JSON.stringify({ name: filename, keyvalues }));

  const res = await fetch(PIN_FILE_URL, {
    method: 'POST',
    headers,
    body: form,
    signal,
  });

  if (!res.ok) {
    // Do not log the response body — it may echo back file content or tokens.
    throw new PinataError(`Pinata file pin failed with HTTP ${res.status}`, 502);
  }

  const data = (await res.json()) as { IpfsHash: string };
  if (!data.IpfsHash) {
    throw new PinataError('Pinata returned no IpfsHash', 502);
  }
  return data.IpfsHash;
}

export type PinataFile = {
  path: string;
  bytes: Uint8Array;
  mime?: string;
};

/** Pin an immutable directory and preserve each relative asset path. */
export async function pinFilesToPinata(files: PinataFile[], name: string, keyvalues: Record<string, string> = {}, signal?: AbortSignal): Promise<string> {
  if (files.length === 0) throw new PinataError('No files supplied for Pinata directory pin', 502);
  const headers = authHeaders();
  const form = new FormData();
  for (const file of files) {
    form.append('file', new Blob([file.bytes], file.mime ? { type: file.mime } : undefined), file.path);
  }
  form.append('pinataMetadata', JSON.stringify({ name, keyvalues }));

  const res = await fetch(PIN_FILE_URL, {
    method: 'POST',
    headers,
    body: form,
    signal
  });

  if (!res.ok) throw new PinataError(`Pinata directory pin failed with HTTP ${res.status}`, 502);
  const data = (await res.json()) as { IpfsHash: string };
  if (!data.IpfsHash) throw new PinataError('Pinata returned no IpfsHash', 502);
  return data.IpfsHash;
}

export async function pinJsonToPinata(
  json: unknown,
  name: string,
  keyvalues: Record<string, string> = {},
  signal?: AbortSignal,
): Promise<string> {
  const headers = authHeaders();
  const res = await fetch(PIN_JSON_URL, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ pinataContent: json, pinataMetadata: { name, keyvalues } }),
    signal,
  });

  if (!res.ok) {
    throw new PinataError(`Pinata JSON pin failed with HTTP ${res.status}`, 502);
  }

  const data = (await res.json()) as { IpfsHash: string };
  if (!data.IpfsHash) {
    throw new PinataError('Pinata returned no IpfsHash', 502);
  }
  return data.IpfsHash;
}
