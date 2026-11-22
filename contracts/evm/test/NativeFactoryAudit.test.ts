import { expect } from 'chai';
import { PASEO_ASSET_HUB_GENESIS, readNativeEmptyFactoryProof, verifyNativeEmptyFactoryState, type NativeFactoryReader } from '../scripts/nativeFactoryAudit';
import type { Hex } from 'viem';

const nativeHash = `0x${'11'.repeat(32)}` as Hex;
const evmHash = `0x${'22'.repeat(32)}` as Hex;
const codeHash = `0x${'33'.repeat(32)}` as Hex;
const factory = `0x${'44'.repeat(20)}` as const;
const input = { rpcUrl: 'wss://native.invalid', block: { number: 40n, hash: evmHash }, factory, factoryCodeHash: codeHash };
const accountInfo = () => ({ account_type: { type: 'Contract', value: { code_hash: codeHash, storage_items: 0, storage_bytes: 0 } } });
const state = () => ({ ...input, nativeBlockHash: nativeHash, nativeHeader: { number: '0x28' }, nativeEvmBlockHash: evmHash, accountInfo: accountInfo() });

async function rejects(operation: Promise<unknown>, fragment: string) {
  try {
    await operation;
  } catch (error) {
    expect(String(error)).to.include(fragment);
    return;
  }
  throw new Error('Expected rejection');
}

function fixture() {
  const calls: unknown[][] = [];
  let closes = 0,
    releases = 0,
    holds = 0;
  const reader: NativeFactoryReader = {
    request: async (method, params) => {
      calls.push([method, ...params]);
      if (method === 'chain_getHeader') return { number: '0x28' };
      return params[0] === 0 ? PASEO_ASSET_HUB_GENESIS : nativeHash;
    },
    finalized: async () => ({ number: 42, hash: nativeHash }),
    hold: () => {
      holds++;
      return () => {
        releases++;
      };
    },
    storage: async (name, key, at) => {
      calls.push([name, key, at]);
      return name === 'BlockHash' ? evmHash : accountInfo();
    },
    close: () => {
      closes++;
    }
  };
  return { reader, calls, connect: async () => reader, counts: () => ({ closes, releases, holds }) };
}

