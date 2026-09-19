import { execFileSync } from 'node:child_process';

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
