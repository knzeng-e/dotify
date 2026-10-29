import { sharedState, assertSharedState } from './services/sharedState/index.js';
import { SharedStateUnavailableError } from './services/sharedState/postgres.js';
import { custodyTokenMatches, registerCustodyProxy } from './services/sharedState/custodyProxy.js';
import { StreamingJobs } from './services/streamingJobs.js';
import { createStreamingWorkerClient } from './services/streamingWorkerClient.js';
import { deriveContentKeyBytes } from './services/keyVault.js';
import { checkArtistAuthority } from './services/chainAccess.js';
import { pinFilesToPinata } from './services/pinata.js';
// Fastify app assembly, extracted from index.ts so tests can build the full
// app (request IDs, error envelope, route registration) without listening.

import Fastify, { type FastifyError, type FastifyInstance, type FastifyRequest, type FastifyServerOptions } from 'fastify';
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
import { turnRoutes } from './routes/turn.js';
import { createUploadRoutes } from './routes/uploads.js';
import { createCatalogRoutes } from './routes/catalog.js';
import { createMediaRoutes } from './routes/media.js';
import { NativeContributionLedger } from './services/nativeContributionLedger.js';
import { createContributionHistoryRoutes } from './routes/contributionHistory.js';
import { createNativeReceiptRoutes } from './routes/nativeReceipts.js';
import { createNativeReceiptService } from './services/nativeReceipts.js';
import { catalogReadModel as defaultCatalogReadModel, mediaPrewarmer } from './services/catalog/index.js';
import type { CatalogReadModel } from './services/catalog/readModel.js';

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

// Fly's edge sets Fly-Client-IP on every request it forwards; a client value
// is overwritten. Use it only when the deployment says Fly is in front.
export function clientIdentity(request: Pick<FastifyRequest, 'headers' | 'ip'>, trustProxy: 'off' | 'fly') {
  if (trustProxy === 'fly') {
    const header = request.headers['fly-client-ip'];
    const value = Array.isArray(header) ? header[0] : header;
    if (value && value.trim()) return { key: value.trim(), source: 'fly-client-ip' };
  }
  return { key: request.ip, source: 'socket' };
}

export function rateLimitKey(request: Pick<FastifyRequest, 'headers' | 'ip'>, trustProxy: 'off' | 'fly'): string {
  return clientIdentity(request, trustProxy).key;
}

