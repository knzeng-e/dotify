import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { createHealthRoutes } from './health.js';
import type { DiagnosticsReport } from '../services/diagnostics.js';

function report(overrides: Partial<DiagnosticsReport> = {}): DiagnosticsReport {
  return {
    status: 'ok',
    ready: true,
    checkedAt: new Date().toISOString(),
    checks: {
      contentKeySecret: { ok: true, detail: 'configured' },
      rpc: { ok: true, detail: 'reachable', expectedChainId: 420420417, chainId: 420420417 },
      directory: { ok: true, detail: 'readable' },
      factory: { ok: true, detail: 'code present' },
      pinata: { ok: true, detail: 'configured' },
    },
    ...overrides,
  };
}

let app: FastifyInstance | null = null;

async function buildApp(diagnostics: DiagnosticsReport): Promise<FastifyInstance> {
  app = Fastify();
  await app.register(createHealthRoutes({ runDiagnostics: async () => diagnostics }));
  return app;
}

afterEach(async () => {
  if (app) await app.close();
  app = null;
});

describe('GET /health', () => {
  it('reports liveness with uptime and version', async () => {
    const server = await buildApp(report());
    const response = await server.inject({ method: 'GET', url: '/health' });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.status, 'ok');
    assert.equal(typeof body.uptime, 'number');
    assert.equal(typeof body.version, 'string');
  });
});

describe('GET /version', () => {
  it('reports the package version and a commit SHA field', async () => {
    const server = await buildApp(report());
    const response = await server.inject({ method: 'GET', url: '/version' });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(typeof body.version, 'string');
    assert.equal(typeof body.commitSha, 'string');
    assert.notEqual(body.commitSha, '');
  });
});

describe('GET /health/ready', () => {
  it('answers 200 with the full diagnostics report when ready', async () => {
    const server = await buildApp(report());
    const response = await server.inject({ method: 'GET', url: '/health/ready' });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.ready, true);
    assert.equal(body.status, 'ok');
    assert.equal(body.checks.rpc.chainId, 420420417);
  });

  it('answers 503 when the key-delivery spine cannot work', async () => {
    const failing = report({
      status: 'unavailable',
      ready: false,
    });
    failing.checks.rpc = { ok: false, detail: 'RPC unreachable', expectedChainId: 420420417, chainId: null };
    const server = await buildApp(failing);
    const response = await server.inject({ method: 'GET', url: '/health/ready' });

    assert.equal(response.statusCode, 503);
    const body = response.json();
    assert.equal(body.ready, false);
    assert.equal(body.status, 'unavailable');
    assert.equal(body.checks.rpc.ok, false);
  });

  it('never leaks secret material in the report', async () => {
    const server = await buildApp(report());
    const response = await server.inject({ method: 'GET', url: '/health/ready' });

    const raw = response.body.toLowerCase();
    assert.ok(!raw.includes('jwt '), 'no raw JWT');
    assert.ok(!raw.includes('secret":"0x'), 'no hex secret values');
  });
});
