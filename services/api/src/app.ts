// Fastify app assembly, extracted from index.ts so tests can build the full
// app (request IDs, error envelope, route registration) without listening.

import Fastify, { type FastifyError, type FastifyInstance, type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { config } from './config.js';
import { fastifyLoggerOptions } from './logger.js';
import { authRoutes } from './routes/auth.js';
import { healthRoutes } from './routes/health.js';
import { keyRoutes } from './routes/keys.js';
import { uploadRoutes } from './routes/uploads.js';

// Every response carries a correlation ID (echoed from a well-formed incoming
// x-request-id, otherwise generated) so a user-reported failure can be matched
// to one structured log line. Error responses share one typed envelope.
export type ApiErrorBody = {
  error: string;
  code: string;
  requestId: string;
};

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,64}$/;

function genReqId(request: IncomingMessage): string {
  const incoming = request.headers['x-request-id'];
  const value = Array.isArray(incoming) ? incoming[0] : incoming;
  if (value && REQUEST_ID_PATTERN.test(value)) return value;
  return randomUUID();
}

export type BuildAppOptions = {
  // Tests disable logging; production always logs.
  logging?: boolean;
};

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const serverOptions: FastifyServerOptions = {
    logger: options.logging === false ? false : fastifyLoggerOptions,
    genReqId,
  };
  const app = Fastify(serverOptions);

  // CORS — restricted to the configured frontend origin.
  await app.register(cors, {
    origin: config.API_ORIGIN,
    methods: ['GET', 'POST', 'OPTIONS'],
    exposedHeaders: ['x-request-id'],
  });

  // Multipart — required by upload routes. Register before routes.
  await app.register(multipart);

  // Rate limiting — placeholder; tune limits before production traffic.
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  // Error envelope and 404 handler must be set before the route plugins are
  // registered: encapsulated plugin scopes capture the handlers that exist at
  // registration time, so a later setErrorHandler would not reach them.
  app.setNotFoundHandler((request, reply) => {
    const body: ApiErrorBody = { error: 'Route not found', code: 'NOT_FOUND', requestId: String(request.id) };
    return reply.status(404).send(body);
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    // Respect framework errors that carry a status (rate limit 429, malformed
    // body 400, payload too large 413); everything else is a 500 with the
    // internals kept out of the response body.
    const status = typeof error.statusCode === 'number' && error.statusCode >= 400 ? error.statusCode : 500;
    if (status >= 500) {
      request.log.error({ err: error }, 'Unhandled error');
    } else {
      request.log.warn({ err: error }, 'Request error');
    }
    const body: ApiErrorBody = {
      error: status >= 500 ? 'Internal server error' : error.message,
      code: status >= 500 ? 'INTERNAL_ERROR' : (error.code ?? 'REQUEST_ERROR'),
      requestId: String(request.id),
    };
    return reply.status(status).send(body);
  });

  // Routes.
  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(keyRoutes, { prefix: '/api/tracks' });
  await app.register(uploadRoutes, { prefix: '/api/uploads' });

  return app;
}
