// Health, version, and readiness endpoints (Sprint 2, Ticket 10).
//
// GET /health        — liveness: the process is up. Never touches the chain.
// GET /version       — package version plus deploy commit SHA when known.
// GET /health/ready  — readiness: runs the dependency diagnostics (config,
//                      RPC reachability + chain ID match, artist directory,
//                      factory code, Pinata) and answers 503 when the
//                      key-delivery spine cannot work. Booleans and details
//                      only; never secret material.

import type { FastifyInstance } from 'fastify';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { config } from '../config.js';
import { runDiagnostics as defaultRunDiagnostics, type DiagnosticsReport } from '../services/diagnostics.js';

function getVersion(): string {
  try {
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '../../package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string };
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function getCommitSha(): string {
  const fromEnv = config.GIT_COMMIT_SHA;
  if (fromEnv && /^[0-9a-fA-F]{7,40}$/.test(fromEnv)) return fromEnv;
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'unknown';
  }
}

const VERSION = getVersion();
const COMMIT_SHA = getCommitSha();
const STARTED_AT = Date.now();

export type HealthRouteDeps = {
  runDiagnostics: () => Promise<DiagnosticsReport>;
};

export function createHealthRoutes(deps: HealthRouteDeps) {
  return async function healthRoutes(app: FastifyInstance): Promise<void> {
    app.get('/health', async () => ({
      status: 'ok',
      uptime: Math.floor((Date.now() - STARTED_AT) / 1000),
      version: VERSION,
    }));

    app.get('/version', async () => ({
      version: VERSION,
      commitSha: COMMIT_SHA,
    }));

    app.get('/health/ready', async (request, reply) => {
      const report = await deps.runDiagnostics();
      if (!report.ready) {
        request.log.warn({ diagnostics: report }, 'Readiness check failed');
      }
      return reply.status(report.ready ? 200 : 503).send(report);
    });
  };
}

export const healthRoutes = createHealthRoutes({ runDiagnostics: defaultRunDiagnostics });
