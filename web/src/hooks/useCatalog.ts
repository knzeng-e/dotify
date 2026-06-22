import { useRef, useState } from 'react';
import { getGatewayUrl } from '../services/pinata';
import { ensureContract, getPublicClient, artistDirectoryAbi, musicRegistryAbi, musicAccessAbi, musicRoyaltiesAbi } from '../config/contracts';
import { encodeAudioBufferPreviewAsWav } from '../utils/audio';
import { decryptAudio, hexToBytes } from '../utils/crypto';
import { formatWeiAsDot } from '../utils/format';
import { fetchIpfsCid } from '../services/pinata';
import { isKeyServiceConfigured, requestContentKey, type KeyRequestPurpose } from '../services/keyService';
import { decryptTrackAudio, isEncryptedAudioRef, encryptedRefToCID } from '../utils/protectedAudio';
import type {
  AccessGate,
  AccessMode,
  CatalogTrack,
  OnchainTrackRecord,
  PersonhoodLevel,
  PlayerState,
  RegistryCatalogTrack,
  RoomPlaybackMode,
  RoyaltySplit,
  TrackInfo,
  TransactionFeedback
} from '../types';
import type { ConnectedWallet } from './useWallet';

type AudioContextWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

const PREVIEW_RATIO = 0.42;
const zeroAddress = '0x0000000000000000000000000000000000000000' as const;

function coverImage(primary: string, secondary: string, label: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640"><rect width="640" height="640" fill="${primary}"/><circle cx="490" cy="120" r="210" fill="${secondary}" opacity=".72"/><circle cx="160" cy="520" r="190" fill="#c8ff4d" opacity=".78"/><text x="48" y="108" fill="#fff" font-family="Manrope,Arial,sans-serif" font-size="42" font-weight="800">${label}</text><path d="M230 242c0-25 20-45 45-45h98v62h-70v132c0 34-28 62-62 62s-62-28-62-62 28-62 62-62c13 0 25 4 35 11v-98h-46Z" fill="#fff" opacity=".92"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function resolveVisualAssetRef(assetRef: string, title: string) {
  if (!assetRef) {
    return coverImage('#06152d', '#2bb3ff', title);
  }
  if (assetRef.startsWith('ipfs://')) {
    return getGatewayUrl(assetRef.slice('ipfs://'.length));
  }
  if (assetRef.startsWith('http://') || assetRef.startsWith('https://') || assetRef.startsWith('data:') || assetRef.startsWith('blob:')) {
    return assetRef;
  }
  return coverImage('#06152d', '#2bb3ff', title);
}

function resolveAudioAssetRef(assetRef: string) {
  if (!assetRef) return undefined;
  if (isEncryptedAudioRef(assetRef)) {
    return getGatewayUrl(encryptedRefToCID(assetRef));
  }
  if (assetRef.startsWith('ipfs://')) {
    return getGatewayUrl(assetRef.slice('ipfs://'.length));
  }
  if (assetRef.startsWith('http://') || assetRef.startsWith('https://') || assetRef.startsWith('blob:') || assetRef.startsWith('data:')) {
    return assetRef;
  }
  return undefined;
}

function createTrackInfo(
  title: string,
  artist: string,
  hash: `0x${string}` | '',
  bulletinRef: string,
  duration = 0,
  metadata: Partial<TrackInfo> = {}
): TrackInfo {
  return {
    title: title.trim() || 'Untitled',
    artist: artist.trim() || 'Unknown artist',
    hash,
    bulletinRef,
    duration,
    updatedAt: Date.now(),
    ...metadata
  };
}

function createTrackInfoFromCatalog(track: CatalogTrack): TrackInfo {
  return createTrackInfo(track.title, track.artist, track.hash, track.bulletinRef, track.duration ?? 0, {
    imageRef: track.imageRef,
    audioRef: track.audioRef,
    metadataRef: track.metadataRef,
    description: track.description,
    accessMode: track.accessMode,
    priceDot: track.priceDot,
    personhoodLevel: track.personhoodLevel
  });
}

