import { createHmac, timingSafeEqual } from 'node:crypto';

export type TurnCapability = {
  v: 1;
  aud: 'dotify-turn';
  roomId: string;
  participantId: string;
  role: 'host' | 'listener';
  iat: number;
  exp: number;
};

const ROOM_ID_PATTERN = /^[A-Z2-9]{6}$/;
const PARTICIPANT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_CAPABILITY_LIFETIME_SECONDS = 5 * 60;

function signatureFor(encodedPayload: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(encodedPayload).digest();
}

function parsePayload(encodedPayload: string): TurnCapability | null {
  try {
    const value = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Partial<TurnCapability>;
    if (value.v !== 1 || value.aud !== 'dotify-turn') return null;
    if (typeof value.roomId !== 'string' || !ROOM_ID_PATTERN.test(value.roomId)) return null;
    if (typeof value.participantId !== 'string' || !PARTICIPANT_ID_PATTERN.test(value.participantId)) return null;
    if (value.role !== 'host' && value.role !== 'listener') return null;
    if (!Number.isSafeInteger(value.iat) || !Number.isSafeInteger(value.exp)) return null;
    return value as TurnCapability;
  } catch {
    return null;
  }
}

export function verifyTurnCapability(token: string, secret: string, now = new Date()): TurnCapability | null {
  if (!token || !secret) return null;
  const [encodedPayload, encodedSignature, extra] = token.split('.');
  if (!encodedPayload || !encodedSignature || extra) return null;

  let receivedSignature: Buffer;
  try {
    receivedSignature = Buffer.from(encodedSignature, 'base64url');
  } catch {
    return null;
  }

  const expectedSignature = signatureFor(encodedPayload, secret);
  if (receivedSignature.length !== expectedSignature.length || !timingSafeEqual(receivedSignature, expectedSignature)) return null;

  const payload = parsePayload(encodedPayload);
  if (!payload) return null;
  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (payload.iat > nowSeconds + 30 || payload.exp <= nowSeconds) return null;
  if (payload.exp <= payload.iat || payload.exp - payload.iat > MAX_CAPABILITY_LIFETIME_SECONDS) return null;
  return payload;
}
