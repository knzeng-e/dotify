import { useState } from 'react';
import { getAddress, isAddress } from 'viem';
import { getWalletClient, resolveEvmChain } from '../shared/config/contracts';
import { checkBulletinAuthorization, encodeBulletinJson, uploadToBulletin } from './useBulletin';
import {
  protectedAudioUploadToCID,
  protectedAudioUploadToKeyVersion,
  protectedAudioUploadToRef,
  isBackendConfigured,
  uploadFileToPinata,
  uploadJsonToPinata,
  uploadProtectedAudio,
  type BackendUploadIdentity,
  type DotifyTrackManifest,
  type ProtectedAudioUpload
} from '../services/pinata';
import { chainMismatchMessage } from '../features/wallet/network';
import { localAudioRef, priceDotForAccessMode, runtimeAddressFromTrackId } from '../features/catalog/trackModel';
import { encodeAccessMode, encodeRequiredPersonhood, manifestRequiredPersonhood } from '../features/runtime/accessEncoding';
import { resolvePreparedAudioUploadForRuntime } from '../features/uploads/preparedAudioUpload';
import { resolvePreparedUpload, type PreparedUploadRef } from '../features/uploads/preparedUpload';
import { createRuntimeReader } from '../features/runtime/runtimeReaderProvider';
import { createRuntimeWriter } from '../features/runtime/runtimeWriterProvider';
import { resolveRuntimeAdapterConfig } from '../features/runtime/runtimeAdapterConfig';
import { resolveProductHostConfig } from '../features/productHost/productHost';
import { resolveConfiguredArtistPublicationSafety } from '../shared/config/deploymentSafety';
import { describeArtistRegistrationError, formatWeiAsDot, shorten, dotToPlanck } from '../shared/utils/format';
import {
  createArtistPublishE2eTrack,
  E2E_ARTIST_PROFILE_TX_HASH,
  E2E_ARTIST_RELEASE_TX_HASH,
  E2E_ARTIST_RUNTIME,
  getArtistPublishE2eNetworkError,
  getArtistPublishE2eScenario,
  getArtistPublishE2eState,
  isArtistPublishE2e,
  isArtistPublishE2eScenarioRequested,
  markArtistPublishRuntimeCreated,
  publishArtistPublishE2eTrack,
  recordArtistPublishTransactionFailure
} from '../e2e/artistPublishMock';
import type { AccessMode, CatalogTrack, PersonhoodLevel, ReleaseRoyaltySplitDraft, RoyaltyPayment, TransactionFeedback } from '../shared/types';
import type { ConnectedWallet } from './useWallet';
import type { PolkadotSigner } from 'polkadot-api';

const runtimeAdapterConfig = resolveRuntimeAdapterConfig(import.meta.env);
const productHostConfig = resolveProductHostConfig(import.meta.env);

const runtimeBootstrapSteps = [
  {
    label: 'Claim your artist space',
    detail: 'Create the on-chain home where your music and rights will live.'
  },
  {
    label: 'Make the space findable',
    detail: 'Let Dotify connect your wallet to the artist space listeners will discover.'
  },
  {
    label: 'Keep creative control',
    detail: 'Give your artist wallet the authority to care for this space over time.'
  },
  {
    label: 'Open your music record',
    detail: 'Prepare a public record for your tracks, artwork, stories, and listening choices.'
  },
  {
    label: 'Attach ownership to music',
    detail: 'Let each track carry an ownership record that can move with the work.'
  },
  {
    label: 'Define how value flows',
    detail: 'Prepare paid access and royalty splits so support reaches the right people.'
  },
  {
    label: 'Choose listening conditions',
    detail: 'Enable free, paid, and human-free access choices for each track.'
  },
  {
    label: 'Own the artist space',
    detail: 'Make your wallet responsible for the whole space, beyond the ownership of individual tracks.'
  }
] as const;

function artistRuntimeBootstrapRoadmap(
  activeIndex: number,
  activeStatus: 'active' | 'submitted' | 'complete',
  confirmedTxHashes: Partial<Record<number, `0x${string}`>> = {}
): TransactionFeedback['steps'] {
  return runtimeBootstrapSteps.map((step, index) => {
    const status =
      index < activeIndex || (index === activeIndex && activeStatus === 'complete') ? 'complete' : index === activeIndex ? activeStatus : 'upcoming';

    return {
      ...step,
      status,
      txHash: status === 'complete' ? confirmedTxHashes[index] : undefined
    };
  });
}

function createBulletinManifestRef(hash: `0x${string}`) {
  return `paseo-bulletin:dotify-manifest:${hash}`;
}