export type UseCatalogDeps = {
  ethRpcUrl: string;
  listenerEvmAddress: `0x${string}` | null;
  connectedWallet: ConnectedWallet | null;
  directoryAddress: `0x${string}` | undefined;
  setShowWalletModal: (show: boolean) => void;
  setTransactionFeedback: (feedback: TransactionFeedback | null) => void;
  navigateToView: (view: 'listen' | 'player' | 'rooms') => void;
  getActiveWalletClient: () => Promise<Awaited<ReturnType<typeof import('../config/contracts').getWalletClient>>>;
  setBulletinManifestRef: (ref: string) => void;
  setAccessMode: (mode: AccessMode) => void;
  setPriceDot: (price: string) => void;
  setPersonhoodLevel: (level: PersonhoodLevel) => void;
  setArtistName: (name: string) => void;
  setDescription: (desc: string) => void;
  setTitle: (title: string) => void;
};

export function useCatalog(deps: UseCatalogDeps) {
  const {
    ethRpcUrl,
    listenerEvmAddress,
    connectedWallet,
    directoryAddress,
    setShowWalletModal,
    setTransactionFeedback,
    setTitle,
    navigateToView,
    getActiveWalletClient,
    setBulletinManifestRef,
    setAccessMode,
    setPriceDot,
    setPersonhoodLevel,
    setArtistName,
    setDescription
  } = deps;

  const [catalogTracks, setCatalogTracks] = useState<CatalogTrack[]>([]);
  const [catalogStatus, setCatalogStatus] = useState('Loading registry catalog');
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [catalogAccessByTrackId, setCatalogAccessByTrackId] = useState<Record<string, boolean>>({});
  const [catalogPaidAccessByTrackId, setCatalogPaidAccessByTrackId] = useState<Record<string, boolean>>({});
  const [audioSource, setAudioSource] = useState<string | null>(null);
  const [trackInfo, setTrackInfo] = useState<TrackInfo | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [accessGate, setAccessGate] = useState<AccessGate | null>(null);
  const [fileHash, setFileHashState] = useState<`0x${string}` | ''>('');
  const [audioCID, setAudioCID] = useState('');
  const [coverCID, setCoverCID] = useState('');
  const [coverSource, setCoverSource] = useState(() => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640"><rect width="640" height="640" fill="#06152d"/><circle cx="490" cy="120" r="210" fill="#2bb3ff" opacity=".72"/><circle cx="160" cy="520" r="190" fill="#c8ff4d" opacity=".78"/><text x="48" y="108" fill="#fff" font-family="Manrope,Arial,sans-serif" font-size="42" font-weight="800">Dotify</text><path d="M230 242c0-25 20-45 45-45h98v62h-70v132c0 34-28 62-62 62s-62-28-62-62 28-62 62-62c13 0 25 4 35 11v-98h-46Z" fill="#fff" opacity=".92"/></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  });

  const objectUrlsRef = useRef<Set<string>>(new Set());
  const resolvedAudioSourcesRef = useRef<Map<string, string>>(new Map());
  const audioUploadRef = useRef<Promise<string> | null>(null);
  const coverUploadRef = useRef<Promise<string> | null>(null);
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewOnlyRef = useRef(false);
  const previewLimitRef = useRef<number | null>(null);
  // Session cache of backend-delivered content keys: one wallet signature per
  // track per session, instead of one per playback (signature-fatigue rule).
  const contentKeysRef = useRef<Map<string, Uint8Array>>(new Map());
  // 'room_host' when the selected track streams into a room; room listeners
  // never request keys at all (they only receive the WebRTC stream).
  const keyRequestPurposeRef = useRef<KeyRequestPurpose>('individual');

  function internalSetFileHash(hash: `0x${string}` | '') {
    setFileHashState(hash);
  }

  async function checkTrackAccess(track: CatalogTrack, listenerAddress: `0x${string}` | null): Promise<boolean> {
    if (track.source !== 'artist' || !track.id.includes(':')) return true;
    if (!listenerAddress) return false;
    const runtimeAddress = track.id.split(':')[0] as `0x${string}`;
    try {
      return (await getPublicClient(ethRpcUrl).readContract({
        address: runtimeAddress,
        abi: musicAccessAbi,
        functionName: 'musicAccCanAccess',
        args: [track.hash, listenerAddress]
      })) as boolean;
    } catch {
      return false;
    }
  }

  async function checkTrackPaidAccess(track: CatalogTrack, listenerAddress: `0x${string}` | null): Promise<boolean> {
    if (track.source !== 'artist' || !track.id.includes(':') || track.accessMode !== 'classic') return false;
    if (!listenerAddress) return false;
    const runtimeAddress = track.id.split(':')[0] as `0x${string}`;
    try {
      return (await getPublicClient(ethRpcUrl).readContract({
        address: runtimeAddress,
        abi: musicAccessAbi,
        functionName: 'musicAccHasPaid',
        args: [track.hash, listenerAddress]
      })) as boolean;
    } catch {
      return false;
    }
  }

  function buildAccessGateInfo(track: CatalogTrack): AccessGate {
    if (!connectedWallet) {
      if (track.accessMode === 'classic') {
        return {
          track,
          title: 'Unlock full song',
          message: `"${track.title}" is available as a preview. Unlock the full track for ${track.priceDot} DOT and support the artist directly.`,
          hint: 'No platform account needed. Confirm once from your wallet.',
          actionType: 'signin'
        };
      }
      return {
        track,
        title: 'Listener pass needed',
        message: `"${track.title}" is protected by the artist. Preview 42% now, or connect your pass to listen in full.`,
        hint: 'Dotify only checks whether the door should open.',
        actionType: 'signin'
      };
    }

    if (track.accessMode === 'human-free') {
      return {
        track,
        title: 'Listener pass needed',
        message: `"${track.title}" needs the right listener pass. You can preview 42% now.`,
        hint: 'No profile is created for this check.',
        actionType: 'personhood'
      };
    }
    return {
      track,
      title: 'Unlock full song',
      message: `"${track.title}" unlocks after a ${track.priceDot} DOT payment. You can preview 42% now.`,
      hint: 'Your support goes directly to the artist.',
      actionType: 'payment'
    };
  }

  function setupPreviewLimit() {
    const audio = localAudioRef.current;
    if (!audio || !previewOnlyRef.current || !Number.isFinite(audio.duration)) return;
    previewLimitRef.current = audio.duration * PREVIEW_RATIO;
  }

  function enforcePreviewCutoff(
    catalogTracksSnapshot: CatalogTrack[],
    selectedTrackIdSnapshot: string,
    options: { onPreviewEnded?: (endedTrack: CatalogTrack, nextTrack: CatalogTrack | null) => void } = {}
  ) {
    const audio = localAudioRef.current;
    const limit = previewLimitRef.current;
    if (!audio || limit === null || audio.paused) return;
    if (audio.currentTime >= limit) {
      audio.pause();
      const trackIndex = catalogTracksSnapshot.findIndex(t => t.id === selectedTrackIdSnapshot);
      const track = trackIndex >= 0 ? catalogTracksSnapshot[trackIndex] : null;
      if (!track) return;
      setAccessGate(buildAccessGateInfo(track));
      if (options.onPreviewEnded) {
        // Room doctrine: an unauthorized host streams the 42% preview, sees a
        // discreet unlock CTA, and the playlist auto-advances. The caller
        // decides whether a room is live and what "next" means.
        const nextTrack = catalogTracksSnapshot.length > 1 ? catalogTracksSnapshot[(trackIndex + 1) % catalogTracksSnapshot.length] : null;
        options.onPreviewEnded(track, nextTrack);
      }
    }
  }

  async function createPreviewAudioObjectUrl(audioBytes: Uint8Array, cacheKey: string): Promise<string> {
    const AudioContextCtor = window.AudioContext ?? (window as AudioContextWindow).webkitAudioContext;
    if (!AudioContextCtor) throw new Error('Audio previews are not supported in this browser.');

    const audioContext = new AudioContextCtor();
    try {
      const audioData = audioBytes.buffer.slice(audioBytes.byteOffset, audioBytes.byteOffset + audioBytes.byteLength);
      const audioBuffer = await audioContext.decodeAudioData(audioData);
      const previewFrameCount = Math.max(1, Math.floor(audioBuffer.length * PREVIEW_RATIO));
      const previewBytes = encodeAudioBufferPreviewAsWav(audioBuffer, previewFrameCount);
      const objectUrl = URL.createObjectURL(new Blob([previewBytes], { type: 'audio/wav' }));
      objectUrlsRef.current.add(objectUrl);
      resolvedAudioSourcesRef.current.set(cacheKey, objectUrl);
      return objectUrl;
    } finally {
      await audioContext.close();
    }
  }

  async function resolvePlayableAudioSource(source: string, cacheKey: string, options: { previewOnly: boolean }): Promise<string> {
    if (!options.previewOnly) return source;

    const previewCacheKey = `${cacheKey}:preview`;
    const cached = resolvedAudioSourcesRef.current.get(previewCacheKey);
    if (cached) return cached;

    const response = await fetch(source);
    if (!response.ok) throw new Error(`Unable to fetch preview audio (${response.status})`);

    const sourceBytes = new Uint8Array(await response.arrayBuffer());
    return createPreviewAudioObjectUrl(sourceBytes, previewCacheKey);
  }

  /**
   * Obtain the per-track content key from the backend key service.
   * Returns null when the service is not configured, no wallet is connected,
   * or the backend denies access; callers then fall back to the demo-mode
   * bundle-derived key (which only decrypts demo-published tracks).
   */
  async function resolveServerContentKey(contentHash: `0x${string}`): Promise<Uint8Array | null> {
    const cacheKey = contentHash.toLowerCase();
    const cached = contentKeysRef.current.get(cacheKey);
    if (cached) return cached;
    if (!isKeyServiceConfigured() || !connectedWallet) return null;

    try {
      const walletClient = await getActiveWalletClient();
      const chainId = walletClient.chain?.id ?? (await getPublicClient(ethRpcUrl).getChainId());
      const response = await requestContentKey({
        contentHash,
        purpose: keyRequestPurposeRef.current,
        walletClient,
        chainId
      });
      if (response.access !== 'allowed') return null;
      const keyBytes = hexToBytes(response.contentKey);
      contentKeysRef.current.set(cacheKey, keyBytes);
      return keyBytes;
    } catch {
      // Fail closed: no key. Playback falls back to demo derivation or the
      // access gate; it never invents access.
      return null;
    }
  }

  async function fetchAndDecryptAudio(audioRef: string, gatewayUrl: string, contentHash: `0x${string}`, options: { previewOnly: boolean }): Promise<string> {
    const cacheKey = options.previewOnly ? `${audioRef}:preview` : audioRef;
    const cached = resolvedAudioSourcesRef.current.get(cacheKey);
    if (cached) return cached;

    const response = isEncryptedAudioRef(audioRef) ? await fetchIpfsCid(encryptedRefToCID(audioRef)) : await fetch(gatewayUrl);
    if (!response.ok) throw new Error(`Unable to fetch encrypted audio (${response.status})`);

    const encryptedBytes = new Uint8Array(await response.arrayBuffer());
    // Preview-only playback skips the key request: the backend would deny it
    // anyway, and we avoid a pointless wallet signature prompt.
    const serverKey = options.previewOnly ? null : await resolveServerContentKey(contentHash);
    const clearBytes = serverKey ? await decryptAudio(encryptedBytes, serverKey) : await decryptTrackAudio(encryptedBytes, contentHash);
    if (options.previewOnly) {
      return createPreviewAudioObjectUrl(clearBytes, cacheKey);
    }

    const blob = new Blob([clearBytes]);
    const objectUrl = URL.createObjectURL(blob);
    objectUrlsRef.current.add(objectUrl);
    resolvedAudioSourcesRef.current.set(cacheKey, objectUrl);
    return objectUrl;
  }

  async function selectTrack(
    track: CatalogTrack,
    socketEmit?: (event: string, data: unknown) => void,
    setLocalStreamReady?: (ready: boolean) => void,
    closeHostPeers?: () => void
  ): Promise<RoomPlaybackMode> {
    setSelectedTrackId(track.id);
    setTitle(track.title);
    setArtistName(track.artist);
    setDescription(track.description);
    setCoverSource(track.imageRef);
    setBulletinManifestRef(track.metadataRef);
    internalSetFileHash(track.hash);
    setAccessMode(track.accessMode);
    setPriceDot(track.priceDot);
    setPersonhoodLevel(track.personhoodLevel);
    setTrackInfo(createTrackInfoFromCatalog(track));
    setPlayerState(null);
    setAccessGate(null);
    previewOnlyRef.current = false;
    previewLimitRef.current = null;
    // A socketEmit callback means this selection streams into a room: the
    // signer is the host, and only the host needs to satisfy the policy.
    keyRequestPurposeRef.current = socketEmit ? 'room_host' : 'individual';

    let audioUrl: string | null = null;
    let playbackMode: RoomPlaybackMode = 'full';

    if (track.source === 'artist' && track.id.includes(':')) {
      const hasAccess = await checkTrackAccess(track, listenerEvmAddress);
      setCatalogAccessByTrackId(previous => ({ ...previous, [track.id]: hasAccess }));
      const previewOnly = !hasAccess;
      previewOnlyRef.current = previewOnly;
      playbackMode = previewOnly ? 'preview' : 'full';

      if (previewOnly) {
        setAccessGate(buildAccessGateInfo(track));
      }
    }

    if (track.localUrl) {
      audioUrl = track.encrypted
        ? await fetchAndDecryptAudio(track.audioRef, track.localUrl, track.hash, { previewOnly: playbackMode === 'preview' }).catch(() => null)
        : await resolvePlayableAudioSource(track.localUrl, track.audioRef, { previewOnly: playbackMode === 'preview' }).catch(() => null);

      if (playbackMode === 'full' && !audioUrl && track.encrypted) {
        // Access is granted but the key or decryption failed. Say so plainly
        // instead of leaving a silent dead player.
        setTransactionFeedback({
          tone: 'error',
          title: 'Protected playback unavailable',
          message: 'Your access checks out, but the content key could not be obtained or used. The key service may be unreachable; try again shortly.'
        });
      }
    }

    setAudioSource(audioUrl);

    if (!audioUrl) {
      if (setLocalStreamReady) setLocalStreamReady(false);
      if (closeHostPeers) closeHostPeers();
    }

    if (socketEmit) {
      socketEmit('room:track', createTrackInfoFromCatalog(track));
      // Host-based room access: declare honestly whether the room hears the
      // full track or the 42% preview fallback.
      socketEmit('room:playback-mode', { playbackMode });
    }

    return playbackMode;
  }

  async function openTrack(
    track: CatalogTrack,
    socketEmit?: (event: string, data: unknown) => void,
    setLocalStreamReady?: (ready: boolean) => void,
    closeHostPeers?: () => void
  ) {
    navigateToView('player');
    return selectTrack(track, socketEmit, setLocalStreamReady, closeHostPeers);
  }

  async function payForTrackAccess(track: CatalogTrack) {
    if (!connectedWallet) {
      setAccessGate(buildAccessGateInfo(track));
      setShowWalletModal(true);
      return;
    }

    const { musicRoyaltiesAbi, getPublicClient: getClient } = await import('../config/contracts');
    const { dotToPlanck } = await import('../utils/format');

    const runtimeAddress = track.id.split(':')[0] as `0x${string}`;
    const priceWei = dotToPlanck(track.priceDot);

    setAccessGate(null);
    setTransactionFeedback({
      tone: 'pending',
      title: 'Processing payment',
      message: `Paying ${track.priceDot} DOT to unlock "${track.title}".`
    });

    try {
      const walletClient = await getActiveWalletClient();
      const txHash = await walletClient.writeContract({
        address: runtimeAddress,
        abi: musicRoyaltiesAbi,
        functionName: 'musicRoyPayAccess',
        args: [track.hash],
        value: priceWei
      });
      setTransactionFeedback({ tone: 'pending', title: 'Awaiting confirmation', message: 'Payment submitted.', txHash });
      await getClient(ethRpcUrl).waitForTransactionReceipt({ hash: txHash });

      previewOnlyRef.current = false;
      previewLimitRef.current = null;
      setCatalogAccessByTrackId(previous => ({ ...previous, [track.id]: true }));
      setCatalogPaidAccessByTrackId(previous => ({ ...previous, [track.id]: true }));
      setTransactionFeedback({ tone: 'success', title: 'Access unlocked', message: `Full playback of "${track.title}" is now available.`, txHash });
      await selectTrack(track, undefined, undefined, undefined);
    } catch (payError) {
      const message = payError instanceof Error ? payError.message : 'Payment failed';
      setTransactionFeedback({ tone: 'error', title: 'Payment failed', message });
    }
  }

  async function fetchDirectoryEntries(client: ReturnType<typeof getPublicClient>, registryAddress: `0x${string}`, artistCount: bigint) {
    const pageSize = 50n;
    const entries: Array<{ artist: `0x${string}`; runtime: `0x${string}` }> = [];

    for (let offset = 0n; offset < artistCount; offset += pageSize) {
      const limit = artistCount - offset > pageSize ? pageSize : artistCount - offset;
      const [artists, runtimes] = (await client.readContract({
        address: registryAddress,
        abi: artistDirectoryAbi,
        functionName: 'artistsPage',
        args: [offset, limit]
      })) as [`0x${string}`[], `0x${string}`[]];

      for (let index = 0; index < artists.length; index += 1) {
        const artist = artists[index];
        const runtime = runtimes[index];
        if (!artist || !runtime || runtime === zeroAddress) continue;
        entries.push({ artist, runtime });
      }
    }

    return entries;
  }

  async function fetchRuntimeCatalog(
    client: ReturnType<typeof getPublicClient>,
    artistAddress: `0x${string}`,
    runtimeAddress: `0x${string}`
  ): Promise<RegistryCatalogTrack[]> {
    const trackCount = (await client.readContract({
      address: runtimeAddress,
      abi: musicRegistryAbi,
      functionName: 'musicRegTrackCount'
    })) as bigint;

    const tracks: Array<RegistryCatalogTrack | null> = await Promise.all(
      Array.from({ length: Number(trackCount) }, async (_, index) => {
        const hash = (await client.readContract({
          address: runtimeAddress,
          abi: musicRegistryAbi,
          functionName: 'musicRegTrackHashAtIndex',
          args: [BigInt(index)]
        })) as `0x${string}`;

        const [track] = (await client.readContract({
          address: runtimeAddress,
          abi: musicRegistryAbi,
          functionName: 'musicRegGetTrack',
          args: [hash]
        })) as [OnchainTrackRecord, `0x${string}`];

        if (!track.active) {
          return null;
        }

        const imageRef = resolveVisualAssetRef(track.imageRef, track.title);
        const encrypted = isEncryptedAudioRef(track.audioRef);
        const localUrl = resolveAudioAssetRef(track.audioRef);
        const splitCount = (await client
          .readContract({
            address: runtimeAddress,
            abi: musicRoyaltiesAbi,
            functionName: 'musicRoySplitCount',
            args: [hash]
          })
          .catch(() => 0n)) as bigint;
        const royaltySplits = await Promise.all(
          Array.from({ length: Number(splitCount) }, async (_, splitIndex): Promise<RoyaltySplit | null> => {
            try {
              const [recipient, bps] = (await client.readContract({
                address: runtimeAddress,
                abi: musicRoyaltiesAbi,
                functionName: 'musicRoySplitAt',
                args: [hash, BigInt(splitIndex)]
              })) as [`0x${string}`, number];
              return {
                label: splitIndex === 0 ? 'Primary recipient' : `Split ${splitIndex + 1}`,
                recipient,
                bps: Number(bps)
              };
            } catch {
              return null;
            }
          })
        );

        return {
          id: `${runtimeAddress}:${hash}`,
          hash,
          title: track.title,
          artist: track.artistName,
          artistAddress: track.artist || artistAddress,
          audioRef: track.audioRef,
          imageRef,
          priceDot: formatWeiAsDot(track.pricePlanck),
          localUrl,
          description: track.description,
          bulletinRef: track.metadataRef.startsWith('paseo-bulletin:') ? track.metadataRef : '',
          metadataRef: track.metadataRef,
          royaltyBps: Number(track.royaltyBps),
          txHash: undefined,
          durationLabel: 'ready',
          accessMode: (track.accessMode === 1 ? 'classic' : 'human-free') as AccessMode,
          source: 'artist' as const,
          royaltySplits: royaltySplits.filter((split): split is RoyaltySplit => Boolean(split)),
          personhoodLevel: track.requiredPersonhood === 2 ? 'DIM2' : 'DIM1',
          zone: 'Registry',
          encrypted,
          registeredAtBlock: Number(track.registeredAtBlock)
        };
      })
    );

    return tracks.flatMap(track => (track ? [track] : []));
  }

  async function refreshCatalogFromRegistry(preferredTrackHash?: `0x${string}`) {
    if (!directoryAddress) {
      setCatalogTracks([]);
      setSelectedTrackId('');
      setCatalogStatus('Registry directory not configured');
      return [];
    }

    setCatalogStatus('Loading registry catalog');

    try {
      const directoryExists = await ensureContract(directoryAddress, ethRpcUrl);
      if (!directoryExists) {
        setCatalogTracks([]);
        setSelectedTrackId('');
        setCatalogStatus('Registry directory unavailable');
        return [];
      }

      const client = getPublicClient(ethRpcUrl);
      const artistCount = (await client.readContract({
        address: directoryAddress,
        abi: artistDirectoryAbi,
        functionName: 'artistCount'
      })) as bigint;

      if (artistCount === 0n) {
        setCatalogTracks([]);
        setSelectedTrackId('');
        setCatalogStatus('No tracks registered on this directory yet');
        return [];
      }

      const entries = await fetchDirectoryEntries(client, directoryAddress, artistCount);
      const runtimeCatalogs = await Promise.all(
        entries.map(async entry => {
          try {
            return await fetchRuntimeCatalog(client, entry.artist, entry.runtime);
          } catch (runtimeError) {
            console.warn(`Failed to load runtime catalog for ${entry.runtime}`, runtimeError);
            return [];
          }
        })
      );
      const nextCatalog = runtimeCatalogs
        .flat()
        .sort((left, right) => {
          if (left.registeredAtBlock !== right.registeredAtBlock) {
            return right.registeredAtBlock - left.registeredAtBlock;
          }
          return left.title.localeCompare(right.title);
        })
        .map(({ registeredAtBlock: _registeredAtBlock, ...track }): CatalogTrack => track);

      setCatalogTracks(nextCatalog);
      setSelectedTrackId(previous => {
        const preferredTrack = preferredTrackHash ? nextCatalog.find(track => track.hash.toLowerCase() === preferredTrackHash.toLowerCase()) : null;
        if (preferredTrack) return preferredTrack.id;
        return nextCatalog.some(track => track.id === previous) ? previous : (nextCatalog[0]?.id ?? '');
      });
      setCatalogStatus(
        nextCatalog.length > 0
          ? `Loaded ${nextCatalog.length} registered track${nextCatalog.length > 1 ? 's' : ''}`
          : 'No tracks registered on this directory yet'
      );
      return nextCatalog;
    } catch (catalogError) {
      const message = catalogError instanceof Error ? catalogError.message : 'Unable to load registry catalog';
      console.warn('Failed to load registry catalog', catalogError);
      setCatalogTracks([]);
      setSelectedTrackId('');
      setCatalogStatus(message);
      return [];
    }
  }

  function clearObjectUrls() {
    for (const url of objectUrlsRef.current.values()) {
      URL.revokeObjectURL(url);
    }
    resolvedAudioSourcesRef.current.clear();
  }

  return {
    // State
    catalogTracks,
    catalogStatus,
    selectedTrackId,
    setSelectedTrackId,
    catalogAccessByTrackId,
    setCatalogAccessByTrackId,
    catalogPaidAccessByTrackId,
    setCatalogPaidAccessByTrackId,
    audioSource,
    setAudioSource,
    trackInfo,
    setTrackInfo,
    coverSource,
    setCoverSource,
    playerState,
    setPlayerState,
    accessGate,
    setAccessGate,
    fileHash,
    setFileHash: internalSetFileHash,
    audioCID,
    setAudioCID,
    coverCID,
    setCoverCID,
    // Refs
    objectUrlsRef,
    resolvedAudioSourcesRef,
    audioUploadRef,
    coverUploadRef,
    localAudioRef,
    previewOnlyRef,
    previewLimitRef,
    // Functions
    selectTrack,
    openTrack,
    checkTrackAccess,
    checkTrackPaidAccess,
    buildAccessGateInfo,
    setupPreviewLimit,
    enforcePreviewCutoff,
    payForTrackAccess,
    fetchAndDecryptAudio,
    resolvePlayableAudioSource,
    createPreviewAudioObjectUrl,
    refreshCatalogFromRegistry,
    fetchDirectoryEntries,
    fetchRuntimeCatalog,
    clearObjectUrls
  };
}
