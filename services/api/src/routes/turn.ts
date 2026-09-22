import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { createConfiguredTurnGrant, type TurnGrant } from '../services/turnGrants.js';
import { verifyTurnCapability, type TurnCapability } from '../services/turnCapabilities.js';

export type TurnRouteDeps = {
  capabilityConfigured: boolean;
  createGrant: (subject: string) => TurnGrant | null;
  verifyCapability: (token: string) => TurnCapability | null;
};

const defaultDeps: TurnRouteDeps = {
  capabilityConfigured: Boolean(config.TURN_CAPABILITY_SECRET),
  createGrant: subject => createConfiguredTurnGrant(config, new Date(), subject),
  verifyCapability: token => verifyTurnCapability(token, config.TURN_CAPABILITY_SECRET ?? '')
};

function bearerToken(header: string | undefined): string {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? '';
}

export function createTurnRoutes(deps: TurnRouteDeps = defaultDeps) {
  return async function turnRoutes(app: FastifyInstance): Promise<void> {
    app.get('/grant', async (request, reply) => {
      if (!deps.capabilityConfigured) {
        return reply.status(503).send({
          error: 'TURN room authorization is not configured.',
          code: 'TURN_CAPABILITY_NOT_CONFIGURED'
        });
      }

      const token = bearerToken(request.headers.authorization);
      if (!token) {
        return reply.status(401).send({
          error: 'Join or open a room before requesting relay access.',
          code: 'TURN_CAPABILITY_REQUIRED'
        });
      }

      const capability = deps.verifyCapability(token);
      if (!capability) {
        return reply.status(403).send({
          error: 'Room relay authorization is invalid or expired.',
          code: 'TURN_CAPABILITY_INVALID'
        });
      }

      const grant = deps.createGrant(`${capability.role}-${capability.roomId}-${capability.participantId}`);
      if (!grant) {
        return reply.status(503).send({
          error: 'TURN relay is not configured.',
          code: 'TURN_NOT_CONFIGURED'
        });
      }

      return reply.send(grant);
    });
  };
}

export const turnRoutes = createTurnRoutes();
