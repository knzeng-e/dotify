import { createHmac, randomUUID } from 'node:crypto';
import type { Config } from '../config.js';

export type TurnIceServer = {
  urls: string[];
  username: string;
  credential: string;
  credentialType: 'password';
};

export type TurnGrant = {
  iceServers: TurnIceServer[];
  ttlSeconds: number;
  expiresAt: string;
  credentialMode: 'rest' | 'static';
};

export type TurnGrantInput = {
  urls?: string[];
  restSecret?: string;
  staticUsername?: string;
  staticCredential?: string;
  ttlSeconds: number;
  now?: Date;
  subject?: string;
};

export function isTurnGrantConfigured(input: Pick<TurnGrantInput, 'urls' | 'restSecret' | 'staticUsername' | 'staticCredential'>): boolean {
  if (!input.urls?.length) return false;
  if (input.restSecret) return true;
  return Boolean(input.staticUsername && input.staticCredential);
}

export function createTurnGrant(input: TurnGrantInput): TurnGrant | null {
  const urls = input.urls?.filter(Boolean) ?? [];
  if (!urls.length) return null;

  const issuedAt = input.now ?? new Date();
  const expiresAtMs = issuedAt.getTime() + input.ttlSeconds * 1000;
  const expiresAt = new Date(expiresAtMs).toISOString();

  if (input.restSecret) {
    const expiresAtSeconds = Math.floor(expiresAtMs / 1000);
    const subject = input.subject?.replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 64) || `dotify-${randomUUID()}`;
    const username = `${expiresAtSeconds}:${subject}`;
    const credential = createHmac('sha1', input.restSecret).update(username).digest('base64');
    return {
      iceServers: [{ urls, username, credential, credentialType: 'password' }],
      ttlSeconds: input.ttlSeconds,
      expiresAt,
      credentialMode: 'rest',
    };
  }

  if (input.staticUsername && input.staticCredential) {
    return {
      iceServers: [{ urls, username: input.staticUsername, credential: input.staticCredential, credentialType: 'password' }],
      ttlSeconds: input.ttlSeconds,
      expiresAt,
      credentialMode: 'static',
    };
  }

  return null;
}

export function createConfiguredTurnGrant(config: Config, now = new Date()): TurnGrant | null {
  return createTurnGrant({
    urls: config.TURN_URLS,
    restSecret: config.TURN_REST_SECRET,
    staticUsername: config.TURN_USERNAME,
    staticCredential: config.TURN_CREDENTIAL,
    ttlSeconds: config.TURN_TTL_SECONDS,
    now,
  });
}
