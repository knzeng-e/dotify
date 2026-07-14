import { config } from './config.js';

// Fastify logger options. Passed to the Fastify constructor at startup.
// Redaction is a guardrail, not the primary defense: secrets must never be
// put on log objects in the first place (CONTENT_KEY_MASTER_SECRET,
// PINATA_JWT, derived content keys, session tokens).
export const fastifyLoggerOptions = {
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.sessionToken',
      'req.body.signature',
    ],
    censor: '[redacted]',
  },
};