function normalizeRoyaltyBps(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} royalty share must be a number.`);
  }
  const bps = Math.trunc(value);
  if (bps < 0 || bps > 10_000) {
    throw new Error(`${label} royalty share must be between 0% and 100%.`);
  }
  return bps;
}

function resolveRoyaltySplits(primaryRecipient: `0x${string}`, primaryBps: number, additionalSplits: ReleaseRoyaltySplitDraft[]) {
  const recipients: `0x${string}`[] = [primaryRecipient];
  const shares: number[] = [normalizeRoyaltyBps(primaryBps, 'Artist')];

  for (const split of additionalSplits) {
    const label = split.label.trim() || 'Rights holder';
    const recipient = split.recipient.trim();
    const bps = normalizeRoyaltyBps(split.bps, label);
    const emptyDraft = !recipient && bps === 0;
    if (emptyDraft) continue;
    if (!recipient) {
      throw new Error(`${label} needs an EVM address.`);
    }
    if (!isAddress(recipient)) {
      throw new Error(`${label} has an invalid EVM address.`);
    }
    if (bps === 0) {
      throw new Error(`${label} needs a royalty share above 0%, or remove the row.`);
    }
    recipients.push(getAddress(recipient));
    shares.push(bps);
  }

  const totalBps = shares.reduce((total, bps) => total + bps, 0);
  if (totalBps <= 0) {
    throw new Error('Royalty split must reserve at least 0.01%.');
  }
  if (totalBps > 10_000) {
    throw new Error('Royalty split cannot exceed 100%.');
  }
  return { recipients, shares, totalBps };
}

function resolveReleaseRoyaltySplits(
  primaryRecipient: `0x${string}`,
  accessMode: AccessMode,
  primaryBps: number,
  additionalSplits: ReleaseRoyaltySplitDraft[]
) {
  if (accessMode === 'free') {
    return { recipients: [primaryRecipient], shares: [10_000], totalBps: 10_000 };
  }
  return resolveRoyaltySplits(primaryRecipient, primaryBps, additionalSplits);
}

function getStoredArtistName(address: `0x${string}`) {
  try {
    return window.localStorage.getItem(getArtistNameStorageKey(address));
  } catch {
    return null;
  }
}

function storeArtistName(address: `0x${string}`, name: string) {
  try {
    window.localStorage.setItem(getArtistNameStorageKey(address), name);
  } catch {
    // ignore storage failures in private browsing or restricted environments
  }
}

function getArtistNameStorageKey(address: `0x${string}`) {
  return `dotify:artist-name:${address.toLowerCase()}`;
}

function preparedAudioRuntimeMismatchMessage(uploadRuntime: `0x${string}`, publicationRuntime: `0x${string}`): string {
  return `The prepared audio upload was encrypted for ${shorten(uploadRuntime, 10)}, but this release is being published to ${shorten(publicationRuntime, 10)}. Dotify will not register audio under a different runtime than the one that derived its content key. Select the audio file again and retry.`;
}

export { getStoredArtistName, storeArtistName };

export type UseArtistConsoleDeps = {
  activeEvmAddress: `0x${string}`;
  connectedWallet: ConnectedWallet | null;
  ethRpcUrl: string;
  currentChainId: number | null;
  factoryAddress: `0x${string}` | undefined;
  directoryAddress: `0x${string}` | undefined;
  fileHash: `0x${string}` | '';
  title: string;
  artistName: string;
  description: string;
  accessMode: AccessMode;
  priceDot: string;
  personhoodLevel: PersonhoodLevel;
  royaltyBps: number;
  additionalRoyaltySplits: ReleaseRoyaltySplitDraft[];
  audioSource: string | null;
  coverFile: File | null;
  audioCID: string;
  coverCID: string;
  coverSource: string;
  activeSubstrateAddress: string | null;
  activeSubstrateSigner: PolkadotSigner | null;
  artistTracks: CatalogTrack[];
  setTransactionFeedback: (feedback: TransactionFeedback | null) => void;
  refreshCatalogFromRegistry: (hash?: `0x${string}`) => Promise<CatalogTrack[]>;
  setAudioCID: (cid: string) => void;
  setCoverCID: (cid: string) => void;
  uploadToBulletinEnabled: boolean;
  audioUploadRef: PreparedUploadRef<ProtectedAudioUpload>;
  coverUploadRef: PreparedUploadRef;
};

export function useArtistConsole(deps: UseArtistConsoleDeps) {
  const {
    activeEvmAddress,
    connectedWallet,
    ethRpcUrl,
    currentChainId,
    factoryAddress,
    directoryAddress,
    fileHash,
    title,
    artistName,
    description,
    accessMode,
    priceDot,
    personhoodLevel,
    royaltyBps,
    additionalRoyaltySplits,
    audioSource,
    coverFile,
    activeSubstrateAddress,
    activeSubstrateSigner,
    artistTracks,
    setTransactionFeedback,
    refreshCatalogFromRegistry,
    setAudioCID,
    setCoverCID,
    uploadToBulletinEnabled,
    audioUploadRef,
    coverUploadRef
  } = deps;

  const runtimeReader = createRuntimeReader({ ethRpcUrl });
  const [artistRuntimeAddress, setArtistRuntimeAddress] = useState<`0x${string}` | null>(null);
  const [artistRegistrationStatus, setArtistRegistrationStatus] = useState('Checking artist registration');
  const [isRegisteringArtist, setIsRegisteringArtist] = useState(false);
  const [isRefreshingArtistRuntime, setIsRefreshingArtistRuntime] = useState(false);
  const [rightsStatus, setRightsStatus] = useState('No audio file selected');
  const [royaltyPayments, setRoyaltyPayments] = useState<RoyaltyPayment[]>([]);
  const [claimableRoyaltyWei, setClaimableRoyaltyWei] = useState(0n);
  const [royaltyStatus, setRoyaltyStatus] = useState('No artist profile selected');
  const [isRefreshingRoyalties, setIsRefreshingRoyalties] = useState(false);
  const [isClaimingRoyalties, setIsClaimingRoyalties] = useState(false);
  const [expandedRoyaltyPaymentId, setExpandedRoyaltyPaymentId] = useState<string | null>(null);
  const [bulletinManifestRef, setBulletinManifestRef] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [releaseActionId, setReleaseActionId] = useState<string | null>(null);

  const artistPublicationSafety = resolveConfiguredArtistPublicationSafety({
    explicitE2e: import.meta.env.DEV && isArtistPublishE2eScenarioRequested(),
    rpcUrl: ethRpcUrl,
    currentChainId
  });
  const artistPublicationQuarantined = artistPublicationSafety.quarantined;
  const artistRegistrationConfigured = Boolean(factoryAddress && directoryAddress);
  const artistRegistrationAvailable = artistRegistrationConfigured && !artistPublicationQuarantined;

  async function getActiveWalletClient(): Promise<Awaited<ReturnType<typeof getWalletClient>>> {
    if (!connectedWallet) {
      throw new Error('Connect a wallet before signing this transaction.');
    }
    if (!connectedWallet.createEvmClient) {
      throw new Error('Artist publishing still requires a passkey or EVM wallet while Dotify contracts are being ported to the Product DevNet host signer.');
    }
    const chain = await resolveEvmChain(ethRpcUrl);
    if (connectedWallet.chainId !== undefined && connectedWallet.chainId !== chain.id) {
      throw new Error(chainMismatchMessage(chain.id, connectedWallet.chainId));
    }
    return connectedWallet.createEvmClient(chain, ethRpcUrl) as Awaited<ReturnType<typeof getWalletClient>>;
  }

  function getRuntimeWriter() {
    const signer = connectedWallet?.keyRequestSigner;
    const productAccount =
      connectedWallet?.method === 'product-host'
        ? {
            productId: productHostConfig.productId,
            evmAddress: connectedWallet.evmAddress,
            publicKey: signer && 'productPublicKey' in signer ? signer.productPublicKey : undefined
          }
        : undefined;

    return createRuntimeWriter({
      ethRpcUrl,
      getViemWalletClient: getActiveWalletClient,
      config: runtimeAdapterConfig,
      productAccount
    });
  }

  async function getUploadIdentity(): Promise<BackendUploadIdentity | undefined> {
    if (!isBackendConfigured()) return undefined;
    if (!connectedWallet) throw new Error('Connect the artist wallet before uploading release assets.');
    const chainId = currentChainId ?? connectedWallet.chainId ?? (await resolveEvmChain(ethRpcUrl)).id;
    if (connectedWallet.keyRequestSigner) return { chainId, signer: connectedWallet.keyRequestSigner };
    return { chainId, walletClient: await getActiveWalletClient() };
  }

  async function refreshArtistRuntime(showBusy = false) {
    if (isArtistPublishE2e) {
      if (showBusy) {
        setIsRefreshingArtistRuntime(true);
      }
      setArtistRegistrationStatus('Checking artist runtime');
      await new Promise(resolve => window.setTimeout(resolve, 10));
      const state = getArtistPublishE2eState();
      if (state.runtimeCreated) {
        setArtistRuntimeAddress(E2E_ARTIST_RUNTIME);
        setArtistRegistrationStatus('Artist registered');
        if (showBusy) setIsRefreshingArtistRuntime(false);
        return E2E_ARTIST_RUNTIME;
      }
      setArtistRuntimeAddress(null);
      setArtistRegistrationStatus('Artist not registered yet');
      if (showBusy) setIsRefreshingArtistRuntime(false);
      return null;
    }

    // This refresh is intentionally read-only even when publication is
    // quarantined, so existing artist runtime state stays visible. Write paths
    // must continue to gate on artistPublicationQuarantined or
    // artistRegistrationAvailable before sending transactions.
    if (!artistRegistrationConfigured) {
      setArtistRuntimeAddress(null);
      setArtistRegistrationStatus('Artist runtime contracts are not deployed yet.');
      return null;
    }

    if (showBusy) {
      setIsRefreshingArtistRuntime(true);
    }

    setArtistRegistrationStatus('Checking artist runtime');

    try {
      const directoryExists = await runtimeReader.ensureContract(directoryAddress!);
      if (!directoryExists) {
        setArtistRuntimeAddress(null);
        setArtistRegistrationStatus('Artist directory unavailable');
        return null;
      }

      const runtimeAddress = await runtimeReader.resolveArtistRuntime(directoryAddress!, activeEvmAddress);

      if (!runtimeAddress) {
        setArtistRuntimeAddress(null);
        setArtistRegistrationStatus(artistPublicationQuarantined ? artistPublicationSafety.reason : 'Artist not registered yet');
        return null;
      }

      setArtistRuntimeAddress(runtimeAddress);
      setArtistRegistrationStatus('Artist registered');
      return runtimeAddress;
    } catch (runtimeError) {
      const message = runtimeError instanceof Error ? runtimeError.message : 'Unable to resolve artist runtime';
      setArtistRuntimeAddress(null);
      setArtistRegistrationStatus(message);
      return null;
    } finally {
      if (showBusy) {
        setIsRefreshingArtistRuntime(false);
      }
    }
  }

  async function registerArtist() {
    if (artistPublicationQuarantined) {
      setArtistRegistrationStatus(artistPublicationSafety.reason);
      setTransactionFeedback({ tone: 'error', title: 'Artist publishing paused', message: artistPublicationSafety.reason });
      return;
    }

    if (!connectedWallet) {
      setTransactionFeedback({
        tone: 'error',
        title: 'Wallet required',
        message: 'Connect a wallet before creating an artist profile.'
      });
      setArtistRegistrationStatus('Connect your wallet to claim an artist profile.');
      return;
    }

    if (isArtistPublishE2e) {
      const networkError = getArtistPublishE2eNetworkError(connectedWallet);
      if (networkError) {
        setArtistRegistrationStatus(networkError);
        setTransactionFeedback({
          tone: 'error',
          title: 'Network mismatch',
          message: networkError
        });
        return;
      }

      setIsRegisteringArtist(true);
      try {
        setArtistRegistrationStatus('Creating artist runtime');
        await new Promise(resolve => window.setTimeout(resolve, 20));
        markArtistPublishRuntimeCreated();
        setArtistRuntimeAddress(E2E_ARTIST_RUNTIME);
        setArtistRegistrationStatus('Artist registered');
        setRightsStatus('Artist registered. Add audio and publish the first track.');
        setTransactionFeedback({
          tone: 'success',
          title: 'Artist registered',
          message: 'The artist signer now owns a personal SmartRuntime and can publish music.',
          txHash: E2E_ARTIST_PROFILE_TX_HASH
        });
      } finally {
        setIsRegisteringArtist(false);
      }
      return;
    }

    if (!artistRegistrationAvailable) {
      setTransactionFeedback({
        tone: 'error',
        title: 'Artist registry unavailable',
        message: 'Deploy the ArtistRuntimeFactory and ArtistDirectory before registering an artist.'
      });
      return;
    }

    setIsRegisteringArtist(true);

    try {
      const existingRuntime = await refreshArtistRuntime();
      if (existingRuntime) {
        setTransactionFeedback({
          tone: 'success',
          title: 'Artist already registered',
          message: 'This signer already owns a SmartRuntime and can publish music.'
        });
        return;
      }

      const factoryExists = await runtimeReader.ensureContract(factoryAddress!);
      if (!factoryExists) {
        setTransactionFeedback({
          tone: 'error',
          title: 'Factory unavailable',
          message: 'ArtistRuntimeFactory not found at the configured address.'
        });
        return;
      }

      const runtimeWriter = getRuntimeWriter();

      let pendingRuntime = await runtimeReader.pendingRuntimeOf(factoryAddress!, activeEvmAddress);

      let txHash: `0x${string}` | undefined;
      const confirmedBootstrapTxHashes: Partial<Record<number, `0x${string}`>> = {};

      if (!pendingRuntime) {
        setArtistRegistrationStatus(runtimeBootstrapSteps[0].label);
        setTransactionFeedback({
          tone: 'pending',
          title: 'Review artist registration',
          message: `Your artist space is created through ${runtimeBootstrapSteps.length} clear approvals. Each one adds a precise commitment you can review before continuing.`,
          steps: artistRuntimeBootstrapRoadmap(0, 'active')
        });

        txHash = await runtimeWriter.createRuntime(factoryAddress!);

        setTransactionFeedback({
          tone: 'pending',
          title: 'Registering artist',
          message: 'Your artist space is being created on-chain. The next approval will appear after confirmation.',
          txHash,
          steps: artistRuntimeBootstrapRoadmap(0, 'submitted', confirmedBootstrapTxHashes)
        });

        await runtimeWriter.waitForTransaction(txHash);
        confirmedBootstrapTxHashes[0] = txHash;
      } else {
        const pendingStage = await runtimeReader.pendingRuntimeStageOf(factoryAddress!, activeEvmAddress);
        const pendingStepIndex = Math.max(1, Math.min(runtimeBootstrapSteps.length - 1, pendingStage));
        setTransactionFeedback({
          tone: 'pending',
          title: 'Resuming artist registration',
          message: `Continuing setup for ${shorten(pendingRuntime, 10)}. The next commitment is shown below.`,
          steps: artistRuntimeBootstrapRoadmap(pendingStepIndex, 'active')
        });
      }

      pendingRuntime = await runtimeReader.pendingRuntimeOf(factoryAddress!, activeEvmAddress);

      while (pendingRuntime) {
        const currentStage = await runtimeReader.pendingRuntimeStageOf(factoryAddress!, activeEvmAddress);
        const stepIndex = Math.max(1, Math.min(runtimeBootstrapSteps.length - 1, currentStage));
        const step = runtimeBootstrapSteps[stepIndex];

        setArtistRegistrationStatus(step.label);
        setTransactionFeedback({
          tone: 'pending',
          title: 'Review artist registration',
          message: `Approval ${stepIndex + 1}/${runtimeBootstrapSteps.length}: ${step.detail}`,
          steps: artistRuntimeBootstrapRoadmap(stepIndex, 'active', confirmedBootstrapTxHashes)
        });

        txHash = await runtimeWriter.installRuntimeStep(factoryAddress!);

        setTransactionFeedback({
          tone: 'pending',
          title: 'Registering artist',
          message: `${step.label} is being confirmed on-chain. The next approval will appear when this is done.`,
          txHash,
          steps: artistRuntimeBootstrapRoadmap(stepIndex, 'submitted', confirmedBootstrapTxHashes)
        });

        await runtimeWriter.waitForTransaction(txHash);
        confirmedBootstrapTxHashes[stepIndex] = txHash;

        pendingRuntime = await runtimeReader.pendingRuntimeOf(factoryAddress!, activeEvmAddress);
      }

      const runtimeAddress = await refreshArtistRuntime();

      if (!runtimeAddress) {
        throw new Error('Artist runtime was not indexed after confirmation');
      }

      setRightsStatus('Artist registered. Add audio and publish the first track.');
      setTransactionFeedback({
        tone: 'success',
        title: 'Artist registered',
        message: 'The artist signer now owns a personal SmartRuntime and can publish music.',
        txHash,
        steps: artistRuntimeBootstrapRoadmap(runtimeBootstrapSteps.length - 1, 'complete', confirmedBootstrapTxHashes)
      });
    } catch (registrationError) {
      const message = describeArtistRegistrationError(registrationError);
      setArtistRegistrationStatus(message);
      setTransactionFeedback({
        tone: 'error',
        title: 'Artist registration failed',
        message
      });
    } finally {
      setIsRegisteringArtist(false);
    }
  }

  async function refreshArtistRoyalties(showBusy = false) {
    if (!artistRuntimeAddress) {
      setRoyaltyPayments([]);
      setClaimableRoyaltyWei(0n);
      setRoyaltyStatus('Create an artist profile to track payments');
      return;
    }

    if (showBusy) {
      setIsRefreshingRoyalties(true);
    }

    setRoyaltyStatus('Reading artist runtime payments');

    try {
      const trackByHash = new Map(artistTracks.map(track => [track.hash.toLowerCase(), track]));
      const claimableWei = await runtimeReader.getRoyaltyClaimable(artistRuntimeAddress, activeEvmAddress).catch(() => 0n);
      setClaimableRoyaltyWei(claimableWei);
      const logs = await runtimeReader.listRoyaltyPaymentLogs(artistRuntimeAddress, activeEvmAddress);
      const payments = logs
        .map(log => {
          const track = trackByHash.get(log.trackHash.toLowerCase());

          return {
            id: `${log.transactionHash}-${log.logIndex}`,
            trackHash: log.trackHash,
            trackTitle: track?.title ?? shorten(log.trackHash, 14),
            listener: log.listener,
            recipient: log.recipient,
            amountWei: log.amountWei,
            amountDot: formatWeiAsDot(log.amountWei),
            settlement: log.settlement,
            ...(log.pendingTotalWei !== undefined ? { pendingTotalWei: log.pendingTotalWei } : {}),
            paidAtMs: log.paidAtMs,
            transactionHash: log.transactionHash,
            blockNumber: log.blockNumber,
            logIndex: log.logIndex
          } satisfies RoyaltyPayment;
        })
        .sort((left, right) => {
          if (left.blockNumber !== right.blockNumber) {
            return left.blockNumber > right.blockNumber ? -1 : 1;
          }
          return right.logIndex - left.logIndex;
        });

      setRoyaltyPayments(payments);
      setRoyaltyStatus(payments.length > 0 || claimableWei > 0n ? 'Royalty settlement indexed from your runtime' : 'No access payments received yet');
    } catch (royaltyError) {
      const message = royaltyError instanceof Error ? royaltyError.message : 'Unable to load royalty payments';
      setRoyaltyPayments([]);
      setRoyaltyStatus(message);
    } finally {
      if (showBusy) {
        setIsRefreshingRoyalties(false);
      }
    }
  }

  function createRightsManifest(
    contentHash: `0x${string}`,
    royaltyRecipients: `0x${string}`[],
    royaltyShares: number[],
    resolvedAudioCID: string,
    resolvedCoverCID: string,
    resolvedAudioRef: string
  ): DotifyTrackManifest {
    const keyVersion = protectedAudioUploadToKeyVersion(resolvedAudioRef);
    return {
      schema: 'dotify.track.v1',
      createdAt: new Date().toISOString(),
      assets: {
        audioCID: resolvedAudioCID,
        coverCID: resolvedCoverCID,
        encrypted: true,
        ...(keyVersion ? { keyVersion } : {})
      },
      track: {
        contentHash,
        title: title.trim() || 'Untitled',
        artistName: artistName.trim() || 'Unknown artist',
        description: description.trim(),
        accessMode,
        priceDot: priceDotForAccessMode(accessMode, priceDot),
        requiredPersonhood: manifestRequiredPersonhood(accessMode, personhoodLevel),
        zone: 'Studio'
      },
      royalties: royaltyRecipients.map((recipient, index) => ({
        recipient,
        bps: royaltyShares[index] ?? 0
      })),
      settlement: {
        target: 'evm',
        royaltyBps: royaltyShares.reduce((total, bps) => total + bps, 0),
        pricePlanck: dotToPlanck(priceDotForAccessMode(accessMode, priceDot)).toString()
      }
    };
  }

  async function registerRights() {
    if (artistPublicationQuarantined) {
      setRightsStatus('Artist publishing temporarily paused');
      setTransactionFeedback({ tone: 'error', title: 'Artist publishing paused', message: artistPublicationSafety.reason });
      return;
    }

    if (!connectedWallet) {
      setRightsStatus('Connect your wallet before publishing');
      setTransactionFeedback({
        tone: 'error',
        title: 'Wallet required',
        message: 'Connect the artist wallet before publishing a release.'
      });
      return;
    }

    if (!fileHash) {
      setRightsStatus('Select an audio file');
      return;
    }

    setIsRegistering(true);
    setTransactionFeedback({
      tone: 'pending',
      title: 'Preparing registration',
      message: 'Building the rights manifest and validating the selected services.'
    });

    let bulletinRef = bulletinManifestRef;
    let runtimeAddress = artistRuntimeAddress;
    try {
      if (isArtistPublishE2e) {
        const networkError = getArtistPublishE2eNetworkError(connectedWallet);
        if (networkError) {
          throw new Error(networkError);
        }
      }

      if (artistRegistrationAvailable) {
        setRightsStatus('Checking artist registration');
        const resolvedRuntime = await refreshArtistRuntime();
        if (!resolvedRuntime) {
          setTransactionFeedback({
            tone: 'error',
            title: 'Artist registration required',
            message: 'Register the artist first, then come back to publish tracks.'
          });
          setRightsStatus('Register artist before managing releases');
          return;
        }
        runtimeAddress = resolvedRuntime;
      }

      setRightsStatus('Awaiting IPFS uploads…');
      // Raw audio bytes feed the protected (server-encrypted) upload. Access
      // model v2: everything is encrypted at rest, no preview asset exists -
      // the access mode alone decides who gets the key.
      const rawAudioBlob = audioSource ? await fetch(audioSource).then(r => r.blob()) : null;
      const rawAudioBytes = rawAudioBlob ? new Uint8Array(await rawAudioBlob.arrayBuffer()) : null;
      const uploadIdentity = await getUploadIdentity();
      const uploadAudioForCurrentRuntime = () =>
        rawAudioBytes
          ? uploadProtectedAudio({ bytes: rawAudioBytes, name: title || 'audio', mime: rawAudioBlob?.type ?? '' }, fileHash, uploadIdentity)
          : Promise.resolve('');

      const [resolvedAudioUpload, resolvedCoverCID] = await Promise.all([
        resolvePreparedAudioUploadForRuntime({
          ref: audioUploadRef,
          upload: uploadAudioForCurrentRuntime,
          publicationRuntimeAddress: runtimeAddress,
          canRetry: Boolean(rawAudioBytes),
          onBeforeRetry: () => {
            setRightsStatus('Artist runtime changed; uploading audio again');
            setTransactionFeedback({
              tone: 'pending',
              title: 'Refreshing protected audio',
              message: 'The prepared audio belongs to a different artist runtime, so Dotify is uploading it again before registration.'
            });
          },
          mismatchMessage: preparedAudioRuntimeMismatchMessage
        }),
        resolvePreparedUpload(coverUploadRef, () =>
          coverFile ? uploadFileToPinata(coverFile, coverFile.name, { app: 'dotify', type: 'cover' }, uploadIdentity) : Promise.resolve('')
        )
      ]);

      const resolvedAudioRef = resolvedAudioUpload ? protectedAudioUploadToRef(resolvedAudioUpload) : '';
      if (!resolvedAudioRef.trim()) {
        throw new Error('Audio upload did not complete. Select the audio file again and retry.');
      }
      const resolvedAudioCID = resolvedAudioUpload ? protectedAudioUploadToCID(resolvedAudioUpload) : '';

      if (resolvedAudioCID) setAudioCID(resolvedAudioCID);
      if (resolvedCoverCID) setCoverCID(resolvedCoverCID);

      const {
        recipients: royaltyRecipients,
        shares: royaltyShares,
        totalBps: totalRoyaltyBps
      } = resolveReleaseRoyaltySplits(activeEvmAddress, accessMode, royaltyBps, additionalRoyaltySplits);
      const manifest = createRightsManifest(fileHash, royaltyRecipients, royaltyShares, resolvedAudioCID, resolvedCoverCID, resolvedAudioRef);

      setRightsStatus('Publishing manifest to IPFS…');
      setTransactionFeedback({
        tone: 'pending',
        title: 'Uploading to IPFS',
        message: 'Pinning the track manifest to IPFS via Pinata.'
      });
      const metadataCID = await uploadJsonToPinata(manifest, `${manifest.track.title}.json`, { app: 'dotify', type: 'track-metadata' }, uploadIdentity);
      const ipfsMetadataRef = `ipfs://${metadataCID}`;

      if (isArtistPublishE2e) {
        if (!runtimeAddress) {
          throw new Error('Artist runtime missing');
        }
        if (getArtistPublishE2eScenario() === 'transaction-failure') {
          recordArtistPublishTransactionFailure();
          throw new Error('E2E registration transaction rejected.');
        }

        const track = createArtistPublishE2eTrack({
          artistAddress: activeEvmAddress,
          runtimeAddress,
          hash: fileHash,
          title,
          artistName,
          description,
          accessMode,
          priceDot,
          personhoodLevel,
          royaltyBps: totalRoyaltyBps,
          audioCID: resolvedAudioCID,
          coverCID: resolvedCoverCID,
          metadataCID
        });
        publishArtistPublishE2eTrack(track);
        setRightsStatus('Rights registered');
        setTransactionFeedback({
          tone: 'success',
          title: 'Track registered',
          message: 'The transaction was confirmed and the release was added to the registry.',
          txHash: E2E_ARTIST_RELEASE_TX_HASH
        });
        await refreshCatalogFromRegistry(fileHash);
        return;
      }

      if (uploadToBulletinEnabled) {
        if (!activeSubstrateAddress || !activeSubstrateSigner) {
          const message = 'Bulletin archival requires a Substrate signer. Use a passkey wallet or disable the Bulletin archival option.';
          setRightsStatus(message);
          setTransactionFeedback({
            tone: 'error',
            title: 'Bulletin signer missing',
            message
          });
          return;
        }

        const manifestPayload = encodeBulletinJson(manifest);
        setRightsStatus('Checking Bulletin authorization for metadata JSON');
        setTransactionFeedback({
          tone: 'pending',
          title: 'Authorizing Bulletin upload',
          message: 'Checking whether the selected Bulletin account can publish this manifest.'
        });
        const authorized = await checkBulletinAuthorization(activeSubstrateAddress, manifestPayload.bytes.length);
        if (!authorized) {
          const message = 'Bulletin account is not authorized';
          setRightsStatus(message);
          setTransactionFeedback({
            tone: 'error',
            title: 'Bulletin upload blocked',
            message
          });
          return;
        }

        setRightsStatus('Publishing metadata JSON to Bulletin Chain');
        setTransactionFeedback({
          tone: 'pending',
          title: 'Publishing manifest',
          message: 'Writing the compact rights manifest to Bulletin Chain.'
        });
        const bulletinUpload = await uploadToBulletin(manifestPayload.bytes, activeSubstrateSigner);
        bulletinRef = createBulletinManifestRef(bulletinUpload.contentHash);
        setBulletinManifestRef(bulletinRef);
      }

      if (!factoryAddress || !directoryAddress) {
        setRightsStatus('Rights staged');
        setTransactionFeedback({
          tone: 'success',
          title: 'Rights prepared',
          message: 'The release is ready in the studio. Deploy the factory contract to complete the onchain step.'
        });
        return;
      }

      setRightsStatus('Checking contracts');
      setTransactionFeedback({
        tone: 'pending',
        title: 'Checking factory',
        message: 'Verifying that the ArtistRuntimeFactory is reachable before submission.'
      });
      const factoryExists = await runtimeReader.ensureContract(factoryAddress);
      if (!factoryExists) {
        setRightsStatus('Factory not found');
        setTransactionFeedback({ tone: 'error', title: 'Factory unavailable', message: 'ArtistRuntimeFactory not found at the configured address.' });
        return;
      }

      if (!runtimeAddress) {
        setRightsStatus('Artist runtime missing');
        setTransactionFeedback({
          tone: 'error',
          title: 'Artist runtime missing',
          message: 'Register the artist first before submitting a track to the onchain registry.'
        });
        return;
      }

      const runtimeWriter = getRuntimeWriter();
      const ipfsAudioRef = resolvedAudioRef || localAudioRef(fileHash);
      const ipfsCoverRef = resolvedCoverCID ? `ipfs://${resolvedCoverCID}` : `dotify:cover:${fileHash}`;

      setRightsStatus('Submitting rights transaction');
      setTransactionFeedback({
        tone: 'pending',
        title: 'Registering track',
        message: 'Sending the registration to your SmartRuntime.'
      });

      const txHash = await runtimeWriter.registerTrack(runtimeAddress, {
        contentHash: fileHash,
        title,
        artistName,
        description,
        imageRef: ipfsCoverRef,
        audioRef: ipfsAudioRef,
        metadataRef: ipfsMetadataRef,
        artistContractRef: `dotify:self-certified:${fileHash}`,
        accessMode: encodeAccessMode(accessMode),
        pricePlanck: dotToPlanck(priceDotForAccessMode(accessMode, priceDot)),
        requiredPersonhood: encodeRequiredPersonhood(accessMode, personhoodLevel),
        royaltyRecipients,
        royaltyShares
      });

      setRightsStatus('Waiting for transaction confirmation');
      setTransactionFeedback({
        tone: 'pending',
        title: 'Waiting for confirmation',
        message: 'Transaction submitted. Waiting for the final receipt on the EVM network.',
        txHash
      });
      await runtimeWriter.waitForTransaction(txHash);
      setRightsStatus('Rights registered');
      setTransactionFeedback({
        tone: 'success',
        title: 'Track registered',
        message: 'The transaction was confirmed and the release was added to the registry.',
        txHash
      });
      await refreshCatalogFromRegistry(fileHash);
    } catch (registrationError) {
      const message = registrationError instanceof Error ? registrationError.message : 'Registration failed';
      setRightsStatus(message);
      setTransactionFeedback({
        tone: 'error',
        title: 'Registration failed',
        message
      });
    } finally {
      setIsRegistering(false);
    }
  }

  async function updateReleaseAccessMode(track: CatalogTrack, nextAccessMode: AccessMode, nextPriceDot: string, nextPersonhoodLevel: PersonhoodLevel) {
    if (!connectedWallet) {
      setTransactionFeedback({
        tone: 'error',
        title: 'Wallet required',
        message: 'Connect the artist wallet before updating this release.'
      });
      return;
    }
    if (track.active === false) {
      setTransactionFeedback({
        tone: 'error',
        title: 'Release inactive',
        message: 'Reactivate this release before changing its access policy.'
      });
      return;
    }

    const runtimeAddress = runtimeAddressFromTrackId(track);
    if (!runtimeAddress) {
      setTransactionFeedback({
        tone: 'error',
        title: 'Artist runtime missing',
        message: 'This release is not linked to an artist SmartRuntime.'
      });
      return;
    }

    setReleaseActionId(`${track.id}:access`);
    try {
      const runtimeWriter = getRuntimeWriter();
      setTransactionFeedback({
        tone: 'pending',
        title: 'Updating access',
        message: `Changing "${track.title}" access policy.`
      });
      const txHash = await runtimeWriter.setAccessMode(runtimeAddress, {
        contentHash: track.hash,
        accessMode: encodeAccessMode(nextAccessMode),
        pricePlanck: dotToPlanck(priceDotForAccessMode(nextAccessMode, nextPriceDot)),
        requiredPersonhood: encodeRequiredPersonhood(nextAccessMode, nextPersonhoodLevel)
      });
      setTransactionFeedback({ tone: 'pending', title: 'Awaiting confirmation', message: 'Access update submitted.', txHash });
      await runtimeWriter.waitForTransaction(txHash);
      await refreshCatalogFromRegistry(track.hash);
      setTransactionFeedback({
        tone: 'success',
        title: 'Access updated',
        message: `"${track.title}" now uses the selected access policy.`,
        txHash
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Access update failed';
      setTransactionFeedback({ tone: 'error', title: 'Access update failed', message });
    } finally {
      setReleaseActionId(null);
    }
  }

  async function setReleaseActive(track: CatalogTrack, active: boolean) {
    if (!connectedWallet) {
      setTransactionFeedback({
        tone: 'error',
        title: 'Wallet required',
        message: 'Connect the artist wallet before updating this release.'
      });
      return;
    }

    const runtimeAddress = runtimeAddressFromTrackId(track);
    if (!runtimeAddress) {
      setTransactionFeedback({
        tone: 'error',
        title: 'Artist runtime missing',
        message: 'This release is not linked to an artist SmartRuntime.'
      });
      return;
    }

    setReleaseActionId(`${track.id}:active`);
    try {
      const runtimeWriter = getRuntimeWriter();
      setTransactionFeedback({
        tone: 'pending',
        title: active ? 'Reactivating release' : 'Deactivating release',
        message: `${active ? 'Reactivating' : 'Deactivating'} "${track.title}".`
      });
      const txHash = await runtimeWriter.setReleaseActive(runtimeAddress, track.hash, active);
      setTransactionFeedback({ tone: 'pending', title: 'Awaiting confirmation', message: 'Release status update submitted.', txHash });
      await runtimeWriter.waitForTransaction(txHash);
      await refreshCatalogFromRegistry(track.hash);
      setTransactionFeedback({
        tone: 'success',
        title: active ? 'Release reactivated' : 'Release deactivated',
        message: active ? `"${track.title}" is back in the public catalog.` : `"${track.title}" is hidden from playback and access grants.`,
        txHash
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Release status update failed';
      setTransactionFeedback({ tone: 'error', title: 'Release update failed', message });
    } finally {
      setReleaseActionId(null);
    }
  }

  async function claimRoyalties() {
    if (!connectedWallet) {
      setTransactionFeedback({
        tone: 'error',
        title: 'Wallet required',
        message: 'Connect the royalty recipient wallet before claiming pending royalties.'
      });
      return;
    }

    if (!artistRuntimeAddress) {
      setTransactionFeedback({
        tone: 'error',
        title: 'Artist runtime missing',
        message: 'Create or resolve your artist runtime before claiming royalties.'
      });
      return;
    }

    if (claimableRoyaltyWei <= 0n) {
      setTransactionFeedback({
        tone: 'success',
        title: 'No pending royalties',
        message: 'This wallet has no claimable royalty balance on the selected runtime.'
      });
      return;
    }

    setIsClaimingRoyalties(true);
    try {
      const runtimeWriter = getRuntimeWriter();
      setTransactionFeedback({
        tone: 'pending',
        title: 'Claiming royalties',
        message: 'Submitting the pending royalty claim from your SmartRuntime.'
      });
      const txHash = await runtimeWriter.claimRoyalty(artistRuntimeAddress, activeEvmAddress);
      setTransactionFeedback({
        tone: 'pending',
        title: 'Royalty claim submitted',
        message: 'Waiting for confirmation before refreshing the settlement ledger.',
        txHash
      });
      await runtimeWriter.waitForTransaction(txHash);
      const remainingClaimableWei = await runtimeReader.getRoyaltyClaimable(artistRuntimeAddress, activeEvmAddress).catch(() => null);
      await refreshArtistRoyalties();

      if (remainingClaimableWei === null) {
        setTransactionFeedback({
          tone: 'error',
          title: 'Royalty claim readback unavailable',
          message: 'The transaction was included, but Dotify could not confirm whether the pending balance cleared. Refresh the ledger before treating it as received.',
          txHash
        });
        return;
      }

      if (remainingClaimableWei > 0n) {
        setTransactionFeedback({
          tone: 'error',
          title: 'Royalty claim still pending',
          message: 'The transaction was included, but this recipient still could not receive the native-token transfer. The amount remains claimable.',
          txHash
        });
        return;
      }

      setTransactionFeedback({
        tone: 'success',
        title: 'Royalties claimed',
        message: 'The claim was confirmed and the pending royalty balance was cleared.',
        txHash
      });
    } catch (claimError) {
      const message = claimError instanceof Error ? claimError.message : 'Royalty claim failed';
      setTransactionFeedback({ tone: 'error', title: 'Royalty claim failed', message });
    } finally {
      setIsClaimingRoyalties(false);
    }
  }

  function updateArtistName(nextName: string, setArtistName: (name: string) => void) {
    setArtistName(nextName);
    if (connectedWallet) {
      storeArtistName(activeEvmAddress, nextName);
    }
  }

  return {
    // State
    artistRuntimeAddress,
    artistRegistrationStatus,
    isRegisteringArtist,
    isRefreshingArtistRuntime,
    rightsStatus,
    setRightsStatus,
    royaltyPayments,
    claimableRoyaltyWei,
    royaltyStatus,
    isRefreshingRoyalties,
    isClaimingRoyalties,
    expandedRoyaltyPaymentId,
    setExpandedRoyaltyPaymentId,
    bulletinManifestRef,
    setBulletinManifestRef,
    isRegistering,
    releaseActionId,
    artistRegistrationAvailable,
    artistRegistrationConfigured,
    artistPublicationQuarantined,
    artistPublicationQuarantineReason: artistPublicationSafety.reason,
    // Functions
    registerArtist,
    refreshArtistRuntime,
    registerRights,
    updateReleaseAccessMode,
    setReleaseActive,
    claimRoyalties,
    refreshArtistRoyalties,
    createRightsManifest,
    getActiveWalletClient,
    updateArtistName
  };
}
