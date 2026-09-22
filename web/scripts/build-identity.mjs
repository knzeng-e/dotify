import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const IDENTITY_ENV_KEYS = new Set(['VITE_DOTIFY_BUILD_SHA', 'VITE_DOTIFY_BUILD_CLEAN', 'VITE_DOTIFY_BUILD_CONFIG_DIGEST']);

export function computeBuildConfigDigest(mode, env, extras = {}) {
  const publicBuildEnv = Object.fromEntries(
    Object.entries(env)
      .filter(([key, value]) => key.startsWith('VITE_') && !IDENTITY_ENV_KEYS.has(key) && value !== undefined)
      .map(([key, value]) => [key, String(value)])
      .sort(([left], [right]) => left.localeCompare(right))
  );
  const stableExtras = Object.fromEntries(Object.entries(extras).sort(([left], [right]) => left.localeCompare(right)));
  return createHash('sha256')
    .update(JSON.stringify({ mode, publicBuildEnv, extras: stableExtras }))
    .digest('hex');
}

export function readGitBuildIdentity(cwd, run = execFileSync) {
  try {
    const gitSha = run('git', ['-C', cwd, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    const status = run('git', ['-C', cwd, 'status', '--porcelain=v1', '--untracked-files=all'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    return { gitSha, clean: status.length === 0 };
  } catch {
    return { gitSha: 'unknown', clean: false };
  }
}

export function assertCleanEvidenceBuild(command, env, identity) {
  if (command !== 'build' || String(env.VITE_DOTIFY_DEBUG_PANEL).toLowerCase() !== 'true' || identity.clean) return;
  throw new Error(
    'First-sound evidence builds require a clean git worktree. Commit or discard local changes, then rebuild so the embedded SHA identifies the exact bytes.'
  );
}

export function resolveEmbeddedBuildIdentity(command, env, identity) {
  const override = String(env.VITE_DOTIFY_BUILD_SHA ?? '').trim();
  const e2eServe = command === 'serve' && env.VITE_E2E_READINESS_PANEL === 'true';

  if (e2eServe) {
    return {
      gitSha: override || identity.gitSha,
      clean: true
    };
  }

  if (command === 'build' && override && override !== identity.gitSha) {
    throw new Error(
      `VITE_DOTIFY_BUILD_SHA (${override}) does not match the checked-out commit (${identity.gitSha}). Evidence builds must derive their identity from git.`
    );
  }

  return identity;
}
