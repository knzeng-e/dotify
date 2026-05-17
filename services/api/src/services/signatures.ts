import { randomBytes } from 'node:crypto';
import { config } from '../config.js';

const NONCE_TTL_MS = 5 * 60 * 1000;

export type NonceChallengeRequest = {
  address: string;
  chainId?: number;
};

export type NonceChallenge = {
  nonce: string;
  message: string;
  expiresAt: string;
};

export type KeySignatureRequest = {
  address: string;
  signature: string;
  nonce: string;
  chainId: number;
  expiresAt: string;
  contentHash: string;
};

export type SignatureVerification =
  | { valid: true }
  | { valid: false; reason: string };

export function createWalletNonceChallenge(request: NonceChallengeRequest): NonceChallenge {
  const nonce = randomBytes(24).toString('hex');
  const chainId = request.chainId ?? config.DOTIFY_CHAIN_ID;
  const expiresAt = new Date(Date.now() + NONCE_TTL_MS).toISOString();
  const message = [
    'Dotify content-key request',
    `Address: ${request.address}`,
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Expires At: ${expiresAt}`,
  ].join('\n');

  return { nonce, message, expiresAt };
}

export async function verifyKeyRequestSignature(request: KeySignatureRequest): Promise<SignatureVerification> {
  if (Date.parse(request.expiresAt) <= Date.now()) {
    return { valid: false, reason: 'Key request has expired' };
  }

  return {
    valid: false,
    reason: 'Wallet signature verification is not implemented in this skeleton',
  };
}
