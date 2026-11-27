// Selects the runtime write adapter and hands callers a plain RuntimeWritePort.
//
// Writes are money/ownership operations, so adapter selection is intentionally
// build-time and fail-closed, matching runtimeReaderProvider. The default path
// remains viem with the connected EVM wallet. Product CDM writes are
// available only in builds that explicitly opt in to the Product contract graph.

import { SupportNotSubmittedError } from '../payments/supportPayment';
import { assertNativeAccessPayment } from '../payments/paymentModel';
import type { getWalletClient } from '../../shared/config/contracts';
import { createProductCdmRuntimeWriter, productCdmPaymentWasNotSubmitted } from './productCdmRuntimeAdapter';
import { resolveRuntimeAdapterConfig, type RuntimeAdapterConfig } from './runtimeAdapterConfig';
import type { RuntimeAccessPolicyUpdate, RuntimeTrackRegistration, RuntimeWritePort } from './runtimePorts';
import { createViemRuntimeWriter } from './viemRuntimeAdapter';
import { readNativeContributionReceiptApi } from './nativeContributionReceiptApi';
import { createProductSignerManager, type ProductRuntimeSignerAccount } from './productRuntimeSigner';
export { createProductSignerManager, type ProductRuntimeSignerAccount } from './productRuntimeSigner';
import { nativeRoyaltyReceipts } from './nativeRoyaltyReceipts';

type ViemWalletClient = Awaited<ReturnType<typeof getWalletClient>>;

export type RuntimeWriterDeps = {
  ethRpcUrl: string;
  getViemWalletClient: () => Promise<ViemWalletClient>;
  config?: RuntimeAdapterConfig;
  productAccount?: ProductRuntimeSignerAccount;
  nativeReceiptApiUrl?: string;
};

// Build-time constant. A viem build must not import the Product contract graph,
// because the descriptors are large and cannot execute outside the Product host.
const PRODUCT_CDM_ENABLED = import.meta.env.VITE_DOTIFY_RUNTIME_ADAPTER === 'product-cdm';

async function createViemWriter(deps: RuntimeWriterDeps): Promise<RuntimeWritePort> {
  const walletClient = await deps.getViemWalletClient();
  return createViemRuntimeWriter({ ethRpcUrl: deps.ethRpcUrl, walletClient });
}

async function createProductCdmWriter(config: RuntimeAdapterConfig, productAccount?: ProductRuntimeSignerAccount, apiUrl?: string): Promise<RuntimeWritePort> {
  if (!PRODUCT_CDM_ENABLED) {
    throw new Error(
      'This Dotify build was not built with VITE_DOTIFY_RUNTIME_ADAPTER=product-cdm, so the Product contract write adapter is not bundled. Rebuild with that flag to use it.'
    );
  }

  const { createProductCdmContracts } = await import('./productCdmContracts');
  const signerManager = await createProductSignerManager(productAccount);
  try {
    const { resolver, nativeTokenDecimals, readAvailableBalance, verifyDeployment } = await createProductCdmContracts({
      environment: config.productEnvironment,
      signerManager
    });
    await verifyDeployment();
    const address = signerManager.getState().selectedAccount?.address;
    return createProductCdmRuntimeWriter({
      contracts: resolver,
      nativeTokenDecimals,
      getPaymentSigner: () => signerManager.getSigner(),
      ...(apiUrl ? { beforeRoyaltySubmit: () => nativeRoyaltyReceipts.preflight(apiUrl) } : {}),
      onRoyaltyFinalized: async (runtime, hash, block) => {
        if (!apiUrl) return;
        // Persist first. A failed API call must never trigger another payment.
        await nativeRoyaltyReceipts.enqueue(apiUrl, { runtime, hash, block });
        void nativeRoyaltyReceipts.flush(apiUrl, runtime).catch(() => {});
      },
      ...(address && readAvailableBalance ? { readAvailableBalance: () => readAvailableBalance(address) } : {})
    });
  } catch (error) {
    signerManager.destroy();
    throw error;
  }
}

/**
 * Build the configured write port.
 *
 * Product setup is lazy: creating this provider during React render must not
 * contact the host or prompt the user. The first actual write performs setup and
 * then reuses that Product port for later writes. Viem writes resolve a fresh
 * wallet client per call so account/network changes are observed.
 */
