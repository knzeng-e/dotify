import { z } from 'zod';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadLocalEnv(): void {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, 'utf-8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const equalsAt = trimmed.indexOf('=');
    if (equalsAt === -1) continue;

    const key = trimmed.slice(0, equalsAt).trim();
    const value = trimmed.slice(equalsAt + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = value;
  }
}

loadLocalEnv();

const optionalNonEmptyString = z.preprocess(
  value => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().optional(),
);

const optionalOriginList = z.preprocess(
  value =>
    typeof value === 'string'
      ? value
          .split(',')
          .map(origin => origin.trim())
          .filter(Boolean)
      : value,
  z.array(z.string().url()).min(1).optional(),
);

const optionalTurnUrlList = z.preprocess(
  value =>
    typeof value === 'string'
      ? value
          .split(',')
          .map(url => url.trim())
          .filter(Boolean)
      : value,
  z
    .array(
      z.string().refine(url => /^turns?:[^\s,]+$/i.test(url), {
        message: 'TURN URLs must start with turn: or turns:',
      }),
    )
    .min(1)
    .optional(),
);

const envSchema = z.object({
  API_PORT: z.coerce.number().int().min(1).max(65535).default(8790),
  API_ORIGIN: z.string().url().default('http://localhost:5273'),
  API_ORIGINS: optionalOriginList,
  PASEO_ASSET_HUB_RPC: z.string().url().optional(),
  DOTIFY_FACTORY_ADDRESS: optionalNonEmptyString,
  DOTIFY_DIRECTORY_ADDRESS: optionalNonEmptyString,
  DOTIFY_CHAIN_ID: z.coerce.number().int().default(420420417),
  CATALOG_SNAPSHOT_PATH: z.string().default('.data/catalog.json'),
  CATALOG_POLL_INTERVAL_MS: z.coerce.number().int().min(1_000).default(10_000),
  CATALOG_RECONCILE_INTERVAL_MS: z.coerce.number().int().min(10_000).default(300_000),
  CATALOG_STALE_AFTER_MS: z.coerce.number().int().min(1_000).default(60_000),
  CATALOG_CONFIRMATIONS: z.coerce.number().int().min(0).max(100).default(2),
  // Master secret for HKDF per-track key derivation (hex, 32+ bytes). Must
  // never reach the frontend. Both the upload encryption path and the
  // content-key delivery path derive from this value (services/keyVault.ts).
  CONTENT_KEY_MASTER_SECRET: z.preprocess(
    value => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z
      .string()
      .regex(/^(0x)?[0-9a-fA-F]{64,}$/, 'CONTENT_KEY_MASTER_SECRET must be hex encoding at least 32 bytes')
      .optional(),
  ),
  // Pinata JWT — must stay server-side only. Never expose in frontend env.
  PINATA_JWT: optionalNonEmptyString,
  // Upload authorizations are short-lived, single-use capabilities. Byte
  // quotas are rolling, in-memory counters for the enforced single API
  // instance; a process restart invalidates every outstanding capability.
  UPLOAD_AUTH_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(30)
    .max(15 * 60)
    .default(5 * 60),
  UPLOAD_QUOTA_WINDOW_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(24 * 60 * 60)
    .default(60 * 60),
  UPLOAD_PRINCIPAL_BYTES_PER_WINDOW: z.coerce
    .number()
    .int()
    .positive()
    .default(200 * 1024 * 1024),
  UPLOAD_GLOBAL_BYTES_PER_WINDOW: z.coerce
    .number()
    .int()
    .positive()
    .default(2 * 1024 * 1024 * 1024),
  UPLOAD_PRINCIPAL_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(2),
  UPLOAD_GLOBAL_CONCURRENCY: z.coerce.number().int().min(1).max(64).default(8),
  // TURN relay grants for production room WebRTC. TURN_URLS is browser-safe;
  // TURN_REST_SECRET is the server-side HMAC secret shared with the TURN relay.
  TURN_URLS: optionalTurnUrlList,
  TURN_REST_SECRET: optionalNonEmptyString,
  TURN_USERNAME: optionalNonEmptyString,
  TURN_CREDENTIAL: optionalNonEmptyString,
  TURN_TTL_SECONDS: z.coerce.number().int().min(60).max(24 * 60 * 60).default(3600),
  // Deploy-time commit SHA surfaced by /version (set by CI/Docker builds; the
  // service falls back to `git rev-parse HEAD` in dev checkouts).
  GIT_COMMIT_SHA: optionalNonEmptyString,
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

function parseEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    console.error(`[dotify-api] Invalid environment configuration:\n${issues}`);
    process.exit(1);
  }
  return {
    ...result.data,
    API_ORIGINS: result.data.API_ORIGINS ?? [result.data.API_ORIGIN],
  };
}

export const config = parseEnv();
export type Config = typeof config;
