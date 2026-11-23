import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { inspectArtistOnboarding, ASSET_HUB_GENESIS } from './artist-onboarding-prerequisites.mjs';
const addr = n => `0x${n.toString(16).padStart(40, '0')}`;
const key = `0x${'ab'.repeat(32)}`,
  blockHash = `0x${'cd'.repeat(32)}`;
const evmBlockHash = `0x${'ef'.repeat(32)}`;
for (const args of [
  [],
  ['--public-key', 'PRIVATE_INVALID_INPUT'],
  ['--public-key', key, '--native-ws', 'wss://user:PRIVATE_PASSWORD@example.org', '--evm-http', 'https://example.org'],
  ['--public-key', key, '--native-ws', 'wss://example.org', '--evm-http', 'https://example.org?token=PRIVATE_TOKEN']
])
  test('CLI refuses invalid inputs before loading a network client, with sanitized output', () => {
    const result = spawnSync(process.execPath, [new URL('./check-artist-onboarding.mjs', import.meta.url).pathname, ...args], {
      encoding: 'utf8',
      timeout: 3000
    });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.ok(!result.stderr.includes('PRIVATE_'));
    assert.match(result.stderr, /No transaction was submitted/);
  });
function fixture() {
  const deployment = {
    factory: addr(1),
    directory: addr(2),
    initializer: addr(3),
    nativeTokenDecimals: 10,
    pallets: {
      cutPallet: addr(4),
      loupePallet: addr(5),
      ownershipPallet: addr(6),
      registryPallet: addr(7),
      royaltiesPallet: addr(8),
      accessPallet: addr(9),
      metadataPallet: addr(10)
    }
  };
  const packages = [
    ['@dotify/artist-directory', deployment.directory],
    ['@dotify/artist-runtime-factory', deployment.factory]
  ].map(([name, address]) => ({ name, address, version: 4 }));
  const calls = [];
  const state = { registered: addr(0), pending: addr(0), stage: 0 };
  const anchor = { genesis: ASSET_HUB_GENESIS, number: 123, hash: blockHash, mappedPublicKey: key };
  const deps = {
    deriveH160: () => addr(11),
    fingerprint: () => 'fingerprint',
    hashCode: () => blockHash,
    nativeSnapshot: async () => anchor,
    chainId: async () => 420420417,
    block: async () => ({ number: 123n, hash: evmBlockHash }),
    blockByNativeHash: async () => ({ number: 123n, hash: evmBlockHash }),
    code: async (target, block) => {
      calls.push(['code', target, block]);
      return '0x1234';
    },
    cdm: async (name, version, block) => {
      calls.push(['cdm', name, version, block]);
      return { isSome: true, value: packages.find(p => p.name === name).address };
    },
    read: async (target, name, args, block) => {
      calls.push(['read', target, name, args, block]);
      if (target === deployment.factory)
        return {
          ...deployment.pallets,
          directory: deployment.directory,
          initContract: deployment.initializer,
          nativeTokenDecimals: 10,
          pendingRuntimeOf: state.pending,
          pendingRuntimeStageOf: state.stage
        }[name];
      return { factory: deployment.factory, runtimeOf: state.registered }[name];
    }
  };
  return { input: { publicKey: key, deployment, packages }, deps, anchor, state, calls };
}
test('absent native artist: pins all contract/CDM/code reads and never claims global discovery or signing', async () => {
  const f = fixture();
  const report = await inspectArtistOnboarding(f.input, f.deps);
  assert.equal(report.blockHash, blockHash);
  assert.equal(report.evmBlockHash, evmBlockHash);
  assert.notEqual(report.blockHash, report.evmBlockHash);
  assert.equal(report.state, 'absent');
  assert.equal(report.remainingApprovals, 8);
  assert.equal(report.boundaries.globalPendingDiscoveryComplete, false);
  assert.equal(report.boundaries.signerControlVerified, false);
  assert.equal(report.boundaries.publicationEnabled, false);
  assert.equal(report.boundaries.reviewedBytecodeVerified, false);
  assert.ok(f.calls.every(call => call.at(-1) === 123n));
  assert.ok(!JSON.stringify(report).includes(key));
  assert.equal(Object.keys(report.codeHashes).length, 10);
});
for (const stage of [1, 2, 3, 4, 5, 6, 7])
  test(`resumes native pending stage ${stage} without relying on eth_getLogs`, async () => {
    const f = fixture();
    f.state.pending = addr(12);
    f.state.stage = stage;
    const result = await inspectArtistOnboarding(f.input, f.deps);
    assert.equal(result.state, 'pending');
    assert.equal(result.runtime, addr(12));
    assert.equal(result.remainingApprovals, 8 - stage);
    assert.ok(f.calls.some(c => c[0] === 'code' && c[1] === addr(12)));
  });
