import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { createConfiguredTurnGrant, type TurnGrant } from '../services/turnGrants.js';

export type TurnRouteDeps = {
  createGrant: () => TurnGrant | null;
};

const defaultDeps: TurnRouteDeps = {
  createGrant: () => createConfiguredTurnGrant(config),
};

export function createTurnRoutes(deps: TurnRouteDeps = defaultDeps) {
  return async function turnRoutes(app: FastifyInstance): Promise<void> {
    app.get('/grant', async (_request, reply) => {
      const grant = deps.createGrant();
      if (!grant) {
        return reply.status(503).send({
          error: 'TURN relay is not configured.',
          code: 'TURN_NOT_CONFIGURED',
        });
      }

      return reply.send(grant);
    });
  };
}

export const turnRoutes = createTurnRoutes();
