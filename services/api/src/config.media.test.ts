import { it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
function check(values: Record<string, string>) {
  return spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', "await import('./src/config.ts')"], {
    env: { ...process.env, MEDIA_EDGE_URL: '', MEDIA_IPFS_GATEWAY: '', BULLETIN_MEDIA_RPC_URL: '', ...values },
    encoding: 'utf8'
  });
}
it('media configuration accepts only public credential-free origins and a dedicated gateway', () => {
  assert.equal(check({ MEDIA_EDGE_URL: 'https://media.example', MEDIA_IPFS_GATEWAY: 'https://owned.mypinata.cloud' }).status, 0);
  for (const value of [
    'http://media.example',
    'https://user:secret@media.example',
    'https://media.example?token=secret',
    'https://media.example/ipfs',
    'https://localhost',
    'https://[::1]'
  ]) {
    const result = check({ MEDIA_EDGE_URL: value });
    assert.equal(result.status, 1);
    assert(!result.stderr.includes('user:secret'));
    assert.match(result.stderr, /MEDIA_EDGE_URL/);
  }
  assert.equal(check({ MEDIA_IPFS_GATEWAY: 'https://arbitrary.example' }).status, 1);
});

it('Bulletin media RPC is optional and never accepts credentials or client-selected paths', () => {
  assert.equal(check({ BULLETIN_MEDIA_RPC_URL: '' }).status, 0);
  assert.equal(check({ BULLETIN_MEDIA_RPC_URL: 'https://bulletin.example:8443' }).status, 0);
  for (const value of [
    'http://bulletin.example',
    'https://user:secret@bulletin.example',
    'https://bulletin.example?token=secret',
    'https://bulletin.example/rpc',
    'https://localhost',
    'https://bulletin.local',
    'https://127.0.0.1',
    'https://[::1]'
  ]) {
    const result = check({ BULLETIN_MEDIA_RPC_URL: value });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /BULLETIN_MEDIA_RPC_URL/);
    assert(!result.stderr.includes('user:secret'));
    assert(!result.stderr.includes('token=secret'));
  }
});

it('readiness does not demand a Pinata key on edges or a fully Bulletin custody path', () => {
  const run = (values: Record<string, string>) =>
    spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        '--input-type=module',
        '-e',
        "const {createDiagnostics}=await import('./src/services/diagnostics.ts'); const report=await createDiagnostics({getChainId:async()=>420420417,readArtistCount:async()=>0n,getCode:async()=>undefined,now:()=>0})();console.log(JSON.stringify(report.checks.pinata));"
      ],
      {
        env: { ...process.env, PINATA_JWT: '', API_ROLE: 'combined', STREAMING_AUDIO_STORAGE: 'pinata', PUBLIC_ASSET_STORAGE: 'pinata', ...values },
        encoding: 'utf8'
      }
    );
  for (const values of [{ API_ROLE: 'edge' }, { API_ROLE: 'custody', STREAMING_AUDIO_STORAGE: 'bulletin', PUBLIC_ASSET_STORAGE: 'bulletin' }] as Record<
    string,
    string
  >[]) {
    const result = run(values);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).ok, true);
  }
  const mixed = run({ STREAMING_AUDIO_STORAGE: 'bulletin' });
  assert.equal(mixed.status, 0, mixed.stderr);
  assert.equal(JSON.parse(mixed.stdout).ok, false);
});
