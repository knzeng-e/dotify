import { useRef, useState } from 'react';
import { getGatewayUrl } from '../services/pinata';
import { ensureContract, getPublicClient, artistDirectoryAbi, musicRegistryAbi, musicAccessAbi, musicRoyaltiesAbi } from '../shared/config/contracts';
import { decryptAudio, hexToBytes } from '../shared/utils/crypto';
import { formatWeiAsDot } from '../shared/utils/format';
import { fetchIpfsCid } from '../services/pinata';
import { isKeyServiceConfigured, requestContentKey, requestFreeContentKey, type KeyRequestPurpose } from '../services/keyService';
import { auraForTrack } from '../shared/utils/aura';
import { decryptTrackAudio, isEncryptedAudioRef, encryptedRefToCID } from '../shared/utils/protectedAudio';
import { isPolicyManagedTrack } from '../features/access/accessPolicy';
import { catalogLoadFailureStatus } from '../features/catalog/catalogStatus';
import { runtimeAddressFromTrackId } from '../features/catalog/trackModel';
import { decodeAccessMode, decodePersonhood } from '../features/runtime/accessEncoding';
import {
  E2E_CLASSIC_AUDIO_URL,
  E2E_CLASSIC_HASH,
  E2E_CLASSIC_TRACK,
  E2E_CLASSIC_TX_HASH,
  getClassicUnlockE2eState,
  isClassicUnlockE2e,
  recordClassicUnlockFullKeyRequest
} from '../e2e/classicUnlockMock';
import { getArtistPublishE2eTracks, isArtistPublishE2e, isArtistPublishE2eTrack } from '../e2e/artistPublishMock';
import {
  E2E_ROOM_AUDIO_URL,
  getRoomJoinE2eTracks,
  isRoomJoinE2e,
  isRoomJoinE2eContext,
  isRoomJoinE2eProtectedHash,
  isRoomJoinE2eTrack,
  recordRoomJoinE2eKeyRequest,
  roomJoinE2eHostHasAccess
} from '../e2e/roomJoinMock';
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
} from '../shared/types';
import type { ConnectedWallet } from './useWallet';

const zeroAddress = '0x0000000000000000000000000000000000000000' as const;