export type BuildAppOptions = {
  trustProxy?: 'off' | 'fly';
  // Test sink observes the exact bounded fields sent to the production logger.
  identityDiagnostic?: (fields: { event: string; source: string; clientMatchesPeer: boolean }) => void;
  // Tests disable logging; production always logs.
  logging?: boolean;
  catalog?: CatalogReadModel;
  apiOrigins?: string[];
};

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  await assertSharedState();
  const serverOptions: FastifyServerOptions = {
    logger: options.logging === false ? false : fastifyLoggerOptions,
    genReqId
  };
  const app = Fastify(serverOptions);
  let streaming: StreamingJobs | undefined;
  // Five trusted-header samples per process, with no IP, token, wallet, room
  // or location attached. Use the same resolver as rate limiting, not a second
  // interpretation of the proxy headers. Direct/health probes consume no samples.
  let identitySamples = 0;
  app.addHook('onRequest', async request => {
    if (identitySamples >= 5) return;
    const identity = clientIdentity(request, options.trustProxy ?? config.API_TRUST_PROXY);
    if (identity.source === 'socket') return;
    identitySamples += 1;
    const fields = { event: 'network:client-identity', source: identity.source, clientMatchesPeer: identity.key === request.ip };
    request.log.info(fields, 'Trusted proxy client identity');
    options.identityDiagnostic?.(fields);
  });

  // CORS — restricted to the configured standalone and Product-host origins.
  await app.register(cors, {
    origin: options.apiOrigins ?? config.API_ORIGINS,
    methods: ['GET', 'POST', 'OPTIONS'],
    exposedHeaders: ['x-request-id', 'etag', 'x-catalog-state', 'x-catalog-block-lag', 'content-range', 'accept-ranges']
  });

  // Multipart — required by upload routes. Register before routes.
  // Edge proxy scopes must receive the raw multipart stream. Inheriting the
  // specific multipart parser would consume it before the proxy's '*' parser.
  if (config.API_ROLE !== 'edge') await app.register(multipart);

  // Rate limiting per client. Behind Fly every connection comes from the
  // proxy, so without API_TRUST_PROXY=fly all users would share one budget.
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: request => rateLimitKey(request, options.trustProxy ?? config.API_TRUST_PROXY)
  });

  if (sharedState) {
    if (!config.CUSTODY_SERVICE_TOKEN || (config.API_ROLE === 'edge' && !config.CUSTODY_SERVICE_URL))
      throw new Error('Shared mode requires a private authenticated custody service');
    if (config.API_ROLE === 'edge' && (config.STREAMING_WORKER_URL || config.STREAMING_WORKER_TOKEN))
      throw new Error('Only the custody role may run the streaming queue');
    app.addHook('onRequest', async (request, reply) => {
      const pathname = request.url.split('?')[0];
      const custodyRoute = pathname.startsWith('/api/uploads') || pathname.startsWith('/api/contributions');
      if (config.API_ROLE === 'custody' && custodyRoute && !custodyTokenMatches(request.headers['x-dotify-custody'], config.CUSTODY_SERVICE_TOKEN!))
        return reply.code(403).send({ code: 'PRIVATE_SERVICE', error: 'Use the Dotify application to continue.' });
      if (custodyRoute || pathname.startsWith('/api/tracks') || pathname.startsWith('/api/auth') || pathname === '/health/ready') await assertSharedState();
    });
  }

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
    if (error instanceof SharedStateUnavailableError) {
      request.log.warn({ code: error.code }, 'Shared state unavailable');
      return reply
        .code(503)
        .header('Retry-After', '3')
        .send({ code: error.code, error: error.message, requestId: String(request.id) });
    }
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
      requestId: String(request.id)
    };
    return reply.status(status).send(body);
  });

  // Routes.
  await app.register(healthRoutes);
  if (config.API_ROLE === 'edge') {
    await registerCustodyProxy(app, {
      origin: config.CUSTODY_SERVICE_URL!,
      token: config.CUSTODY_SERVICE_TOKEN!,
      production: config.NODE_ENV === 'production',
      clientIp: request => clientIdentity(request, options.trustProxy ?? config.API_TRUST_PROXY).key
    });
  } else {
    const nativeReceipts = createNativeReceiptService({ rpcUrl: config.PASEO_ASSET_HUB_NATIVE_RPC, chainId: config.DOTIFY_CHAIN_ID });
    const contributionLedger = new NativeContributionLedger(config.NATIVE_CONTRIBUTION_SNAPSHOT_PATH);
    await app.register(
      createNativeReceiptRoutes({
        serviceToken: config.NATIVE_RECEIPT_SERVICE_TOKEN,
        read: async input => {
          const receipt = await nativeReceipts.read(input);
          await contributionLedger.record(receipt);
          return receipt;
        }
      })
    );
    await app.register(createContributionHistoryRoutes(contributionLedger, Boolean(config.PASEO_ASSET_HUB_NATIVE_RPC) && config.DOTIFY_CHAIN_ID === 420420417));
  }
  if (config.API_ROLE !== 'custody') {
    await app.register(authRoutes, { prefix: '/api/auth' });
    await app.register(turnRoutes, { prefix: '/api/turn' });
    await app.register(keyRoutes, { prefix: '/api/tracks' });
  }
  if (config.API_ROLE !== 'edge') {
    if (sharedState) {
      const release = await sharedState.holdExclusive('custody-owner', () => {
        app.log.error({ code: 'CUSTODY_LEASE_LOST' }, 'Custody store connection lost; closing admission and encoder');
        void streaming?.stop();
        void app.close();
      });
      app.addHook('onClose', release);
    }
    if (Boolean(config.STREAMING_WORKER_URL) !== Boolean(config.STREAMING_WORKER_TOKEN))
      throw new Error('Configure both the isolated streaming worker URL and token');
    if (config.STREAMING_WORKER_URL && config.STREAMING_WORKER_TOKEN) {
      if (config.NODE_ENV === 'production' && process.getuid?.() !== 1000)
        throw new Error('Streaming activation requires the reviewed non-root UID 1000 API image');
      if (config.UPLOAD_GLOBAL_CONCURRENCY > 2) throw new Error('Streaming publication requires UPLOAD_GLOBAL_CONCURRENCY at most 2');
      streaming = new StreamingJobs({
        directory: config.STREAMING_STATE_PATH,
        deriveKey: deriveContentKeyBytes,
        authority: async (owner, runtime, chainId) => {
          if (chainId !== config.DOTIFY_CHAIN_ID) return false;
          const result = await checkArtistAuthority(owner);
          return result.allowed && result.runtime.toLowerCase() === runtime;
        },
        transcode: createStreamingWorkerClient(config.STREAMING_WORKER_URL, config.STREAMING_WORKER_TOKEN),
        pin: (files, name, signal) => pinFilesToPinata(files, name, { app: 'dotify', type: 'streaming-audio' }, signal),
        onFailure: failure => app.log.warn({ code: 'STREAMING_PREPARATION_FAILED', ...failure }, 'Audio preparation needs attention')
      });
      await streaming.start();
      app.addHook('onClose', async () => streaming!.stop());
    }
    await app.register(createUploadRoutes(undefined, streaming), { prefix: '/api/uploads' });
  }
  if (config.API_ROLE !== 'custody') {
    const catalog = options.catalog ?? defaultCatalogReadModel;
    await catalog.start();
    app.addHook('onClose', async () => {
      catalog.stop();
      if (catalog === defaultCatalogReadModel) mediaPrewarmer?.close();
    });
    await app.register(createCatalogRoutes({ catalog }));
    await app.register(createMediaRoutes({ catalog }));
  }
  return app;
}
