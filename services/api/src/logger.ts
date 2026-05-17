import { config } from './config.js';

// Fastify logger options. Passed to the Fastify constructor at startup.
export const fastifyLoggerOptions = {
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
} as const;
