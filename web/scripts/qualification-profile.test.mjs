import assert from 'node:assert/strict';
import test from 'node:test';
import { assertQualificationBuild, assertQualificationGraph } from './qualification-profile.mjs';

test('a qualification artifact requires a clean source without E2E or browser secrets', () => {
  const identity = { gitSha: 'a'.repeat(40), clean: true };
  assertQualificationBuild(identity, {});
  for (const env of [
    { VITE_E2E_ARTIST_PUBLISH: 'true' },
    { VITE_E2E_CLASSIC_UNLOCK: true },
    { VITE_PINATA_JWT: 'private' },
    { VITE_CONTENT_SECRET: 'private' }
  ])
    assert.throws(() => assertQualificationBuild(identity, env));
  assert.throws(() => assertQualificationBuild({ ...identity, clean: false }, {}));
  assert.throws(() => assertQualificationBuild({ ...identity, gitSha: 'unknown' }, {}));
});

test('rendered application, runtime and fake Host capabilities cannot enter the artifact', () => {
  const graph = (id, length = 1) => [
    { output: [{ type: 'chunk', modules: { '/web/src/qualification/HostQualification.tsx': { renderedLength: 1 }, [id]: { renderedLength: length } } }] }
  ];
  assertQualificationGraph(graph('/web/src/features/productHost/productHostInfo.ts'));
  for (const id of [
    '/web/src/App.tsx',
    '/web/src/hooks/useWallet.ts',
    '/web/src/features/runtime/productCdmRuntimeAdapter.ts',
    '/web/src/features/productHost/productHost.ts',
    '/web/src/services/catalog.ts',
    '/web/src/services/productDevnetCatalogBootstrap.ts',
    '/web/src/e2e/artistPublishMock.ts',
    '/web/src/features/rooms/RoomPublisher.ts',
    '/web/node_modules/@parity/product-sdk-host/dist/testing.js',
    '/web/node_modules/@parity/product-sdk-descriptors/dist/index.js'
  ])
    assert.throws(() => assertQualificationGraph(graph(id)), id);
  assertQualificationGraph(graph('/web/src/services/catalog.ts', 0));
});
