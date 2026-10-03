import assert from 'node:assert/strict';
import test from 'node:test';
import { PRODUCT_DEPLOY_PROFILE } from './product-deploy-environment-check.mjs';
import { evaluateProductHostConfig, readProductHostApiKey, verifyProductHostConfig, withProductHostVerification } from './product-host-config-check.mjs';

const environment = { contracts: PRODUCT_DEPLOY_PROFILE.contracts, ipfs: PRODUCT_DEPLOY_PROFILE.ipfs };
test('missing operator configuration fails instead of disabling the live check', () => {
  const missing = new URL('./does-not-exist/client-config.json', import.meta.url);
  assert.throws(() => readProductHostApiKey({}, missing), /requires PRODUCT_HOST_FIREBASE_API_KEY/);
  assert.equal(readProductHostApiKey({ PRODUCT_HOST_FIREBASE_API_KEY: ' client-key ' }, missing), 'client-key');
});
function payload() {
  return {
    state: 'UPDATE',
    entries: {
      dot_ns_config: JSON.stringify({
        registryContractAddress: environment.contracts.DOTNS_REGISTRY.slice(2).toLowerCase(),
        resolverContractAddress: environment.contracts.DOTNS_RESOLVER
      }),
      ipfs_gateway_url: `${environment.ipfs}/ipfs/`
    }
  };
}

test('matches prefix/case variants and the host /ipfs/ gateway suffix', () => {
  assert.deepEqual(evaluateProductHostConfig(payload(), environment), []);
});

test('detects host registry and resolver changes independently', () => {
  for (const field of ['registryContractAddress', 'resolverContractAddress']) {
    const fixture = payload();
    const dotns = JSON.parse(fixture.entries.dot_ns_config);
    dotns[field] = `0x${'a'.repeat(40)}`;
    fixture.entries.dot_ns_config = JSON.stringify(dotns);
    assert.ok(evaluateProductHostConfig(fixture, environment).some(error => error.includes('mismatch')));
  }
});

test('rejects absent, stale, malformed and empty remote configuration', () => {
  for (const fixture of [null, {}, { ...payload(), state: 'NO_CHANGE' }, { ...payload(), state: 'NO_TEMPLATE' }]) {
    assert.ok(evaluateProductHostConfig(fixture, environment).length);
  }
  for (const raw of [undefined, 'broken', 'null', '[]', '{}', JSON.stringify({ registryContractAddress: '0'.repeat(40) })]) {
    const fixture = payload();
    fixture.entries.dot_ns_config = raw;
    assert.ok(evaluateProductHostConfig(fixture, environment).length);
  }
  assert.ok(evaluateProductHostConfig(payload(), null).length);
});

test('rejects mismatched and unsafe gateways', () => {
  for (const value of [
    undefined,
    'http://example.com',
    'https://example.com',
    `${environment.ipfs}/wrong`,
    `${environment.ipfs}?q=1`,
    `https://user:pass@${new URL(environment.ipfs).host}/ipfs/`
  ]) {
    const fixture = payload();
    fixture.entries.ipfs_gateway_url = value;
    assert.ok(evaluateProductHostConfig(fixture, environment).some(error => error.includes('gateway')));
  }
});

test('fetches the Product channel afresh with a bounded anonymous request', async () => {
  const ids = [];
  const fetchImpl = async (url, options) => {
    assert.equal(url.hostname, 'firebaseremoteconfig.googleapis.com');
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof globalThis.AbortSignal);
    const body = JSON.parse(options.body);
    assert.deepEqual(body.custom_signals, { environment: 'paseo' });
    assert.equal(body.app_instance_id_token, undefined);
    assert.match(body.app_instance_id, /^[cdef][\w-]{21}$/);
    ids.push(body.app_instance_id);
    return globalThis.Response.json(payload());
  };
  for (let i = 0; i < 2; i++) {
    const result = await verifyProductHostConfig(environment, { apiKey: 'client-key', fetchImpl });
    assert.equal(result.channel, 'paseo');
    assert.ok(Number.isFinite(Date.parse(result.checkedAt)));
  }
  assert.notEqual(ids[0], ids[1]);
});

test('network, HTTP, malformed JSON and timeout errors fail closed without leaking client keys', async () => {
  const failures = [
    async () => {
      throw new Error('secret-client-key in URL');
    },
    async () => new globalThis.Response('secret-client-key', { status: 403 }),
    async () => new globalThis.Response('not json'),
    async (_url, { signal }) => {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 100);
        signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            reject(signal.reason);
          },
          { once: true }
        );
      });
      return globalThis.Response.json(payload());
    }
  ];
  for (const fetchImpl of failures) {
    await assert.rejects(verifyProductHostConfig(environment, { apiKey: 'secret-client-key', fetchImpl, timeoutMs: 5 }), error => {
      assert.match(error.message, /Live Product Remote Config/);
      assert.ok(!error.message.includes('secret-client-key'));
      return true;
    });
  }
});

test('no publication occurs when the live preflight fails', async () => {
  let writes = 0;
  await assert.rejects(
    withProductHostVerification(
      environment,
      async () => {
        writes++;
      },
      async () => {
        throw new Error('drift');
      }
    ),
    /drift/
  );
  assert.equal(writes, 0);
});

test('rechecks after publication without retrying writes when the host changes', async () => {
  let reads = 0;
  let writes = 0;
  await assert.rejects(
    withProductHostVerification(
      environment,
      async () => {
        writes++;
      },
      async () => {
        if (++reads === 2) throw new Error('drift');
      }
    ),
    /Publication completed.*Do not blindly republish/
  );
  assert.equal(reads, 2);
  assert.equal(writes, 1);
});

test('passes through the publication result only after the final check', async () => {
  const calls = [];
  const result = await withProductHostVerification(
    environment,
    async () => {
      calls.push('publish');
      return 'CID';
    },
    async () => {
      calls.push('check');
    }
  );
  assert.deepEqual(calls, ['check', 'publish', 'check']);
  assert.equal(result, 'CID');
});
