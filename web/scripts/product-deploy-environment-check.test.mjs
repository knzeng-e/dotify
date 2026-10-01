import assert from 'node:assert/strict';
import test from 'node:test';

import { PRODUCT_DEPLOY_PROFILE, evaluateProductDeployApi, evaluateProductDeployEnvironment } from './product-deploy-environment-check.mjs';

function validPackage() {
  return {
    packageJson: {
      name: PRODUCT_DEPLOY_PROFILE.packageName,
      version: PRODUCT_DEPLOY_PROFILE.cliVersion
    },
    environments: {
      environments: [
        {
          id: PRODUCT_DEPLOY_PROFILE.environmentId,
          ipfs: PRODUCT_DEPLOY_PROFILE.ipfs,
          webGateway: PRODUCT_DEPLOY_PROFILE.webGateway,
          contracts: { ...PRODUCT_DEPLOY_PROFILE.contracts }
        }
      ]
    }
  };
}

test('accepts the Product deploy profile used by the current host generation', () => {
  const result = evaluateProductDeployEnvironment(validPackage());

  assert.deepEqual(result.errors, []);
  assert.equal(result.environment?.id, 'devnet');
});

test('rejects the transient 0.16.2 DotNS generation', () => {
  const fixture = validPackage();
  fixture.packageJson.version = '0.16.2';
  fixture.environments.environments[0].contracts = {
    DOTNS_REGISTRY: '0x38cf3dE5877a18157f4C1a4e067F84956F582b31',
    DOTNS_CONTENT_RESOLVER: '0x444578659848ba38D1825238f10B8D75522d278f'
  };

  const result = evaluateProductDeployEnvironment(fixture);

  assert.equal(
    result.errors.some(error => error.includes('Expected CLI 0.20.0')),
    true
  );
  assert.equal(
    result.errors.some(error => error.includes('DOTNS_REGISTRY')),
    true
  );
  assert.equal(
    result.errors.some(error => error.includes('DOTNS_CONTENT_RESOLVER')),
    true
  );
});

test('fails closed when the Product DevNet profile is absent', () => {
  const fixture = validPackage();
  fixture.environments.environments = [];

  const result = evaluateProductDeployEnvironment(fixture);

  assert.equal(result.environment, null);
  assert.deepEqual(result.errors, ['Environment devnet is missing from the deploy CLI.']);
});

test('rejects a deploy API whose manifest helper is absent from deploy.js', () => {
  const functions = {
    derivePoolAccounts() {},
    preflightProductConfig() {},
    loadEnvironments() {},
    resolveEndpoints() {},
    reconcileManifestDomain() {},
    deploy() {},
    publishManifest() {}
  };
  assert.deepEqual(evaluateProductDeployApi({ index: functions, deployModule: { printDeploymentCompleteBanner() {} } }), [
    'Deploy CLI 0.20.0 is missing deployModule.shouldPublishManifest.'
  ]);
});
