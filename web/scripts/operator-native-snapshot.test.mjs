import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readOperatorNativeSnapshot } from './operator-native-snapshot.mjs';
import { ASSET_HUB_GENESIS } from './artist-onboarding-prerequisites.mjs';
test('operator codec is independently pinned; application PAPI is unchanged', () => {
  const config = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  assert.equal(config.dependencies['polkadot-api-operator'], 'npm:polkadot-api@3.3.0');
  assert.equal(config.dependencies['polkadot-api'], '^1.23.3');
  assert.equal(JSON.parse(readFileSync(new URL('../node_modules/polkadot-api-operator/package.json', import.meta.url))).version, '3.3.0');
  assert.equal(JSON.parse(readFileSync(new URL('../node_modules/polkadot-api/package.json', import.meta.url))).version, '1.23.3');
});
function fixture() {
  const controller = new AbortController(),
    calls = [];
  const block = { number: 12, hash: `0x${'11'.repeat(32)}` };
  const client = {
    getChainSpecData: async () => {
      calls.push('spec');
      return { genesisHash: ASSET_HUB_GENESIS };
    },
    getFinalizedBlock: async () => {
      calls.push('finalized');
      return block;
    },
    hodlBlock: hash => {
      calls.push(['hold', hash]);
      return () => calls.push('release');
    },
    getUnsafeApi: () => ({
      query: {
        Revive: {
          OriginalAccount: {
            getValue: async (...args) => {
              calls.push(['read', ...args]);
              return 'mapped-account';
            }
          }
        }
      }
    })
  };
  const options = {
    signal: controller.signal,
    decodePublicKey: value => {
      calls.push(['decode', value]);
      return 'public-key';
    }
  };
  return { controller, calls, block, client, options };
}
test('pins mapping read and holds its block until decoding is finished', async () => {
  const f = fixture();
  const result = await readOperatorNativeSnapshot(f.client, 'artist', f.options);
  assert.deepEqual(result, { genesis: ASSET_HUB_GENESIS, ...{ number: f.block.number, hash: f.block.hash }, mappedPublicKey: 'public-key' });
  assert.deepEqual(f.calls, [
    'spec',
    'finalized',
    ['hold', f.block.hash],
    ['read', 'artist', { at: f.block.hash, signal: f.controller.signal }],
    ['decode', 'mapped-account'],
    'release'
  ]);
});
for (const mapped of [undefined, null])
  test('missing native mapping stays missing, without address fallback', async () => {
    const f = fixture();
    f.client.getUnsafeApi = () => ({ query: { Revive: { OriginalAccount: { getValue: async () => mapped } } } });
    assert.equal((await readOperatorNativeSnapshot(f.client, 'artist', f.options)).mappedPublicKey, null);
    assert.equal(f.calls.at(-1), 'release');
    assert.ok(!f.calls.some(c => Array.isArray(c) && c[0] === 'decode'));
  });
for (const failure of ['read', 'decode', 'abort'])
  test(`releases held block on ${failure} failure`, async () => {
    const f = fixture();
    if (failure === 'decode')
      f.options.decodePublicKey = () => {
        throw new Error('decode failed');
      };
    else
      f.client.getUnsafeApi = () => ({
        query: {
          Revive: {
            OriginalAccount: {
              getValue: async () => {
                if (failure === 'abort') {
                  f.controller.abort();
                  return 'late';
                }
                throw new Error('RPC failed');
              }
            }
          }
        }
      });
    await assert.rejects(readOperatorNativeSnapshot(f.client, 'artist', f.options));
    assert.equal(f.calls.at(-1), 'release');
  });
test('abort before native lookup starts initiates no calls', async () => {
  const f = fixture();
  f.controller.abort();
  await assert.rejects(readOperatorNativeSnapshot(f.client, 'artist', f.options));
  assert.deepEqual(f.calls, []);
});
test('abort during finality lookup prevents holding or reading a late block', async () => {
  const f = fixture();
  f.client.getFinalizedBlock = async () => {
    f.controller.abort();
    return f.block;
  };
  await assert.rejects(readOperatorNativeSnapshot(f.client, 'artist', f.options));
  assert.deepEqual(f.calls, ['spec']);
});

test('wrong genesis stops before any account lookup', async () => {
  const f = fixture();
  f.client.getChainSpecData = async () => ({ genesisHash: 'wrong' });
  await assert.rejects(readOperatorNativeSnapshot(f.client, 'artist', f.options));
  assert.deepEqual(f.calls, []);
});
