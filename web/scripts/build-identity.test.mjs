import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { assertCleanEvidenceBuild, readGitBuildIdentity } from './build-identity.mjs';

describe('build identity', () => {
  it('marks a commit as clean only when git reports no tracked or untracked changes', () => {
    const clean = readGitBuildIdentity('/repo', (_command, args) => (args.includes('rev-parse') ? 'a'.repeat(40) : ''));
    const dirty = readGitBuildIdentity('/repo', (_command, args) => (args.includes('rev-parse') ? 'b'.repeat(40) : ' M web/src/App.tsx'));

    assert.deepEqual(clean, { gitSha: 'a'.repeat(40), clean: true });
    assert.deepEqual(dirty, { gitSha: 'b'.repeat(40), clean: false });
  });

  it('fails a debug evidence build when the worktree cannot prove exact bytes', () => {
    assert.throws(() => assertCleanEvidenceBuild('build', { VITE_DOTIFY_DEBUG_PANEL: 'true' }, { gitSha: 'a'.repeat(40), clean: false }), /clean git worktree/);
    assert.doesNotThrow(() => assertCleanEvidenceBuild('serve', { VITE_DOTIFY_DEBUG_PANEL: 'true' }, { gitSha: 'a'.repeat(40), clean: false }));
    assert.doesNotThrow(() => assertCleanEvidenceBuild('build', {}, { gitSha: 'a'.repeat(40), clean: false }));
  });
});
