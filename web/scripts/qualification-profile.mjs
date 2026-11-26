import assert from 'node:assert/strict';

export const QUALIFICATION_PRODUCT_ID = 'dotify-test01.dot';
export const QUALIFICATION_APP_VERSION = [0, 1, 89];

export const ACCOUNT_QUALIFICATION_APP_VERSION = [0, 1, 90];
export const ARTIST_QUALIFICATION_APP_VERSION = [0, 1, 91];

export function assertQualificationBuild(identity, env) {
  assert.match(identity.gitSha, /^[a-f0-9]{40}$/, 'Qualification requires a source commit');
  assert.equal(identity.clean, true, 'Commit the qualification source before building its artifact');
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith('VITE_E2E_')) assert.notEqual(String(value).toLowerCase(), 'true', 'Qualification cannot include an E2E override');
    if (/^VITE_(PINATA_JWT|CONTENT_SECRET)$/.test(key)) assert.equal(String(value ?? '').trim(), '', 'Qualification cannot use browser secrets');
  }
}

export function assertQualificationGraph(outputs, purpose = 'host-info-only') {
  assert.ok(['host-info-only', 'host-account-addresses-only', 'host-artist-runtime-only'].includes(purpose), 'Unknown qualification purpose');
  const account = purpose === 'host-account-addresses-only';
  const artist = purpose === 'host-artist-runtime-only';
  const rendered = outputs.flatMap(output => output.output ?? []).filter(item => item.type === 'chunk');
  const allowedApplication = new Set([
    'qualification/main.tsx',
    'qualification/HostQualification.tsx',
    'qualification/report.ts',
    'qualification/qualification.css',
    'features/productHost/productHostInfo.ts',
    'features/productHost/useProductHostInfo.ts'
  ]);
  if (account)
    for (const path of ['account-main.tsx', 'AccountQualification.tsx', 'account.ts', 'accountReport.ts']) allowedApplication.add(`qualification/${path}`);
  if (artist) {
    for (const path of [
      'qualification/artist-main.tsx',
      'qualification/ArtistOnboarding.tsx',
      'qualification/artistOnboardingSession.ts',
      'qualification/account.ts',
      'features/runtime/productCdmContracts.ts',
      'features/runtime/productCdmStorageDeposit.ts',
      'features/runtime/productCdmRuntimeAdapter.ts',
      'features/runtime/productRuntimeSigner.ts',
      'features/productHost/productTransactionHost.ts',
      'shared/config/deploymentSafety.ts',
      'shared/config/deployments.ts',
      'generated/contracts/artistRuntimeFactory.ts',
      'generated/contracts/smartRuntime.ts',
      'generated/contracts/runtimeOwnership.ts',
      'generated/contracts/cdm.json'
    ])
      allowedApplication.add(path);
  }
  const forbiddenDependency = /\/node_modules\/@parity\/(?:product-sdk-descriptors|product-sdk-host\/dist\/testing)/;
  for (const chunk of rendered) {
    for (const [id, module] of Object.entries(chunk.modules)) {
      if (module.renderedLength === 0) continue;
      const normalized = id.replaceAll('\\', '/').split('?')[0];
      const applicationPath = normalized.split('/web/src/')[1];
      assert.ok(
        (!applicationPath || allowedApplication.has(applicationPath)) &&
          (artist ? !normalized.includes('/product-sdk-host/dist/testing') : !forbiddenDependency.test(normalized)),
        `Unexpected application capability in qualification: ${id}`
      );
    }
  }
  assert.ok(
    rendered.some(chunk =>
      Object.keys(chunk.modules).some(id =>
        id.endsWith(`/src/qualification/${artist ? 'ArtistOnboarding' : account ? 'AccountQualification' : 'HostQualification'}.tsx`)
      )
    )
  );
}
