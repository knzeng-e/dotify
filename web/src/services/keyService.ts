// Wallet-signed content-key client (Sprint 0, Ticket 03).
//
// Flow: request a single-use nonce, sign a structured EIP-191 message with
// the connected wallet, exchange the signature for the per-track content key.
// The backend independently re-checks the on-chain access policy; nothing the
// frontend sends is trusted as an access decision.
//
// The canonical message format below MUST stay byte-identical with the
// backend builder (services/api/src/services/signatures.ts). Any drift fails
// closed: verification simply rejects.

import type { WalletClient } from 'viem';

const API_URL = (import.meta.env.VITE_DOTIFY_API_URL as string | undefined)?.replace(/\/$/, '');

export type KeyRequestPurpose = 'individual' | 'room_host';

export type ContentKeyResponse =
  | {
      access: 'allowed';
      playbackMode: 'full';
      previewRatio: number;
      contentKey: `0x${string}`;
      runtime: `0x${string}`;
    }
  | {
      access: 'denied';
      playbackMode: 'preview';
      previewRatio: number;
      reason: string;
      message: string;
      hostAction: { type: 'unlock' | 'personhood' | 'none'; label: string };
    };

export class KeyServiceError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'KeyServiceError';
    this.code = code;
  }
}

/** True when the backend key service can be reached (production mode). */
export function isKeyServiceConfigured(): boolean {
  return Boolean(API_URL);
}

type SignedRequestPayload = {
  action: 'REQUEST_CONTENT_KEY';
  purpose: KeyRequestPurpose;
  contentHash: string;
  requester: string;
  chainId: number;
  nonce: string;
  expiresAt: string;
};

function buildSignedRequestMessage(payload: SignedRequestPayload): string {
  return [
    'Dotify signed request',
    'App: Dotify',
    `Action: ${payload.action}`,
    `Purpose: ${payload.purpose}`,
    `Content Hash: ${payload.contentHash.toLowerCase()}`,
    `Requester: ${payload.requester.toLowerCase()}`,
    `Chain ID: ${payload.chainId}`,
    `Nonce: ${payload.nonce}`,
    `Expires At: ${payload.expiresAt}`,
  ].join('\n');
}

async function parseError(res: Response, fallback: string): Promise<{ message: string; code: string }> {
  try {
    const body = (await res.json()) as { error?: string; code?: string };
    return { message: body.error ?? fallback, code: body.code ?? 'KEY_SERVICE_ERROR' };
  } catch {
    return { message: fallback, code: 'KEY_SERVICE_ERROR' };
  }
}

async function requestNonce(address: string, chainId: number): Promise<{ nonce: string; expiresAt: string }> {
  const res = await fetch(`${API_URL}/api/auth/nonce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, chainId }),
  });
  if (!res.ok) {
    const { message, code } = await parseError(res, `Nonce request failed (${res.status})`);
    throw new KeyServiceError(message, code);
  }
  return (await res.json()) as { nonce: string; expiresAt: string };
}

export type ContentKeyRequest = {
  contentHash: `0x${string}`;
  purpose: KeyRequestPurpose;
  walletClient: WalletClient;
  chainId: number;
};

/**
 * Request the content key for a track. The wallet signs one structured
 * message per request (nonces are single-use). Callers should cache delivered
 * keys for the session to avoid signature fatigue.
 */
export async function requestContentKey(request: ContentKeyRequest): Promise<ContentKeyResponse> {
  if (!API_URL) {
    throw new KeyServiceError('Backend key service is not configured (VITE_DOTIFY_API_URL).', 'KEY_SERVICE_NOT_CONFIGURED');
  }

  const account = request.walletClient.account;
  if (!account) {
    throw new KeyServiceError('Wallet client has no active account.', 'WALLET_REQUIRED');
  }

  const { nonce, expiresAt } = await requestNonce(account.address, request.chainId);

  const payload: SignedRequestPayload = {
    action: 'REQUEST_CONTENT_KEY',
    purpose: request.purpose,
    contentHash: request.contentHash,
    requester: account.address,
    chainId: request.chainId,
    nonce,
    expiresAt,
  };

  const signature = await request.walletClient.signMessage({
    account,
    message: buildSignedRequestMessage(payload),
  });

  const res = await fetch(`${API_URL}/api/tracks/${request.contentHash}/key-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requester: account.address,
      signature,
      nonce,
      chainId: request.chainId,
      expiresAt,
      purpose: request.purpose,
    }),
  });

  if (!res.ok) {
    const { message, code } = await parseError(res, `Key request failed (${res.status})`);
    throw new KeyServiceError(message, code);
  }

  return (await res.json()) as ContentKeyResponse;
}
