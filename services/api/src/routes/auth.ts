// Auth routes: wallet nonce challenges and the one-per-session sign-in
// (ticket 24 P2). Signing in issues a short-lived bearer token so later key
// requests skip the per-listen wallet signature; every key request still
// passes the on-chain access check for its own track.

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  createWalletNonceChallenge,
  verifySignInRequest as defaultVerifySignInRequest,
  type SignInRequest,
  type SignatureVerification
} from '../services/signatures.js';
import {
  issueSessionToken as defaultIssueSessionToken,
  revokeSessionToken as defaultRevokeSessionToken,
  type IssuedSession
} from '../services/sessionTokens.js';

const nonceRequestSchema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid EVM address'),
  chainId: z.number().int().positive().optional()
});

const sessionRequestSchema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid EVM address'),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/, 'Invalid signature'),
  nonce: z.string().min(16, 'Nonce is required'),
  chainId: z.number().int().positive(),
  expiresAt: z.string().datetime()
});

const logoutRequestSchema = z.object({
  sessionToken: z.string().min(16, 'Session token is required')
});

export type AuthRouteDeps = {
  verifySignInRequest: (request: SignInRequest) => Promise<SignatureVerification>;
  issueSessionToken: (address: `0x${string}`, chainId: number) => IssuedSession;
  revokeSessionToken: (token: string) => boolean;
};

const defaultDeps: AuthRouteDeps = {
  verifySignInRequest: defaultVerifySignInRequest,
  issueSessionToken: defaultIssueSessionToken,
  revokeSessionToken: defaultRevokeSessionToken
};

function validationError(reply: FastifyReply, error: string, issues: z.ZodIssue[]) {
  return reply.status(400).send({
    error,
    issues: issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message
    }))
  });
}

export function createAuthRoutes(deps: AuthRouteDeps = defaultDeps) {
  return async function authRoutes(app: FastifyInstance): Promise<void> {
    app.post('/nonce', async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = nonceRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return validationError(reply, 'Invalid nonce request', parsed.error.issues);
      }
      return createWalletNonceChallenge(parsed.data);
    });

    // Sign in once: exchange a wallet signature over the SIGN_IN challenge for
    // a session token. The token proves identity, never access.
    app.post('/session', async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = sessionRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return validationError(reply, 'Invalid session request', parsed.error.issues);
      }

      const verification = await deps.verifySignInRequest({
        requester: parsed.data.address,
        chainId: parsed.data.chainId,
        nonce: parsed.data.nonce,
        expiresAt: parsed.data.expiresAt,
        signature: parsed.data.signature
      });
      if (!verification.valid) {
        return reply.status(401).send({ error: verification.reason, code: verification.code });
      }

      const session = deps.issueSessionToken(parsed.data.address as `0x${string}`, parsed.data.chainId);
      if (!session.ok) {
        return reply.status(503).send({ error: session.reason, code: session.code });
      }

      return reply.status(200).send({
        sessionToken: session.token,
        expiresAt: session.expiresAt,
        address: parsed.data.address.toLowerCase()
      });
    });

    // Sign out: revoke the session server-side. Returns ok even when the
    // token was already invalid - logout is idempotent from the user's view.
    app.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = logoutRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return validationError(reply, 'Invalid logout request', parsed.error.issues);
      }
      deps.revokeSessionToken(parsed.data.sessionToken);
      return reply.status(200).send({ ok: true });
    });
  };
}

export const authRoutes = createAuthRoutes();