test('registered artist is distinct from an absent artist', async () => {
  const f = fixture();
  f.state.registered = addr(12);
  const result = await inspectArtistOnboarding(f.input, f.deps);
  assert.equal(result.state, 'registered');
  assert.equal(result.remainingApprovals, 0);
  assert.equal(result.boundaries.runtimeAuthorityVerified, false);
});
test('cancellation during a read prevents subsequent requests and a late success', async () => {
  const f = fixture();
  const controller = new AbortController();
  f.deps.signal = controller.signal;
  f.deps.nativeSnapshot = async () => {
    controller.abort();
    return f.anchor;
  };
  let queried = false;
  f.deps.chainId = async () => {
    queried = true;
    return 420420417;
  };
  await assert.rejects(inspectArtistOnboarding(f.input, f.deps));
  assert.equal(queried, false);
  assert.equal(f.calls.length, 0);
});
for (const [name, mutate] of [
  [
    'missing mapping',
    f => {
      f.anchor.mappedPublicKey = null;
    }
  ],
  [
    'wrong mapping',
    f => {
      f.anchor.mappedPublicKey = blockHash;
    }
  ],
  [
    'wrong genesis',
    f => {
      f.anchor.genesis = blockHash;
    }
  ],
  [
    'invalid block',
    f => {
      f.anchor.number = NaN;
    }
  ],
  [
    'wrong EVM chain',
    f => {
      f.deps.chainId = async () => 1;
    }
  ],
  [
    'divergent block',
    f => {
      f.deps.block = async () => ({ number: 123n, hash: key });
    }
  ],
  [
    'missing native-hash resolution',
    f => {
      f.deps.blockByNativeHash = async () => null;
    }
  ],
  [
    'divergent resolved height',
    f => {
      f.deps.blockByNativeHash = async () => ({ number: 122n, hash: evmBlockHash });
    }
  ],
  [
    'divergent canonical height',
    f => {
      f.deps.block = async () => ({ number: 124n, hash: evmBlockHash });
    }
  ],
  [
    'missing canonical hash',
    f => {
      f.deps.block = async () => ({ number: 123n, hash: null });
    }
  ],
  [
    'missing code',
    f => {
      f.deps.code = async () => '0x';
    }
  ],
  [
    'wrong factory binding',
    f => {
      const read = f.deps.read;
      f.deps.read = (...args) => (args[1] === 'directory' ? addr(99) : read(...args));
    }
  ],
  [
    'wrong precision',
    f => {
      f.input.deployment.nativeTokenDecimals = 18;
    }
  ],
  [
    'CDM mismatch',
    f => {
      f.deps.cdm = async () => ({ isSome: true, value: addr(99) });
    }
  ],
  [
    'CDM missing',
    f => {
      f.deps.cdm = async () => ({ isSome: false, value: addr(0) });
    }
  ],
  [
    'duplicate package',
    f => {
      f.input.packages[1] = f.input.packages[0];
    }
  ],
  [
    'missing metadata facet',
    f => {
      delete f.input.deployment.pallets.metadataPallet;
    }
  ],
  [
    'conflicting runtimes',
    f => {
      f.state.pending = addr(12);
      f.state.registered = addr(13);
      f.state.stage = 1;
    }
  ],
  [
    'pending without stage',
    f => {
      f.state.pending = addr(12);
    }
  ],
  [
    'stage without pending',
    f => {
      f.state.stage = 1;
    }
  ],
  [
    'unknown stage',
    f => {
      f.state.pending = addr(12);
      f.state.stage = 8;
    }
  ],
  [
    'malformed runtime',
    f => {
      f.state.pending = 'not-an-address';
      f.state.stage = 1;
    }
  ],
  [
    'RPC failure',
    f => {
      f.deps.read = async () => {
        throw new Error('unavailable');
      };
    }
  ]
])
  test(`refuses ${name} without returning a success report`, async () => {
    const f = fixture();
    mutate(f);
    await assert.rejects(inspectArtistOnboarding(f.input, f.deps));
  });
