import assert from 'node:assert/strict';
import { it } from 'node:test';
import Fastify from 'fastify';
import { registerCustodyProxy } from './custodyProxy.js';

it('forwards royalty history and native receipt checks to custody with trusted edge identity', async () => {
  const custody = Fastify();
  custody.post('/*', async request => ({
    path: request.url,
    body: request.body,
    token: request.headers['x-dotify-custody'],
    client: request.headers['fly-client-ip']
  }));
  const origin = await custody.listen({ host: '127.0.0.1', port: 0 });
  const edge = Fastify();
  try {
    await registerCustodyProxy(edge, { origin, production: false, token: 'test-custody-token', clientIp: () => '203.0.113.7' });
    for (const path of ['/api/payments/native-receipt', '/api/royalties/history']) {
      const body = { marker: 'public-read-reference' };
      const response = await edge.inject({
        method: 'POST',
        url: path,
        payload: body,
        headers: { 'x-dotify-custody': 'forged', 'fly-client-ip': '198.51.100.1' }
      });
      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json(), { path, body, token: 'test-custody-token', client: '203.0.113.7' });
    }
  } finally {
    await edge.close();
    await custody.close();
  }
});
