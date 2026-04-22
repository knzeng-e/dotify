import { blake2b } from 'blakejs';

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
  const hash = blake2b(bytes, undefined, 32);
  const hex = Array.from(hash)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
  return `0x${hex}`;
}
