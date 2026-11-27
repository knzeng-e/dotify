import { encodeFunctionData, hexToBytes, toHex, zeroAddress, type Address, type Hex } from 'viem';
import { artistRuntimeFactoryAbi } from '../generated/contracts/artistRuntimeFactory';
import { deployments } from '../shared/config/deployments';
import { registryOwnerGuardAttestation } from '../shared/config/deploymentSafety';
import { createProductCdmContracts } from '../features/runtime/productCdmContracts';
import type { ProductCdmContractHandle } from '../features/runtime/productCdmRuntimeAdapter';
import { createProductSignerManager } from '../features/runtime/productRuntimeSigner';
import { ACCOUNT_DERIVATION_INDEX, ACCOUNT_PRODUCT_ID, type AccountObservation } from './account';

const genesis = '0xd6eec26135305a8ad257a20d003357284c8aa03d0bdb2b357ab0a22371e11ef2';
const acceptedAccount = 'f033680e6ef4b801d178e6c3f3a5e0f0edc95d76dc2edf12d1220281af754492';

export const artistSteps = [
  'Create the artist runtime',
  'Install contract discovery',
  'Install ownership controls',
  'Install the music registry',
  'Install royalty controls',
  'Install listening access',
  'Install release metadata',
  'Finalize artist ownership'
] as const;

export type RuntimeState = { stage: 0; runtime: null } | { stage: number; runtime: Address };
export type ArtistPreview =
  | { status: 'ready'; runtime: Address }
  | { status: 'review'; state: RuntimeState; deposit: bigint; available: bigint; nativeDecimals: number };

async function query(contract: ProductCdmContractHandle, method: string, args: unknown[], at: Hex | 'best') {
  const result = await contract[method]?.query?.(...args, { at });
  if (!result?.success) throw new Error('Could not verify the artist runtime on Paseo.');
  return result.value;
}

function runtimeAddress(value: unknown): Address {
  if (typeof value !== 'string' || !/^0x[0-9a-f]{40}$/i.test(value)) throw new Error('The factory returned an invalid runtime address.');
  return value.toLowerCase() as Address;
}

export function reconcileRuntime(registered: unknown, pending: unknown, stage: unknown): RuntimeState | { stage: 'ready'; runtime: Address } {
  const final = runtimeAddress(registered);
  const next = runtimeAddress(pending);
  const number = typeof stage === 'bigint' || typeof stage === 'number' ? Number(stage) : NaN;
  if (next === zeroAddress && number === 0) return final === zeroAddress ? { stage: 0, runtime: null } : { stage: 'ready', runtime: final };
  if (final === zeroAddress && next !== zeroAddress && Number.isInteger(number) && number >= 1 && number <= 7) {
    return { stage: number, runtime: next };
  }
  throw new Error('Paseo returned inconsistent installation state. Check again before requesting an approval.');
}

