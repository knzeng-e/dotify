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

const envSchema = z.object({
  API_PORT: z.coerce.number().int().min(1).max(65535).default(8790),
  API_ORIGIN: z.string().url().default('http://localhost:5273'),
  PASEO_ASSET_HUB_RPC: z.string().url().optional(),
  DOTIFY_FACTORY_ADDRESS: optionalNonEmptyString,
  DOTIFY_DIRECTORY_ADDRESS: optionalNonEmptyString,
  DOTIFY_CHAIN_ID: z.coerce.number().int().default(420420417),
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
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

function parseEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    console.error(`[dotify-api] Invalid environment configuration:\n${issues}`);
    process.exit(1);
  }
  return result.data;
}

export const config = parseEnv();
export type Config = typeof config;
