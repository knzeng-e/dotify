import { useState } from 'react';
import { parseAbiItem } from 'viem';
import {
  ensureContract,
  getPublicClient,
  getWalletClient,
  resolveEvmChain,
  artistRuntimeFactoryAbi,
  artistDirectoryAbi,
  musicRegistryAbi
} from '../config/contracts';
import { checkBulletinAuthorization, encodeBulletinJson, uploadToBulletin } from './useBulletin';
import { uploadFileToPinata, uploadJsonToPinata, type DotifyTrackManifest } from '../services/pinata';
import { encryptTrackAudio, makeEncryptedAudioRef } from '../utils/protectedAudio';
import { describeArtistRegistrationError, formatBlockTimestampMs, formatWeiAsDot, shorten, dotToPlanck } from '../utils/format';
import type {
  AccessMode,
  CatalogTrack,
  PersonhoodLevel,
  RoyaltyPayment,
  TransactionFeedback
} from '../types';
import type { ConnectedWallet } from './useWallet';
import type { PolkadotSigner } from 'polkadot-api';

const zeroAddress = '0x0000000000000000000000000000000000000000' as const;
const blockscoutBaseUrl = 'https://blockscout-testnet.polkadot.io';
const musicRoyAccessPaidEvent = parseAbiItem('event MusicRoyAccessPaid(bytes32 indexed contentHash, address indexed listener, uint256 amount)');

