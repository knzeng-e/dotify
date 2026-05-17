import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { config } from './config.js';
import { fastifyLoggerOptions } from './logger.js';
import { authRoutes } from './routes/auth.js';
import { healthRoutes } from './routes/health.js';
import { keyRoutes } from './routes/keys.js';

const app = Fastify({ logger: fastifyLoggerOptions });

// CORS — restricted to the configured frontend origin.
await app.register(cors, {
  origin: config.API_ORIGIN,
  methods: ['GET', 'POST', 'OPTIONS'],
});

// Rate limiting — placeholder; tune limits before production traffic.
await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

// Routes.
await app.register(healthRoutes);
await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(keyRoutes, { prefix: '/api/tracks' });

app.setErrorHandler((error, request, reply) => {
  request.log.error({ err: error }, 'Unhandled error');
  return reply.status(500).send({ error: 'Internal server error' });
});

await app.listen({ port: config.API_PORT, host: '0.0.0.0' });