describe('Finalized native empty-factory proof', () => {
  it('binds distinct native/EVM hashes and all native storage reads to the captured block', async () => {
    const f = fixture();
    const proof = await readNativeEmptyFactoryProof(input, f.connect);
    expect(proof).to.deep.equal({
      method: 'revive-empty-storage',
      genesis: PASEO_ASSET_HUB_GENESIS,
      nativeBlockNumber: '40',
      nativeBlockHash: nativeHash,
      evmBlockHash: evmHash,
      factory,
      factoryCodeHash: codeHash,
      storageItems: 0,
      storageBytes: 0
    });
    expect(f.calls).to.deep.equal([
      ['chain_getBlockHash', 0],
      ['chain_getBlockHash', 40],
      ['chain_getHeader', nativeHash],
      ['BlockHash', 40, nativeHash],
      ['AccountInfoOf', factory, nativeHash]
    ]);
    expect(f.counts()).to.deep.equal({ closes: 1, releases: 1, holds: 1 });
  });

  for (const [label, mutate, fragment] of [
    [
      'absent account',
      (s: ReturnType<typeof state>) => {
        s.accountInfo = undefined as never;
      },
      'missing or is not a Contract'
    ],
    [
      'delegated EOA',
      (s: ReturnType<typeof state>) => {
        s.accountInfo.account_type.type = 'DelegatedEOA';
      },
      'not a Contract'
    ],
    [
      'pending mapping',
      (s: ReturnType<typeof state>) => {
        s.accountInfo.account_type.value.storage_items = 2;
        s.accountInfo.account_type.value.storage_bytes = 64;
      },
      'nonempty or malformed'
    ],
    [
      'inconsistent bytes',
      (s: ReturnType<typeof state>) => {
        s.accountInfo.account_type.value.storage_bytes = 32;
      },
      'nonempty or malformed'
    ],
    [
      'missing count',
      (s: ReturnType<typeof state>) => {
        delete (s.accountInfo.account_type.value as Partial<ReturnType<typeof accountInfo>['account_type']['value']>).storage_items;
      },
      'nonempty or malformed'
    ],
    [
      'coerced zero',
      (s: ReturnType<typeof state>) => {
        s.accountInfo.account_type.value.storage_items = '0' as never;
      },
      'nonempty or malformed'
    ],
    [
      'different native block',
      (s: ReturnType<typeof state>) => {
        s.nativeHeader.number = '0x29';
      },
      'block number'
    ],
    [
      'different EVM block',
      (s: ReturnType<typeof state>) => {
        s.nativeEvmBlockHash = nativeHash;
      },
      'block identity mismatch'
    ],
    [
      'different bytecode',
      (s: ReturnType<typeof state>) => {
        s.accountInfo.account_type.value.code_hash = nativeHash;
      },
      'factory code mismatch'
    ],
    [
      'missing hash',
      (s: ReturnType<typeof state>) => {
        s.nativeBlockHash = null as never;
      },
      'native block hash'
    ],
    [
      'zero hash',
      (s: ReturnType<typeof state>) => {
        s.nativeEvmBlockHash = `0x${'00'.repeat(32)}`;
      },
      'Revive.BlockHash'
    ]
  ] as const) {
    it(`rejects ${label} instead of claiming complete pending discovery`, () => {
      const s = state();
      mutate(s);
      expect(() => verifyNativeEmptyFactoryState(s)).to.throw(fragment);
    });
  }

  it('rejects a wrong genesis before reading contract state and closes the client', async () => {
    const f = fixture();
    f.reader.request = async () => nativeHash;
    await rejects(readNativeEmptyFactoryProof(input, f.connect), 'Wrong native genesis');
    expect(f.counts()).to.deep.equal({ closes: 1, releases: 0, holds: 0 });
    expect(f.calls).to.deep.equal([]);
  });

  it('refuses an EVM block beyond native finality', async () => {
    const f = fixture();
    f.reader.finalized = async () => ({ number: 39, hash: nativeHash });
    await rejects(readNativeEmptyFactoryProof(input, f.connect), 'not finalized');
    expect(f.counts()).to.deep.equal({ closes: 1, releases: 0, holds: 0 });
  });

  it('closes and releases after RPC failure rather than falling back to EVM logs', async () => {
    const f = fixture();
    f.reader.storage = async () => {
      throw new Error('Native storage unavailable');
    };
    await rejects(readNativeEmptyFactoryProof(input, f.connect), 'Native storage unavailable');
    expect(f.counts()).to.deep.equal({ closes: 1, releases: 1, holds: 1 });
  });

  it('bounds a stalled native read and releases its pinned head', async () => {
    const f = fixture();
    f.reader.storage = () => new Promise(() => {});
    await rejects(readNativeEmptyFactoryProof(input, f.connect, 10), 'timed out');
    expect(f.counts()).to.deep.equal({ closes: 1, releases: 1, holds: 1 });
  });

  it('closes a late connection without issuing a native request', async () => {
    const f = fixture();
    let resolve!: (reader: NativeFactoryReader) => void;
    const connection = new Promise<NativeFactoryReader>(r => {
      resolve = r;
    });
    await rejects(
      readNativeEmptyFactoryProof(input, () => connection, 10),
      'timed out'
    );
    resolve(f.reader);
    await new Promise(r => setImmediate(r));
    expect(f.counts()).to.deep.equal({ closes: 1, releases: 0, holds: 0 });
    expect(f.calls).to.deep.equal([]);
  });

  it('requires an explicit native endpoint without connecting', async () => {
    const f = fixture();
    await rejects(readNativeEmptyFactoryProof({ ...input, rpcUrl: '' }, f.connect), 'DOTIFY_NATIVE_RPC');
    expect(f.counts().closes).to.equal(0);
  });
});
