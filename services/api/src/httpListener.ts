import type { FastifyInstance } from 'fastify';

/** Fly's private service network is IPv6; keep public IPv4 ingress working too. */
export function listenApi(app: Pick<FastifyInstance, 'listen'>, port: number): Promise<string> {
  return app.listen({ port, host: '::', ipv6Only: false });
}