export function createRuntimeWriter(deps: RuntimeWriterDeps): RuntimeWritePort {
  const config = deps.config ?? resolveRuntimeAdapterConfig(import.meta.env);
  let productPortPromise: Promise<RuntimeWritePort> | null = null;
  let productPort: RuntimeWritePort | undefined;

  function portForWrite(): Promise<RuntimeWritePort> {
    if (config.kind === 'viem') return createViemWriter(deps);
    productPortPromise ??= createProductCdmWriter(config, deps.productAccount, deps.nativeReceiptApiUrl ?? import.meta.env.VITE_DOTIFY_API_URL)
      .then(port => {
        productPort = port;
        return port;
      })
      .catch(error => {
        productPortPromise = null;
        throw error;
      });
    return productPortPromise;
  }

  return {
    getRoyaltyReceiptWarning: hash => productPort?.getRoyaltyReceiptWarning?.(hash),
    contributionConfirmationMode: config.kind === 'product-cdm' ? 'finalized-event' : 'evm-receipt',
    readFinalizedContributionLogs: async (hash, block) => {
      if (!PRODUCT_CDM_ENABLED || config.kind !== 'product-cdm') throw new Error('Native contribution receipts require the Product CDM profile.');
      return readNativeContributionReceiptApi({ apiUrl: deps.nativeReceiptApiUrl ?? import.meta.env.VITE_DOTIFY_API_URL, hash, block });
    },
    contributionCall: async (runtime, method, args, value, onFinalized, observer) => {
      let port: RuntimeWritePort;
      try {
        port = await portForWrite();
      } catch (error) {
        throw new SupportNotSubmittedError(error);
      }
      if (!port.contributionCall) throw new SupportNotSubmittedError(new Error('This wallet cannot submit contributions.'));
      try {
        return await port.contributionCall(runtime, method, args, value, onFinalized, observer);
      } catch (error) {
        if (config.kind === 'product-cdm' && productCdmPaymentWasNotSubmitted(error)) throw new SupportNotSubmittedError(error);
        throw error;
      }
    },
    inspectPayment: async intent => {
      assertNativeAccessPayment(intent);
      const port = await portForWrite();
      return port.inspectPayment ? port.inspectPayment(intent) : {};
    },
    createRuntime: factoryAddress => portForWrite().then(port => port.createRuntime(factoryAddress)),
    installRuntimeStep: factoryAddress => portForWrite().then(port => port.installRuntimeStep(factoryAddress)),
    registerTrack: (runtimeAddress, registration: RuntimeTrackRegistration) => portForWrite().then(port => port.registerTrack(runtimeAddress, registration)),
    updateMetadata: (runtimeAddress, contentHash, title, description, metadataRef, expectedMetadataRef) =>
      portForWrite().then(port => {
        if (!port.updateMetadata) throw new Error('This artist runtime needs the metadata editing upgrade.');
        return port.updateMetadata(runtimeAddress, contentHash, title, description, metadataRef, expectedMetadataRef);
      }),
    payForAccess: async (intent, onStatus) => {
      assertNativeAccessPayment(intent);
      let port: RuntimeWritePort;
      try {
        port = await portForWrite();
      } catch (error) {
        throw new SupportNotSubmittedError(error);
      }
      try {
        return await (onStatus ? port.payForAccess(intent, onStatus) : port.payForAccess(intent));
      } catch (error) {
        // Product contract sizing uses a dry-run before signing/submission. A
        // documented pre-submit failure is safe to clear from the local payment
        // journal; timeout/dispatch failures remain uncertain and are not retried.
        if (config.kind === 'product-cdm' && productCdmPaymentWasNotSubmitted(error)) {
          throw new SupportNotSubmittedError(error);
        }
        throw error;
      }
    },
    claimRoyalty: (runtimeAddress, recipientAddress) => portForWrite().then(port => port.claimRoyalty(runtimeAddress, recipientAddress)),
    setAccessMode: (runtimeAddress, update: RuntimeAccessPolicyUpdate) => portForWrite().then(port => port.setAccessMode(runtimeAddress, update)),
    setReleaseActive: (runtimeAddress, contentHash, active) => portForWrite().then(port => port.setReleaseActive(runtimeAddress, contentHash, active)),
    waitForTransaction: txHash => portForWrite().then(port => port.waitForTransaction(txHash))
  };
}