function createBulletinManifestRef(hash: `0x${string}`) {
  return `paseo-bulletin:dotify-manifest:${hash}`;
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

export { getStoredArtistName, storeArtistName };

export type UseArtistConsoleDeps = {
  activeEvmAddress: `0x${string}`;
  connectedWallet: ConnectedWallet | null;
  ethRpcUrl: string;
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
  audioUploadRef: React.RefObject<Promise<string> | null>;
  coverUploadRef: React.RefObject<Promise<string> | null>;
};

export function useArtistConsole(deps: UseArtistConsoleDeps) {
  const {
    activeEvmAddress,
    connectedWallet,
    ethRpcUrl,
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

  const [artistRuntimeAddress, setArtistRuntimeAddress] = useState<`0x${string}` | null>(null);
  const [artistRegistrationStatus, setArtistRegistrationStatus] = useState('Checking artist registration');
  const [isRegisteringArtist, setIsRegisteringArtist] = useState(false);
  const [isRefreshingArtistRuntime, setIsRefreshingArtistRuntime] = useState(false);
  const [rightsStatus, setRightsStatus] = useState('No audio file selected');
  const [royaltyPayments, setRoyaltyPayments] = useState<RoyaltyPayment[]>([]);
  const [royaltyStatus, setRoyaltyStatus] = useState('No artist profile selected');
  const [isRefreshingRoyalties, setIsRefreshingRoyalties] = useState(false);
  const [expandedRoyaltyPaymentId, setExpandedRoyaltyPaymentId] = useState<string | null>(null);
  const [bulletinManifestRef, setBulletinManifestRef] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const artistRegistrationAvailable = Boolean(factoryAddress && directoryAddress);

  async function getActiveWalletClient(): Promise<Awaited<ReturnType<typeof getWalletClient>>> {
    if (!connectedWallet) {
      throw new Error('Connect a wallet before signing this transaction.');
    }
    const chain = await resolveEvmChain(ethRpcUrl);
    return connectedWallet.createEvmClient(chain, ethRpcUrl) as Awaited<ReturnType<typeof getWalletClient>>;
  }

  async function refreshArtistRuntime(showBusy = false) {
    if (!artistRegistrationAvailable) {
      setArtistRuntimeAddress(null);
      setArtistRegistrationStatus('Artist runtime contracts are not deployed yet.');
      return null;
    }

    if (showBusy) {
      setIsRefreshingArtistRuntime(true);
    }

    setArtistRegistrationStatus('Checking artist runtime');

    try {
      const directoryExists = await ensureContract(directoryAddress!, ethRpcUrl);
      if (!directoryExists) {
        setArtistRuntimeAddress(null);
        setArtistRegistrationStatus('Artist directory unavailable');
        return null;
      }

      const runtimeAddress = (await getPublicClient(ethRpcUrl).readContract({
        address: directoryAddress!,
        abi: artistDirectoryAbi,
        functionName: 'runtimeOf',
        args: [activeEvmAddress]
      })) as `0x${string}`;

      if (runtimeAddress === zeroAddress) {
        setArtistRuntimeAddress(null);
        setArtistRegistrationStatus('Artist not registered yet');
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
    if (!connectedWallet) {
      setTransactionFeedback({
        tone: 'error',
        title: 'Wallet required',
        message: 'Connect a wallet before creating an artist profile.'
      });
      setArtistRegistrationStatus('Connect your wallet to claim an artist profile.');
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
          message: 'This signer already owns a SmartRuntime and can manage releases.'
        });
        return;
      }

      const factoryExists = await ensureContract(factoryAddress!, ethRpcUrl);
      if (!factoryExists) {
        setTransactionFeedback({
          tone: 'error',
          title: 'Factory unavailable',
          message: 'ArtistRuntimeFactory not found at the configured address.'
        });
        return;
      }

      const walletClient = await getActiveWalletClient();
      const publicClient = getPublicClient(ethRpcUrl);

      setArtistRegistrationStatus('Creating artist runtime');
      const txHash = await walletClient.writeContract({
        address: factoryAddress!,
        abi: artistRuntimeFactoryAbi,
        functionName: 'createRuntime'
      });

      setTransactionFeedback({
        tone: 'pending',
        title: 'Registering artist',
        message: 'Creating the personal SmartRuntime for this artist signer.',
        txHash
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash });
      const runtimeAddress = await refreshArtistRuntime();

      if (!runtimeAddress) {
        throw new Error('Artist runtime was not indexed after confirmation');
      }

      setRightsStatus('Artist registered. Add audio and publish the first release.');
      setTransactionFeedback({
        tone: 'success',
        title: 'Artist registered',
        message: 'The artist signer now owns a personal SmartRuntime and can manage releases.',
        txHash
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
      setRoyaltyStatus('Create an artist profile to track payments');
      return;
    }

    if (showBusy) {
      setIsRefreshingRoyalties(true);
    }

    setRoyaltyStatus('Reading artist runtime payments');

    try {
      const client = getPublicClient(ethRpcUrl);
      const trackByHash = new Map(artistTracks.map(track => [track.hash.toLowerCase(), track]));
      const logs = await client.getLogs({
        address: artistRuntimeAddress,
        event: musicRoyAccessPaidEvent,
        fromBlock: 0n,
        toBlock: 'latest'
      });
      const blockTimestampsByNumber = new Map<string, bigint>();
      await Promise.all(
        Array.from(new Set(logs.map(log => log.blockNumber.toString()))).map(async blockNumber => {
          const block = await client.getBlock({ blockNumber: BigInt(blockNumber) });
          blockTimestampsByNumber.set(blockNumber, block.timestamp);
        })
      );

      const payments = logs
        .map(log => {
          const trackHash = log.args.contentHash;
          const listener = log.args.listener;
          const amountWei = log.args.amount;

          if (!trackHash || !listener || amountWei === undefined) {
            return null;
          }

          const track = trackByHash.get(trackHash.toLowerCase());

          return {
            id: `${log.transactionHash}-${log.logIndex}`,
            trackHash,
            trackTitle: track?.title ?? shorten(trackHash, 14),
            listener,
            amountWei,
            amountDot: formatWeiAsDot(amountWei),
            paidAtMs: formatBlockTimestampMs(blockTimestampsByNumber.get(log.blockNumber.toString())),
            transactionHash: log.transactionHash,
            blockNumber: log.blockNumber,
            logIndex: log.logIndex
          } satisfies RoyaltyPayment;
        })
        .filter((payment): payment is RoyaltyPayment => Boolean(payment))
        .sort((left, right) => {
          if (left.blockNumber !== right.blockNumber) {
            return left.blockNumber > right.blockNumber ? -1 : 1;
          }
          return right.logIndex - left.logIndex;
        });

      setRoyaltyPayments(payments);
      setRoyaltyStatus(payments.length > 0 ? 'Payments indexed from your runtime' : 'No access payments received yet');
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
    resolvedCoverCID: string
  ): DotifyTrackManifest {
    return {
      schema: 'dotify.track.v1',
      createdAt: new Date().toISOString(),
      assets: {
        audioCID: resolvedAudioCID,
        coverCID: resolvedCoverCID,
        encrypted: true
      },
      track: {
        contentHash,
        title: title.trim() || 'Untitled',
        artistName: artistName.trim() || 'Unknown artist',
        description: description.trim(),
        accessMode,
        priceDot: accessMode === 'classic' ? priceDot : '0',
        requiredPersonhood: accessMode === 'human-free' ? personhoodLevel : 'None',
        zone: 'Studio'
      },
      royalties: royaltyRecipients.map((recipient, index) => ({
        recipient,
        bps: royaltyShares[index] ?? 0
      })),
      settlement: {
        target: 'evm',
        royaltyBps,
        pricePlanck: dotToPlanck(accessMode === 'classic' ? priceDot : '0').toString()
      }
    };
  }

  async function registerRights() {
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
      const [resolvedAudioCID, resolvedCoverCID] = await Promise.all([
        audioUploadRef.current ??
          (audioSource
            ? fetch(audioSource)
                .then(r => r.arrayBuffer())
                .then(async buf => {
                  const bytes = new Uint8Array(buf);
                  const enc = await encryptTrackAudio(bytes, fileHash);
                  const encFile = new File([enc], `${title || 'audio'}.enc`, { type: 'application/octet-stream' });
                  return uploadFileToPinata(encFile, encFile.name, { app: 'dotify', type: 'audio', encrypted: 'true' });
                })
            : Promise.resolve('')),
        coverUploadRef.current ?? (coverFile ? uploadFileToPinata(coverFile, coverFile.name, { app: 'dotify', type: 'cover' }) : Promise.resolve(''))
      ]);

      if (resolvedAudioCID) setAudioCID(resolvedAudioCID);
      if (resolvedCoverCID) setCoverCID(resolvedCoverCID);

      const royaltyRecipients = [activeEvmAddress];
      const royaltyShares = [royaltyBps];
      const manifest = createRightsManifest(fileHash, royaltyRecipients, royaltyShares, resolvedAudioCID, resolvedCoverCID);

      setRightsStatus('Publishing manifest to IPFS…');
      setTransactionFeedback({
        tone: 'pending',
        title: 'Uploading to IPFS',
        message: 'Pinning the track manifest to IPFS via Pinata.'
      });
      const metadataCID = await uploadJsonToPinata(manifest, `${manifest.track.title}.json`, { app: 'dotify', type: 'track-metadata' });
      const ipfsMetadataRef = `ipfs://${metadataCID}`;

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
      const factoryExists = await ensureContract(factoryAddress, ethRpcUrl);
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

      const walletClient = await getActiveWalletClient();
      const ipfsAudioRef = resolvedAudioCID ? makeEncryptedAudioRef(resolvedAudioCID) : `dotify:local:${fileHash}`;
      const ipfsCoverRef = resolvedCoverCID ? `ipfs://${resolvedCoverCID}` : `dotify:cover:${fileHash}`;

      setRightsStatus('Submitting rights transaction');
      setTransactionFeedback({
        tone: 'pending',
        title: 'Registering track',
        message: 'Sending the registration to your SmartRuntime.'
      });

      const txHash = await walletClient.writeContract({
        address: runtimeAddress,
        abi: musicRegistryAbi,
        functionName: 'musicRegRegister',
        args: [
          {
            contentHash: fileHash,
            title,
            artistName,
            description,
            imageRef: ipfsCoverRef,
            audioRef: ipfsAudioRef,
            metadataRef: ipfsMetadataRef,
            artistContractRef: `dotify:self-certified:${fileHash}`,
            accessMode: accessMode === 'human-free' ? 0 : 1,
            pricePlanck: dotToPlanck(accessMode === 'classic' ? priceDot : '0'),
            requiredPersonhood: accessMode === 'human-free' ? (personhoodLevel === 'DIM2' ? 2 : 1) : 0
          },
          royaltyRecipients,
          royaltyShares
        ]
      });

      setRightsStatus('Waiting for transaction confirmation');
      setTransactionFeedback({
        tone: 'pending',
        title: 'Waiting for confirmation',
        message: 'Transaction submitted. Waiting for the final receipt on the EVM network.',
        txHash
      });
      await getPublicClient(ethRpcUrl).waitForTransactionReceipt({ hash: txHash });
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
    royaltyStatus,
    isRefreshingRoyalties,
    expandedRoyaltyPaymentId,
    setExpandedRoyaltyPaymentId,
    bulletinManifestRef,
    setBulletinManifestRef,
    isRegistering,
    artistRegistrationAvailable,
    // Functions
    registerArtist,
    refreshArtistRuntime,
    registerRights,
    refreshArtistRoyalties,
    createRightsManifest,
    getActiveWalletClient,
    updateArtistName,
    blockscoutBaseUrl
  };
}