function escapeSvgText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function coverImage(label: string, seed = label) {
  const aura = auraForTrack({ id: seed, title: label });
  const safeLabel = escapeSvgText(label || 'Dotify');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640"><defs><radialGradient id="a" cx="26%" cy="18%" r="78%"><stop offset="0" stop-color="${aura.a}"/><stop offset=".58" stop-color="#071326"/><stop offset="1" stop-color="#050D1A"/></radialGradient><filter id="g"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter></defs><rect width="640" height="640" fill="url(#a)"/><circle cx="492" cy="122" r="220" fill="${aura.b}" opacity=".68"/><circle cx="154" cy="520" r="204" fill="${aura.accent}" opacity=".54"/><circle cx="322" cy="324" r="184" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="2"/><path d="M232 241c0-25 20-45 45-45h98v62h-70v132c0 34-28 62-62 62s-62-28-62-62 28-62 62-62c13 0 25 4 35 11v-98h-46Z" fill="#fff" opacity=".9"/><text x="48" y="112" fill="#fff" font-family="Hanken Grotesk,system-ui,sans-serif" font-size="42" font-weight="800">${safeLabel}</text><rect width="640" height="640" filter="url(#g)" opacity=".08"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function resolveVisualAssetRef(assetRef: string, title: string) {
  if (!assetRef) {
    return coverImage(title);
  }
  if (assetRef.startsWith('ipfs://')) {
    return getGatewayUrl(assetRef.slice('ipfs://'.length));
  }
  if (assetRef.startsWith('http://') || assetRef.startsWith('https://') || assetRef.startsWith('data:') || assetRef.startsWith('blob:')) {
    return assetRef;
  }
  return coverImage(title, `${title}:${assetRef}`);
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
  getActiveWalletClient: () => Promise<Awaited<ReturnType<typeof import('../shared/config/contracts').getWalletClient>>>;
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
  const [coverSource, setCoverSource] = useState(() => coverImage('Dotify', 'resting'));

  const objectUrlsRef = useRef<Set<string>>(new Set());
  const resolvedAudioSourcesRef = useRef<Map<string, string>>(new Map());
  const audioUploadRef = useRef<Promise<string> | null>(null);
  const coverUploadRef = useRef<Promise<string> | null>(null);
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const e2eClassicAccessGrantedRef = useRef(false);
  // Session cache of backend-delivered content keys: one wallet signature per
  // track per session, instead of one per playback (signature-fatigue rule).
  const contentKeysRef = useRef<Map<string, Uint8Array>>(new Map());
  // 'room_host' when the selected track streams into a room; room listeners
  // never request keys at all (they only receive the WebRTC stream).
  const keyRequestPurposeRef = useRef<KeyRequestPurpose>('individual');

  function internalSetFileHash(hash: `0x${string}` | '') {
    setFileHashState(hash);
  }

  function getDeterministicE2eCatalogTracks() {
    const tracks: CatalogTrack[] = [];
    if (isClassicUnlockE2e) tracks.push(E2E_CLASSIC_TRACK);
    if (isArtistPublishE2e) tracks.push(...getArtistPublishE2eTracks());
    // Only seed room tracks in a room context, so the classic-unlock and
    // artist-publish suites (which share the always-on flags) keep their
    // single-track catalog assumptions.
    if (isRoomJoinE2eContext()) tracks.push(...getRoomJoinE2eTracks());
    return tracks;
  }

  async function checkTrackAccess(track: CatalogTrack, listenerAddress: `0x${string}` | null): Promise<boolean> {
    if (isClassicUnlockE2e && track.id === E2E_CLASSIC_TRACK.id) {
      return e2eClassicAccessGrantedRef.current;
    }
    if (isArtistPublishE2eTrack(track)) {
      return Boolean(listenerAddress && track.artistAddress?.toLowerCase() === listenerAddress.toLowerCase());
    }
    // Room-join e2e: only the protected track is policy-gated, and only the
    // host (authorized scenario) satisfies it. Public tracks fall through.
    if (isRoomJoinE2eTrack(track)) {
      return !track.id.includes(':') || roomJoinE2eHostHasAccess();
    }
    if (!isPolicyManagedTrack(track)) return true;
    const runtimeAddress = runtimeAddressFromTrackId(track);
    if (!runtimeAddress) return false;
    try {
      // Guests probe with the zero address: it is never the artist, an owner,
      // a buyer, or personhood-verified, so the read answers true only when
      // the track's current mode grants access to everyone (Free). This is
      // what lets a walletless visitor play Free tracks (access model v2).
      return (await getPublicClient(ethRpcUrl).readContract({
        address: runtimeAddress,
        abi: musicAccessAbi,
        functionName: 'musicAccCanAccess',
        args: [track.hash, listenerAddress ?? zeroAddress]
      })) as boolean;
    } catch {
      return false;
    }
  }

  async function checkTrackPaidAccess(track: CatalogTrack, listenerAddress: `0x${string}` | null): Promise<boolean> {
    if (isClassicUnlockE2e && track.id === E2E_CLASSIC_TRACK.id) {
      return e2eClassicAccessGrantedRef.current;
    }
    if (isArtistPublishE2eTrack(track)) {
      return false;
    }
    if (isRoomJoinE2eTrack(track)) {
      return track.id.includes(':') && roomJoinE2eHostHasAccess();
    }
    if (!isPolicyManagedTrack(track) || track.accessMode !== 'classic') return false;
    if (!listenerAddress) return false;
    const runtimeAddress = runtimeAddressFromTrackId(track);
    if (!runtimeAddress) return false;
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

  // Access model v2: no preview - a locked track is an honest, clearly named
  // door (pay / verify humanity / sign in), and free tracks and rooms are the
  // discovery surface.
  function buildAccessGateInfo(track: CatalogTrack): AccessGate {
    if (!connectedWallet) {
      if (track.accessMode === 'classic') {
        return {
          track,
          title: 'Unlock full song',
          message: `"${track.title}" unlocks for ${track.priceDot} DOT, paid directly to the artist. Connect a wallet to unlock it.`,
          hint: 'No platform account needed. Confirm once from your wallet.',
          actionType: 'signin'
        };
      }
      return {
        track,
        title: 'Listener pass needed',
        message: `"${track.title}" is free for verified humans. Connect your pass to listen.`,
        hint: 'Dotify only checks whether the door should open.',
        actionType: 'signin'
      };
    }

    if (track.accessMode === 'human-free') {
      return {
        track,
        title: 'Listener pass needed',
        message: `"${track.title}" is free for verified humans. Verify once to listen in full.`,
        hint: 'No profile is created for this check.',
        actionType: 'personhood'
      };
    }
    return {
      track,
      title: 'Unlock full song',
      message: `"${track.title}" unlocks after a ${track.priceDot} DOT payment, paid directly to the artist.`,
      hint: 'Your support goes directly to the artist.',
      actionType: 'payment'
    };
  }

  /**
   * Obtain the per-track content key from the backend key service.
   * Returns null when the service is not configured, no wallet is connected,
   * or the backend denies access; callers then fall back to the demo-mode
   * bundle-derived key (which only decrypts demo-published tracks).
   */
  async function resolveServerContentKey(contentHash: `0x${string}`): Promise<Uint8Array | null> {
    if (isClassicUnlockE2e && contentHash.toLowerCase() === E2E_CLASSIC_HASH.toLowerCase()) {
      const authorized = e2eClassicAccessGrantedRef.current;
      recordClassicUnlockFullKeyRequest(authorized);
      return authorized ? new Uint8Array(32).fill(7) : null;
    }

    // Room-join e2e: only the host ever reaches this path for the protected
    // track. Record the request so the spec can prove listeners stay at zero.
    if (isRoomJoinE2eProtectedHash(contentHash)) {
      const authorized = roomJoinE2eHostHasAccess();
      recordRoomJoinE2eKeyRequest(authorized);
      return authorized ? new Uint8Array(32).fill(9) : null;
    }

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

  /**
   * Obtain the content key for a Free track: no wallet, no signature. The
   * backend re-verifies the mode on-chain before releasing anything, so this
   * cannot open a paid or human-gated track.
   */
  async function resolveFreeContentKey(contentHash: `0x${string}`): Promise<Uint8Array | null> {
    const cacheKey = contentHash.toLowerCase();
    const cached = contentKeysRef.current.get(cacheKey);
    if (cached) return cached;
    if (!isKeyServiceConfigured()) return null;

    try {
      const response = await requestFreeContentKey(contentHash);
      if (response.access !== 'allowed') return null;
      const keyBytes = hexToBytes(response.contentKey);
      contentKeysRef.current.set(cacheKey, keyBytes);
      return keyBytes;
    } catch {
      return null;
    }
  }

  async function fetchAndDecryptAudio(audioRef: string, gatewayUrl: string, contentHash: `0x${string}`, accessMode: AccessMode): Promise<string> {
    if (isClassicUnlockE2e && contentHash.toLowerCase() === E2E_CLASSIC_HASH.toLowerCase()) {
      const serverKey = await resolveServerContentKey(contentHash);
      if (!serverKey) throw new Error('E2E full key request denied before payment.');
      return E2E_CLASSIC_AUDIO_URL;
    }

    if (isRoomJoinE2eProtectedHash(contentHash)) {
      const serverKey = await resolveServerContentKey(contentHash);
      if (!serverKey) throw new Error('E2E room host is not authorized for full playback.');
      return E2E_ROOM_AUDIO_URL;
    }

    const cacheKey = audioRef;
    const cached = resolvedAudioSourcesRef.current.get(cacheKey);
    if (cached) return cached;

    const response = isEncryptedAudioRef(audioRef) ? await fetchIpfsCid(encryptedRefToCID(audioRef)) : await fetch(gatewayUrl);
    if (!response.ok) throw new Error(`Unable to fetch encrypted audio (${response.status})`);

    const encryptedBytes = new Uint8Array(await response.arrayBuffer());
    // Free tracks fetch their key without a wallet or signature; everything
    // else goes through the signed request. Both fall back to the demo
    // bundle-derived key, which only decrypts demo-published tracks.
    const serverKey = accessMode === 'free' ? await resolveFreeContentKey(contentHash) : await resolveServerContentKey(contentHash);
    const clearBytes = serverKey ? await decryptAudio(encryptedBytes, serverKey) : await decryptTrackAudio(encryptedBytes, contentHash);

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
    // Stop the outgoing track immediately. Resolving the new source (access
    // check + decrypt/fetch) is async, so without this the old audio keeps
    // playing for the whole gap while the cover and title already show the new
    // track. The new source autoplays once it loads.
    const outgoingAudio = localAudioRef.current;
    if (outgoingAudio && !outgoingAudio.paused) {
      outgoingAudio.pause();
    }

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
    // A socketEmit callback means this selection streams into a room: the
    // signer is the host, and only the host needs to satisfy the policy.
    keyRequestPurposeRef.current = socketEmit ? 'room_host' : 'individual';

    // Access model v2: access is binary. An authorized listener plays the full
    // track; an unauthorized one gets the access gate and no audio at all. The
    // 42% preview is retired.
    let audioUrl: string | null = null;
    let hasAccess = true;

    if (isPolicyManagedTrack(track)) {
      hasAccess = await checkTrackAccess(track, listenerEvmAddress);
      setCatalogAccessByTrackId(previous => ({ ...previous, [track.id]: hasAccess }));
      if (!hasAccess) {
        setAccessGate(buildAccessGateInfo(track));
      }
    }

    if (hasAccess && track.localUrl) {
      audioUrl = track.encrypted ? await fetchAndDecryptAudio(track.audioRef, track.localUrl, track.hash, track.accessMode).catch(() => null) : track.localUrl;

      if (!audioUrl && track.encrypted) {
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
      // Rooms always carry the full track: a host who cannot play a track
      // streams nothing (kept on the wire for protocol compatibility).
      socketEmit('room:playback-mode', { playbackMode: 'full' });
    }

    return 'full';
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

    if (isClassicUnlockE2e && track.id === E2E_CLASSIC_TRACK.id) {
      setAccessGate(null);
      setTransactionFeedback({
        tone: 'pending',
        title: 'Processing payment',
        message: `Paying ${track.priceDot} DOT to unlock "${track.title}".`
      });
      await new Promise(resolve => window.setTimeout(resolve, 20));
      e2eClassicAccessGrantedRef.current = true;
      getClassicUnlockE2eState().paid = true;
      setCatalogAccessByTrackId(previous => ({ ...previous, [track.id]: true }));
      setCatalogPaidAccessByTrackId(previous => ({ ...previous, [track.id]: true }));
      setTransactionFeedback({
        tone: 'success',
        title: 'Access unlocked',
        message: `Full playback of "${track.title}" is now available.`,
        txHash: E2E_CLASSIC_TX_HASH
      });
      await selectTrack(track, undefined, undefined, undefined);
      return;
    }

    const runtimeAddress = runtimeAddressFromTrackId(track);
    if (!runtimeAddress) return;

    const { musicRoyaltiesAbi, getPublicClient: getClient } = await import('../shared/config/contracts');
    const { dotToPlanck } = await import('../shared/utils/format');

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
          accessMode: decodeAccessMode(Number(track.accessMode)),
          source: 'artist' as const,
          royaltySplits: royaltySplits.filter((split): split is RoyaltySplit => Boolean(split)),
          personhoodLevel: decodePersonhood(Number(track.requiredPersonhood)),
          zone: 'Registry',
          encrypted,
          registeredAtBlock: Number(track.registeredAtBlock)
        };
      })
    );

    return tracks.flatMap(track => (track ? [track] : []));
  }

  async function refreshCatalogFromRegistry(preferredTrackHash?: `0x${string}`) {
    if (isClassicUnlockE2e || isArtistPublishE2e || isRoomJoinE2e) {
      const nextCatalog = getDeterministicE2eCatalogTracks();
      setCatalogTracks(nextCatalog);
      setSelectedTrackId(previous => {
        const preferredTrack = preferredTrackHash ? (nextCatalog.find(track => track.hash.toLowerCase() === preferredTrackHash.toLowerCase()) ?? null) : null;
        if (preferredTrack) return preferredTrack.id;
        return nextCatalog.some(track => track.id === previous) ? previous : (nextCatalog[0]?.id ?? '');
      });
      setCatalogAccessByTrackId(
        Object.fromEntries(
          nextCatalog.map(track => [
            track.id,
            track.id === E2E_CLASSIC_TRACK.id
              ? e2eClassicAccessGrantedRef.current
              : Boolean(listenerEvmAddress && track.artistAddress?.toLowerCase() === listenerEvmAddress.toLowerCase())
          ])
        )
      );
      setCatalogPaidAccessByTrackId(
        Object.fromEntries(nextCatalog.map(track => [track.id, track.id === E2E_CLASSIC_TRACK.id && e2eClassicAccessGrantedRef.current]))
      );
      setCatalogStatus(
        nextCatalog.length > 0 ? `Loaded ${nextCatalog.length} deterministic e2e track${nextCatalog.length === 1 ? '' : 's'}` : 'No e2e tracks registered yet'
      );
      return nextCatalog;
    }

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
      console.warn('Failed to load registry catalog', catalogError);
      setCatalogTracks([]);
      setSelectedTrackId('');
      setCatalogStatus(catalogLoadFailureStatus(catalogError));
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
    // Functions
    selectTrack,
    openTrack,
    checkTrackAccess,
    checkTrackPaidAccess,
    buildAccessGateInfo,
    payForTrackAccess,
    fetchAndDecryptAudio,
    refreshCatalogFromRegistry,
    fetchDirectoryEntries,
    fetchRuntimeCatalog,
    clearObjectUrls
  };
}
