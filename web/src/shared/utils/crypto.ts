// AES-256-GCM audio encryption using the browser Web Crypto API.
// Packed format: nonce(12) || ciphertext — mirrors @polkadot-apps/crypto aesGcmEncryptPacked.
// When @polkadot-apps/crypto is installed, this file can be replaced with that package.

export function generateContentKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

// Returns: nonce(12) || ciphertext
export async function encryptAudio(data: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cryptoKey, data));
  const packed = new Uint8Array(12 + ciphertext.length);
  packed.set(nonce);
  packed.set(ciphertext, 12);
  return packed;
}

// Input: nonce(12) || ciphertext (produced by encryptAudio)
export async function decryptAudio(packed: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
  if (packed.length < 12) throw new Error('Packed buffer too short to contain nonce');
  const nonce = packed.slice(0, 12);
  const ciphertext = packed.slice(12);
  const cryptoKey = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['decrypt']);
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, cryptoKey, ciphertext));
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

// Accepts raw hex or 0x-prefixed hex
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
