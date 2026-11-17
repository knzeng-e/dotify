import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import proxy from '@fastify/http-proxy';

export function custodyTokenMatches(actual: string | string[] | undefined, expected: string): boolean {
  return typeof actual === 'string' && timingSafeEqual(createHash('sha256').update(actual).digest(), createHash('sha256').update(expected).digest());
}
export function validateCustodyOrigin(origin: string, production: boolean): string {
  const url = new URL(origin);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Custody URL must be a private origin');
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Invalid custody transport');
  if (production ? !url.hostname.endsWith('.internal') : !loopback && !url.hostname.endsWith('.internal'))
    throw new Error('Custody must use the private service network');
  return url.origin;
}
export async function registerCustodyProxy(
  app: FastifyInstance,
  options: { origin: string; token: string; production: boolean; clientIp?: (request: Pick<import('fastify').FastifyRequest, 'headers' | 'ip'>) => string }
) {
  const upstream = validateCustodyOrigin(options.origin, options.production);
  for (const prefix of ['/api/uploads', '/api/contributions']) {
    await app.register(proxy, {
      upstream,
      prefix,
      rewritePrefix: prefix,
      websocket: false,
      destroyAgent: true,
      config: { rateLimit: false },
      replyOptions: {
        retryDelay: () => null,
        rewriteRequestHeaders: (request, headers) => ({
          ...headers,
          'x-dotify-custody': options.token,
          'x-request-id': String(request.id),
          // The custody service rate limiter must see the trusted edge identity,
          // never a public caller's forwarded header.
          'fly-client-ip': options.clientIp?.(request) ?? request.ip
        }),
        onError: reply => {
          void reply
            .code(503)
            .send({
              code: 'CUSTODY_UNAVAILABLE',
              error: 'Publishing is temporarily unavailable. Please try again shortly.',
              requestId: String(reply.request.id)
            });
        }
      }
    });
  }
}
