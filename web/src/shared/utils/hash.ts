import { blake2b256, bytesToHex } from '@polkadot-apps/utils';

export type FileHashResult = {
  hash: `0x${string}`;
  bytes: Uint8Array;
};

export function hashFileWithBytes(file: File): Promise<FileHashResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const bytes = new Uint8Array(reader.result as ArrayBuffer);
      resolve({ hash: hashBytes(bytes), bytes });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

export function hashBytes(bytes: Uint8Array): `0x${string}` {
  return `0x${bytesToHex(blake2b256(bytes))}`;
}