export async function openArtistOnboarding(account: Extract<AccountObservation, { status: 'reported' }>) {
  const fingerprint = toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', hexToBytes(account.publicKey)))).slice(2);
  if (fingerprint !== acceptedAccount) throw new Error('This Polkadot account differs from the artist account already selected for this build.');
  const signer = await createProductSignerManager({
    productId: ACCOUNT_PRODUCT_ID,
    derivationIndex: ACCOUNT_DERIVATION_INDEX,
    publicKey: account.publicKey,
    evmAddress: account.evmAddress
  });

  const contracts = await createProductCdmContracts({
    environment: 'devnet',
    expectedGenesis: genesis,
    signerManager: signer
  }).catch(error => {
    signer.destroy();
    throw error;
  });
  const close = () => {
    contracts.destroy();
    signer.destroy();
  };

  try {
    if (
      deployments.factory !== registryOwnerGuardAttestation.factory ||
      deployments.directory !== registryOwnerGuardAttestation.directory ||
      contracts.nativeTokenDecimals !== deployments.nativeTokenDecimals
    ) {
      throw new Error('This build does not match the attested Paseo deployment.');
    }
    const factory = contracts.resolver.getFactoryContract(deployments.factory);
    const directory = contracts.resolver.getDirectoryContract(deployments.directory);
    const hash = await contracts.finalizedHash();
    if (
      runtimeAddress(await query(factory, 'directory', [], hash)) !== deployments.directory ||
      runtimeAddress(await query(directory, 'factory', [], hash)) !== deployments.factory
    ) {
      throw new Error('The finalized factory and directory bindings do not match.');
    }
    async function read(at: Hex | 'best') {
      const args = [account.evmAddress];
      return reconcileRuntime(
        ...(await Promise.all([
          query(directory, 'runtimeOf', args, at),
          query(factory, 'pendingRuntimeOf', args, at),
          query(factory, 'pendingRuntimeStageOf', args, at)
        ]))
      );
    }
    function nextMethod(stage: number) {
      return stage === 0 ? 'createRuntime' : 'installRuntimeStep';
    }
    async function preview(): Promise<ArtistPreview> {
      const finalized = await contracts.finalizedHash();
      const state = await read(finalized);
      if (state.stage === 'ready') {
        const runtime = contracts.resolver.getRuntimeContract(state.runtime);
        if (runtimeAddress(await query(runtime, 'owner', [], finalized)) !== account.evmAddress.toLowerCase()) {
          throw new Error('The registered runtime does not report the selected artist as owner.');
        }
        return { status: 'ready', runtime: state.runtime };
      }
      const best = await read('best');
      if (best.stage !== state.stage || best.runtime !== state.runtime) {
        throw new Error('An artist transaction is awaiting finality. Check again once the wallet has confirmed it.');
      }
      const mapped = await contracts.readMappedAccount(account.evmAddress, finalized);
      const { ss58Decode } = await import('@parity/product-sdk/address');
      if (!mapped || toHex(ss58Decode(mapped).publicKey) !== account.publicKey) {
        throw new Error('Could not confirm the existing Paseo account mapping. No mapping transaction was requested.');
      }
      const calldata = encodeFunctionData({ abi: artistRuntimeFactoryAbi, functionName: nextMethod(state.stage) });
      const dryRun = await contracts.dryRunCall(account.substrateAddress, deployments.factory, 0n, undefined, undefined, hexToBytes(calldata), {
        at: finalized
      });
      if (!dryRun.result.success || (dryRun.result.value.flags & 1) !== 0) {
        throw new Error('Paseo could not simulate the next step. Check your account mapping and balance in Polkadot.');
      }
      const deposit = dryRun.storage_deposit.type === 'Charge' ? dryRun.storage_deposit.value : 0n;
      const available = await contracts.readAvailableBalance(account.substrateAddress);
      return { status: 'review', state, deposit, available, nativeDecimals: contracts.nativeTokenDecimals };
    }
    async function approve(reviewed: Extract<ArtistPreview, { status: 'review' }>, beforeSubmit: () => void) {
      const current = await preview();
      if (
        current.status !== 'review' ||
        current.state.stage !== reviewed.state.stage ||
        current.state.runtime !== reviewed.state.runtime ||
        current.deposit !== reviewed.deposit ||
        current.available < current.deposit
      ) {
        return { status: 'changed' as const, preview: current };
      }
      const selected = signer.getState().selectedAccount;
      if (!selected || toHex(selected.publicKey) !== account.publicKey) throw new Error('The wallet account changed. Reopen this screen to verify it again.');
      const submit = factory[nextMethod(current.state.stage)]?.tx;
      if (!submit) throw new Error('The next factory call is unavailable in this build.');
      beforeSubmit();
      const result = await submit({ waitFor: 'finalized', storageDepositLimit: current.deposit });
      if (!result.ok || !result.value.ok || !result.value.block?.hash || !/^0x[0-9a-f]{64}$/i.test(result.value.txHash)) {
        throw new Error('The wallet did not confirm a finalized success. Check wallet activity before reviewing another approval.');
      }
      return { status: 'finalized' as const, hash: result.value.txHash };
    }
    return { preview, approve, close };
  } catch (error) {
    close();
    throw error;
  }
}
