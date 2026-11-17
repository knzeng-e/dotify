import type { SessionTokenService, SessionTokenPayload, SessionVerification } from '../sessionTokens.js';
import { SESSION_MAX_AGE_MS } from '../sessionTokens.js';
import { databaseNow, PostgresState } from './postgres.js';

export class PostgresSessions {
  constructor(
    private store: PostgresState,
    private tokens: SessionTokenService
  ) {}
  async issue(address: `0x${string}`, chainId: number) {
    return this.store.transaction(async (_client, now) => this.tokens.issue(address, chainId, now));
  }
  private async checked<T>(token: string, work: (now: number, payload: SessionTokenPayload) => T): Promise<T | SessionVerification> {
    return this.store.transaction(async (client, now) => {
      const valid = this.tokens.verify(token, now);
      if (!valid.valid) return valid;
      // Serialize revocation with renewal: descendants retain the same family ID.
      await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [this.store.lockId(`session:${valid.jti}`)]);
      now = await databaseNow(client);
      const current = this.tokens.verify(token, now);
      if (!current.valid) return current;
      const result = await client.query('SELECT 1 FROM dotify_state_revocations WHERE namespace=$1 AND jti=$2 AND expires_at>$3', [
        this.store.namespace,
        valid.jti,
        now
      ]);
      if (result.rowCount) return { valid: false, code: 'SESSION_REVOKED', reason: 'This session has been signed out.' } as const;
      const payload = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8')) as SessionTokenPayload;
      return work(now, payload);
    });
  }
  async verify(token: string): Promise<SessionVerification> {
    return this.checked(token, now => this.tokens.verify(token, now));
  }
  async renew(token: string) {
    return this.checked(token, now => this.tokens.renew(token, now));
  }
  async revoke(token: string): Promise<boolean> {
    return this.store.transaction(async (client, now) => {
      const valid = this.tokens.verifyRevocable(token, now);
      if (!valid.valid) return false;
      const payload = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8')) as SessionTokenPayload;
      await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [this.store.lockId(`session:${valid.jti}`)]);
      now = await databaseNow(client);
      if (!this.tokens.verifyRevocable(token, now).valid) return false;
      await client.query('DELETE FROM dotify_state_revocations WHERE namespace=$1 AND expires_at<=$2', [this.store.namespace, now]);
      await client.query(
        'INSERT INTO dotify_state_revocations(namespace,jti,expires_at) VALUES($1,$2,$3) ON CONFLICT(namespace,jti) DO UPDATE SET expires_at=greatest(dotify_state_revocations.expires_at,EXCLUDED.expires_at)',
        [this.store.namespace, valid.jti, (payload.startedAt ?? payload.iat) + SESSION_MAX_AGE_MS]
      );
      return true;
    });
  }
}
