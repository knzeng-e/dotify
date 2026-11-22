import { type Address, type Hex } from 'viem';

export const PASEO_ASSET_HUB_GENESIS = '0xd6eec26135305a8ad257a20d003357284c8aa03d0bdb2b357ab0a22371e11ef2';

type AuditBlock = { number: bigint; hash: Hex };
export type NativeFactoryReader = {
  request(method: 'chain_getBlockHash' | 'chain_getHeader', params: unknown[]): Promise<unknown>;
  finalized(): Promise<{ number: number; hash: string }>;
  hold(hash: string): () => void;
  storage(name: 'BlockHash' | 'AccountInfoOf', key: number | Address, at: string): Promise<unknown>;
  close(): void;
};

/** Only an empty, reviewed factory is covered; nonempty storage is not an inventory. */
export type NativeEmptyFactoryProof = {
  method: 'revive-empty-storage';
  genesis: typeof PASEO_ASSET_HUB_GENESIS;
  nativeBlockNumber: string;
  nativeBlockHash: Hex;
  evmBlockHash: Hex;
  factory: Address;
  factoryCodeHash: Hex;
  storageItems: 0;
  storageBytes: 0;
};

function hash(value: unknown, label: string): Hex {
  if (typeof value !== 'string' || !/^0x[0-9a-f]{64}$/i.test(value) || /^0x0{64}$/i.test(value)) throw new Error(`Invalid ${label}`);
  return value.toLowerCase() as Hex;
}

/** The caller must first match factory bytecode against the reviewed compiler artifact. */
export function verifyNativeEmptyFactoryState(input: {
  block: AuditBlock;
  factory: Address;
  factoryCodeHash: Hex;
  nativeBlockHash: unknown;
  nativeHeader: unknown;
  nativeEvmBlockHash: unknown;
  accountInfo: unknown;
}): NativeEmptyFactoryProof {
  const header = input.nativeHeader as { number?: unknown } | null;
  if (typeof header?.number !== 'string' || !/^0x[0-9a-f]+$/i.test(header.number) || BigInt(header.number) !== input.block.number)
    throw new Error('Native header does not match the captured EVM block number');
  const evmBlockHash = hash(input.nativeEvmBlockHash, 'native Revive.BlockHash');
  if (evmBlockHash !== hash(input.block.hash, 'captured EVM block hash')) throw new Error('Native/EVM block identity mismatch');
  const info = input.accountInfo as {
    account_type?: { type?: unknown; value?: { code_hash?: unknown; storage_items?: unknown; storage_bytes?: unknown } };
  } | null;
  if (info?.account_type?.type !== 'Contract') throw new Error('Native factory account is missing or is not a Contract');
  const contract = info.account_type.value;
  const codeHash = hash(contract?.code_hash, 'native factory code hash');
  if (codeHash !== hash(input.factoryCodeHash, 'reviewed factory code hash')) throw new Error('Native/EVM factory code mismatch');
  // Strict numeric zeros: missing fields, strings and nonempty storage must fail closed.
  if (contract?.storage_items !== 0 || contract?.storage_bytes !== 0)
    throw new Error('Native factory storage is nonempty or malformed; pending-runtime inventory remains unverified');
  return {
    method: 'revive-empty-storage',
    genesis: PASEO_ASSET_HUB_GENESIS,
    nativeBlockNumber: input.block.number.toString(),
    nativeBlockHash: hash(input.nativeBlockHash, 'native block hash'),
    evmBlockHash,
    factory: input.factory,
    factoryCodeHash: codeHash,
    storageItems: 0,
    storageBytes: 0
  };
}

async function connectNativeReader(rpcUrl: string): Promise<NativeFactoryReader> {
  const { createClient } = await import('polkadot-api');
  const { getWsProvider } = await import('polkadot-api/ws');
  const client = createClient(getWsProvider(rpcUrl));
  const api = client.getUnsafeApi();
  return {
    request: (method, params) => client._request(method, params),
    finalized: () => client.getFinalizedBlock(),
    hold: h => client.hodlBlock(h),
    storage: (name, key, at) => api.query.Revive[name].getValue(key, { at }),
    close: () => client.destroy()
  };
}

/** Public storage reads only; never obtains an account, signs, calls or submits a transaction. */
export async function readNativeEmptyFactoryProof(
  input: { rpcUrl: string; block: AuditBlock; factory: Address; factoryCodeHash: Hex },
  connect: (rpcUrl: string) => Promise<NativeFactoryReader> = connectNativeReader,
  timeoutMs = 30_000
): Promise<NativeEmptyFactoryProof> {
  if (!/^wss?:\/\//.test(input.rpcUrl)) throw new Error('Set DOTIFY_NATIVE_RPC or --native-rpc to a native Asset Hub WebSocket endpoint');
  if (input.block.number < 0n || input.block.number > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Audit block exceeds native tooling limits');
  let reader: NativeFactoryReader | undefined;
  let release: (() => void) | undefined;
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const active = () => {
    if (expired) throw new Error('Native factory audit timed out');
  };
  const operation = async () => {
    reader = await connect(input.rpcUrl);
    if (expired) {
      reader.close();
      throw new Error('Native factory audit timed out');
    }
    if ((await reader.request('chain_getBlockHash', [0])) !== PASEO_ASSET_HUB_GENESIS) throw new Error('Wrong native genesis');
    active();
    const head = await reader.finalized();
    active();
    if (!Number.isSafeInteger(head.number) || BigInt(head.number) < input.block.number)
      throw new Error('Captured EVM block is not finalized on native endpoint');
    release = reader.hold(hash(head.hash, 'native finalized head'));
    const number = Number(input.block.number);
    const nativeBlockHash = hash(await reader.request('chain_getBlockHash', [number]), 'canonical native block hash');
    active();
    const [nativeHeader, nativeEvmBlockHash, accountInfo] = await Promise.all([
      reader.request('chain_getHeader', [nativeBlockHash]),
      reader.storage('BlockHash', number, nativeBlockHash),
      reader.storage('AccountInfoOf', input.factory, nativeBlockHash)
    ]);
    active();
    return verifyNativeEmptyFactoryState({ ...input, nativeBlockHash, nativeHeader, nativeEvmBlockHash, accountInfo });
  };
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          expired = true;
          reject(new Error('Native factory audit timed out'));
        }, timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
    release?.();
    reader?.close();
  }
}
