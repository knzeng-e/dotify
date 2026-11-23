// Public read-only operator tool; intentionally outside every Vite entry graph.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { inspectArtistOnboarding } from './artist-onboarding-prerequisites.mjs';

async function main() {
  const { values } = parseArgs({
    options: {
      'public-key': { type: 'string' },
      'native-ws': { type: 'string' },
      'evm-http': { type: 'string' }
    }
  });
  const publicKey = values['public-key'];
  if (!/^0x[0-9a-f]{64}$/i.test(publicKey ?? '') || /^0x0{64}$/i.test(publicKey)) throw new Error('Supply --public-key with the intended public Product key');
  for (const [flag, protocols] of [
    ['native-ws', ['wss:']],
    ['evm-http', ['https:']]
  ]) {
    const url = new URL(values[flag]);
    if (!protocols.includes(url.protocol) || url.username || url.password || url.search || url.hash)
      throw new Error(`Supply a public ${flag} endpoint without credentials or query parameters`);
  }
  const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const clean = !execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { encoding: 'utf8' }).trim();
  const manifestBytes = await readFile(new URL('../../deployments.json', import.meta.url));
  const cdmBytes = await readFile(new URL('../../contracts/evm/cdm.json', import.meta.url));
  const deployment = JSON.parse(manifestBytes);
  const snapshot = JSON.parse(cdmBytes);
  if (snapshot.registry?.toLowerCase() !== '0x05662b3dbd5dd9f2ff92d67630477e84b0b37c1f') throw new Error('Unexpected CDM registry');
  const packages = ['@dotify/artist-directory', '@dotify/artist-runtime-factory'].map(name => {
    const entry = snapshot.contracts[name];
    if (entry.version !== snapshot.dependencies[name]) throw new Error('Inconsistent CDM version');
    return { name, address: entry.address, version: entry.version };
  });
  const [{ createClient }, { getWsProvider }, address, viem] = await Promise.all([
    import('polkadot-api'),
    import('polkadot-api/ws-provider'),
    import('@parity/product-sdk/address'),
    import('viem')
  ]);
  const native = createClient(getWsProvider(values['native-ws']));
  const evm = viem.createPublicClient({ transport: viem.http(values['evm-http'], { timeout: 10_000, retryCount: 0 }) });
  const abis = Object.values(snapshot.contracts).flatMap(entry => entry.abi);
  const registryAbi = viem.parseAbi(['function getAddressAtVersion(string name, uint32 version) view returns ((bool isSome, address value))']);
  const digest = value => createHash('sha256').update(value).digest('hex');
  const controller = new AbortController();
  let deadline;
  const expired = new Promise((_, reject) => {
    deadline = setTimeout(() => {
      controller.abort();
      reject(new Error('Read deadline'));
    }, 60_000);
  });
  try {
    const report = await Promise.race([
      expired,
      inspectArtistOnboarding(
        { publicKey, deployment, packages },
        {
          signal: controller.signal,
          deriveH160: key => address.deriveH160(viem.hexToBytes(key)),
          fingerprint: key => digest(Buffer.from(key.slice(2).toLowerCase(), 'hex')),
          hashCode: viem.keccak256,
          async nativeSnapshot(artist) {
            const spec = await native.getChainSpecData();
            controller.signal.throwIfAborted();
            const block = await native.getFinalizedBlock();
            controller.signal.throwIfAborted();
            const mapped = await native.getUnsafeApi().query.Revive.OriginalAccount.getValue(artist, { at: block.hash, signal: controller.signal });
            return {
              genesis: spec.genesisHash,
              number: block.number,
              hash: block.hash,
              mappedPublicKey: mapped ? viem.toHex(address.ss58Decode(mapped).publicKey) : null
            };
          },
          chainId: () => evm.getChainId(),
          block: number => evm.getBlock({ blockNumber: BigInt(number) }),
          read: (target, functionName, args, blockNumber) => evm.readContract({ address: target, abi: abis, functionName, args, blockNumber }),
          code: (target, blockNumber) => evm.getCode({ address: target, blockNumber }),
          cdm: (name, version, blockNumber) =>
            evm.readContract({ address: snapshot.registry, abi: registryAbi, functionName: 'getAddressAtVersion', args: [name, version], blockNumber })
        }
      )
    ]);
    console.log(JSON.stringify({ ...report, source, clean, manifestSha256: digest(manifestBytes), cdmSha256: digest(cdmBytes) }, null, 2));
  } finally {
    controller.abort();
    clearTimeout(deadline);
    native.destroy();
  }
}
main().catch(() => {
  // Provider errors may contain URLs, public keys or full payloads.
  console.error(
    'Artist prerequisites could not be verified. Check the account, matching manifests and finalized RPC availability. No transaction was submitted.'
  );
  process.exitCode = 1;
});
