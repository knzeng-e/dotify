import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchAssetRef, fetchAudioIpfsCid, getGatewayUrl } from '../services/pinata';
import { getPublicClient, resolveEvmChain } from '../shared/config/contracts';
import { decryptAudio, hexToBytes } from '../shared/utils/crypto';
import { formatWeiAsDot } from '../shared/utils/format';
import { isKeyServiceConfigured, requestContentKey, requestFreeContentKey, type KeyRequestPurpose } from '../services/keyService';
import { decryptTrackAudio, encryptedRefToCID, isEncryptedAudioRef, isEncryptedAudioV2Ref } from '../shared/utils/protectedAudio';
import {
  AudioV2HeaderIncompleteError,
  audioV2ChunkBodyOffset,
  canStreamAudioV2WithMse,
  decryptAudioV2Chunk,
  decryptAudioV2Container,
  importAudioV2ContentKey,
  initialAudioV2HeaderRangeEnd,
  parseAudioV2HeaderPrefix,
  type ParsedAudioV2
} from '../shared/utils/audioV2';
import { isPolicyManagedTrack } from '../features/access/accessPolicy';
import { buildAccessGate, buildClassicAccessVerifiedFeedback, buildIncludedPaymentUnverifiedMessage } from '../features/access/accessPromise';
import { catalogApiStatus, catalogLoadFailureStatus } from '../features/catalog/catalogStatus';
import { fetchAudioV2RangeThroughGateways, type AudioV2GatewayPhase, type AudioV2RangeResult } from '../features/catalog/audioV2Gateway';
import { pumpAudioV2ReadAhead } from '../features/catalog/audioV2Pipeline';
import { AudioV2ChunkAuthenticationError, routeAudioV2MseFailure } from '../features/catalog/audioV2Recovery';
import { runtimeAddressFromTrackId } from '../features/catalog/trackModel';
import {
  DOTIFY_FALLBACK_NATIVE_RUNTIME_ASSET,
  classicTrackPaymentAmountPlanck,
  createNativeRuntimeAccessPaymentIntent,
  nativeRuntimePaymentAssetFromChain
} from '../features/payments/paymentModel';
import { verifyRuntimeAccessPayment, type RuntimeAccessPaymentVerificationResult } from '../features/payments/paymentReadback';
import { decodeAccessMode, decodePersonhood } from '../features/runtime/accessEncoding';
import { resolveRuntimeAdapterConfig } from '../features/runtime/runtimeAdapterConfig';
import { createRuntimeReader } from '../features/runtime/runtimeReaderProvider';
import { createRuntimeWriter } from '../features/runtime/runtimeWriterProvider';
import type { RuntimeReadPort, RuntimeTrackSnapshot } from '../features/runtime/runtimePorts';
import { resolveProductHostConfig } from '../features/productHost/productHost';
import { publishProductCdmPaymentSmokeMetric, type ProductCdmPaymentSmokeMetric } from '../features/productHost/productCdmHostSmokeEvidence';
import { audioV2StartupPhaseLabel, type AudioV2StartupMetric } from '../features/catalog/audioStartupTelemetry';
import { fetchCatalog, isCatalogApiConfigured, readBundledCatalog, readCachedCatalog, type CatalogApiRelease } from '../services/catalog';
import { createCoverFallbackDataUri } from '../features/catalog/coverArtwork';
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
  E2E_ROOM_PROTECTED_AUDIO_URL,
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
  PersonhoodLevel,
  PlayerState,
  RegistryCatalogTrack,
  RoomPlaybackMode,
  TrackInfo,
  TransactionFeedback,
  View
} from '../shared/types';
import type { ConnectedWallet } from './useWallet';

const zeroAddress = '0x0000000000000000000000000000000000000000' as const;

type AudioV2StartupContext = {
  audioRef: string;
  cid: string;
  startedAt: number;
  signal: AbortSignal;
  isCurrent: () => boolean;
  onMetric?: (metric: AudioV2StartupMetric) => void;
};

export type TrackSelectionResult = {
  playbackMode: RoomPlaybackMode;
  audioSource: string | null;
};

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function createAbortError(message = 'Audio selection cancelled'): Error {
  if (typeof DOMException !== 'undefined') return new DOMException(message, 'AbortError');
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw createAbortError();
}

function isAudioV2ContextActive(context: AudioV2StartupContext): boolean {
  return !context.signal.aborted && context.isCurrent();
}

function publishAudioV2StartupMetric(context: AudioV2StartupContext, metric: Omit<AudioV2StartupMetric, 'audioRef' | 'cid' | 'elapsedMs' | 'timestamp'>): void {
  if (typeof window === 'undefined') return;
  if (!isAudioV2ContextActive(context)) return;
  const detail: AudioV2StartupMetric = {
    audioRef: context.audioRef,
    cid: context.cid,
    elapsedMs: Number((nowMs() - context.startedAt).toFixed(1)),
    timestamp: Date.now(),
    ...metric
  };
  window.dispatchEvent(new CustomEvent('dotify:dav2-startup', { detail }));
  context.onMetric?.(detail);
  if (import.meta.env.DEV) {
    console.info('[dotify.dav2.startup]', detail);
  }
}

function buildProductCdmPaymentSmokeMetric(input: {
  verification: RuntimeAccessPaymentVerificationResult;
  txHash: `0x${string}`;
  runtimeAddress: `0x${string}`;
  contentHash: `0x${string}`;
  listenerAddress: `0x${string}`;
  amountPlanck: bigint;
}): ProductCdmPaymentSmokeMetric {
  return {
    txHash: input.txHash,
    runtimeAddress: input.runtimeAddress,
    contentHash: input.contentHash,
    listenerAddress: input.listenerAddress,
    amountPlanck: input.amountPlanck.toString(),
    hasPaid: input.verification.readback?.hasPaid ?? null,
    canAccess: input.verification.readback?.canAccess ?? null,
    attempts: input.verification.attempts,
    ok: input.verification.ok,
    error: input.verification.error,
    timestamp: Date.now()
  };
}

function resolveVisualAssetRef(assetRef: string, title: string) {
  if (!assetRef) {
    return createCoverFallbackDataUri(title);
  }
  if (assetRef.startsWith('ipfs://')) {
    return assetRef;
  }
  if (assetRef.startsWith('http://') || assetRef.startsWith('https://') || assetRef.startsWith('data:') || assetRef.startsWith('blob:')) {
    return assetRef;
  }
  return createCoverFallbackDataUri(title, `${title}:${assetRef}`);
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

function catalogApiReleaseToTrack(release: CatalogApiRelease): CatalogTrack {
  return {
    id: release.id,
    hash: release.hash,
    title: release.title,
    artist: release.artist,
    artistAddress: release.artistAddress,
    audioRef: release.audioRef,
    imageRef: resolveVisualAssetRef(release.imageRef, release.title),
    priceDot: release.priceDot,
    pricePlanck: BigInt(release.priceWei),
    localUrl: resolveAudioAssetRef(release.audioRef),
    description: release.description,
    bulletinRef: release.bulletinRef,
    metadataRef: release.metadataRef,
    royaltyBps: release.royaltyBps,
    durationLabel: 'ready',
    accessMode: release.accessMode,
    active: release.active,
    source: 'artist',
    royaltySplits: release.royaltySplits,
    personhoodLevel: release.personhoodLevel,
    zone: 'Registry',
    encrypted: release.encrypted,
    registeredAtBlock: release.registeredAtBlock
  };
}

export type UseCatalogDeps = {
  ethRpcUrl: string;
  listenerEvmAddress: `0x${string}` | null;
  connectedWallet: ConnectedWallet | null;
  directoryAddress: `0x${string}` | undefined;
  setShowWalletModal: (show: boolean) => void;
  setTransactionFeedback: (feedback: TransactionFeedback | null) => void;
  activeView: View;
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
    activeView,
    navigateToView,
    getActiveWalletClient,
    setBulletinManifestRef,
    setAccessMode,
    setPriceDot,
    setPersonhoodLevel,
    setArtistName,
    setDescription
  } = deps;

  const runtimeAdapterConfig = useMemo(() => resolveRuntimeAdapterConfig(import.meta.env), []);
  const productHostConfig = useMemo(() => resolveProductHostConfig(import.meta.env), []);
  const productRuntimeAccount = useMemo(() => {
    if (connectedWallet?.method !== 'product-host') return undefined;
    const signer = connectedWallet.keyRequestSigner;
    return {
      productId: productHostConfig.productId,
      evmAddress: connectedWallet.evmAddress,
      publicKey: signer && 'productPublicKey' in signer ? signer.productPublicKey : undefined
    };
  }, [connectedWallet, productHostConfig.productId]);
  const runtimeReader = useMemo(() => createRuntimeReader({ ethRpcUrl, config: runtimeAdapterConfig }), [ethRpcUrl, runtimeAdapterConfig]);
  const runtimeWriter = useMemo(
    () => createRuntimeWriter({ ethRpcUrl, getViemWalletClient: getActiveWalletClient, config: runtimeAdapterConfig, productAccount: productRuntimeAccount }),
    [ethRpcUrl, getActiveWalletClient, productRuntimeAccount, runtimeAdapterConfig]
  );
  const usesCatalogApi = isCatalogApiConfigured() && !isClassicUnlockE2e && !isArtistPublishE2e && !isRoomJoinE2e;
  const [initialCatalogState] = useState<{ tracks: CatalogTrack[]; source: 'cache' | 'bundle' | null }>(() => {
    const cached = usesCatalogApi ? readCachedCatalog() : null;
    if (cached) return { tracks: cached.items.map(catalogApiReleaseToTrack), source: 'cache' };
    const bundled = usesCatalogApi ? readBundledCatalog() : null;
    if (bundled) return { tracks: bundled.items.map(catalogApiReleaseToTrack), source: 'bundle' };
    return { tracks: [], source: null };
  });
  const initialCatalog = initialCatalogState.tracks;
  const [catalogTracks, setCatalogTracks] = useState<CatalogTrack[]>(() => initialCatalog.filter(track => track.active !== false));
  const [allCatalogTracks, setAllCatalogTracks] = useState<CatalogTrack[]>(initialCatalog);
  const [catalogStatus, setCatalogStatus] = useState(
    initialCatalogState.source === 'bundle'
      ? 'Showing bundled Product catalog while new releases are checked'
      : initialCatalog.length > 0
        ? 'Showing saved catalog data while new releases are checked'
        : 'Loading registry catalog'
  );
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [catalogAccessByTrackId, setCatalogAccessByTrackId] = useState<Record<string, boolean>>({});
  const [catalogPaidAccessByTrackId, setCatalogPaidAccessByTrackId] = useState<Record<string, boolean>>({});
  const [nativeRuntimePaymentAsset, setNativeRuntimePaymentAsset] = useState(DOTIFY_FALLBACK_NATIVE_RUNTIME_ASSET);
  const [audioSource, setAudioSource] = useState<string | null>(null);
  const [trackInfo, setTrackInfo] = useState<TrackInfo | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [accessGate, setAccessGate] = useState<AccessGate | null>(null);
  const [audioStartupStatus, setAudioStartupStatus] = useState<string | null>(null);
  const [fileHash, setFileHashState] = useState<`0x${string}` | ''>('');
  const [audioCID, setAudioCID] = useState('');
  const [coverCID, setCoverCID] = useState('');
  const [coverSource, setCoverSource] = useState(() => createCoverFallbackDataUri('Dotify', 'resting'));

  const objectUrlsRef = useRef<Set<string>>(new Set());
  const resolvedAudioSourcesRef = useRef<Map<string, string>>(new Map());
  const audioSourceRef = useRef<string | null>(null);
  const audioV2FallbacksRef = useRef<Set<string>>(new Set());
  const audioUploadRef = useRef<Promise<string> | null>(null);
  const coverUploadRef = useRef<Promise<string> | null>(null);
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const selectedTrackIdRef = useRef(selectedTrackId);
  const activeViewRef = useRef(activeView);
  const activeTrackSelectionRef = useRef<{ id: number; controller: AbortController } | null>(null);
  const nextTrackSelectionIdRef = useRef(0);
  const e2eClassicAccessGrantedRef = useRef(false);
  // Session cache of backend-delivered content keys: one wallet signature per
  // track per session, instead of one per playback (signature-fatigue rule).
  const contentKeysRef = useRef<Map<string, Uint8Array>>(new Map());
  // 'room_host' when the selected track streams into a room; room listeners
  // never request keys at all (they only receive the WebRTC stream).
  const keyRequestPurposeRef = useRef<KeyRequestPurpose>('individual');

  useEffect(() => {
    selectedTrackIdRef.current = selectedTrackId;
  }, [selectedTrackId]);

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  useEffect(() => {
    let cancelled = false;

    async function resolveNativeRuntimePaymentAsset() {
      try {
        const chain = await resolveEvmChain(ethRpcUrl);
        if (!cancelled) setNativeRuntimePaymentAsset(nativeRuntimePaymentAssetFromChain(chain));
      } catch {
        if (!cancelled) setNativeRuntimePaymentAsset(DOTIFY_FALLBACK_NATIVE_RUNTIME_ASSET);
      }
    }

    void resolveNativeRuntimePaymentAsset();
    return () => {
      cancelled = true;
    };
  }, [ethRpcUrl]);

  function internalSetFileHash(hash: `0x${string}` | '') {
    setFileHashState(hash);
  }

  function setResolvedAudioSource(source: string | null) {
    audioSourceRef.current = source;
    setAudioSource(source);
  }

  function retireAudioV2MseObjectUrl(audioRef: string, objectUrl: string) {
    if (resolvedAudioSourcesRef.current.get(audioRef) === objectUrl) {
      resolvedAudioSourcesRef.current.delete(audioRef);
    }
    if (objectUrlsRef.current.delete(objectUrl)) {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    }
  }

  function beginTrackSelection() {
    activeTrackSelectionRef.current?.controller.abort();
    const selection = {
      id: (nextTrackSelectionIdRef.current += 1),
      controller: new AbortController()
    };
    activeTrackSelectionRef.current = selection;
    return selection;
  }

  function isTrackSelectionCurrent(selection: { id: number; controller: AbortController }): boolean {
    return activeTrackSelectionRef.current?.id === selection.id && !selection.controller.signal.aborted;
  }

  function abortActiveTrackSelection() {
    activeTrackSelectionRef.current?.controller.abort();
    activeTrackSelectionRef.current = null;
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
      return await runtimeReader.canAccess(runtimeAddress, track.hash, listenerAddress ?? zeroAddress);
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
      return await runtimeReader.hasPaid(runtimeAddress, track.hash, listenerAddress);
    } catch {
      return false;
    }
  }

  // Access model v2: no preview - a locked track is an honest, clearly named
  // door (pay / verify humanity / sign in), and free tracks and rooms are the
  // discovery surface.
  function buildAccessGateInfo(track: CatalogTrack): AccessGate {
    return buildAccessGate({ track, connected: Boolean(connectedWallet), nativePaymentAsset: nativeRuntimePaymentAsset });
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
    if (!isKeyServiceConfigured() || !connectedWallet || (!connectedWallet.createEvmClient && !connectedWallet.keyRequestSigner)) return null;

    try {
      const walletClient = connectedWallet.keyRequestSigner ? null : await getActiveWalletClient();
      const chainId = walletClient?.chain?.id ?? (await getPublicClient(ethRpcUrl).getChainId());
      const response = await requestContentKey({
        contentHash,
        purpose: keyRequestPurposeRef.current,
        ...(connectedWallet.keyRequestSigner ? { signer: connectedWallet.keyRequestSigner } : { walletClient: walletClient! }),
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

  async function fetchAudioV2Range(
    context: AudioV2StartupContext,
    start: number,
    end: number,
    phase: AudioV2GatewayPhase,
    signal: AbortSignal = context.signal
  ): Promise<AudioV2RangeResult> {
    throwIfAborted(signal);
    return fetchAudioV2RangeThroughGateways(context.cid, start, end, { phase, signal });
  }

  async function fetchAudioV2Header(context: AudioV2StartupContext): Promise<ParsedAudioV2> {
    let rangeEnd = initialAudioV2HeaderRangeEnd();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const range = await fetchAudioV2Range(context, 0, rangeEnd, 'header');
      publishAudioV2StartupMetric(context, {
        phase: 'gateway-selected',
        gatewayUrl: range.gatewayUrl,
        rangeStart: 0,
        rangeEnd,
        hedged: range.hedged,
        fromCache: range.fromCache
      });
      try {
        const parsed = parseAudioV2HeaderPrefix(range.bytes);
        publishAudioV2StartupMetric(context, {
          phase: 'header-ready',
          gatewayUrl: range.gatewayUrl,
          rangeStart: 0,
          rangeEnd,
          hedged: range.hedged,
          fromCache: range.fromCache
        });
        return parsed;
      } catch (error) {
        if (error instanceof AudioV2HeaderIncompleteError && error.neededBytes - 1 > rangeEnd) {
          rangeEnd = error.neededBytes - 1;
          continue;
        }
        throw error;
      }
    }
    throw new Error('Unable to read DAV2 header');
  }

  function waitForMediaSourceOpen(mediaSource: MediaSource, signal?: AbortSignal): Promise<void> {
    if (mediaSource.readyState === 'open') return Promise.resolve();
    throwIfAborted(signal);
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        mediaSource.removeEventListener('sourceopen', handleOpen);
        mediaSource.removeEventListener('sourceended', handleEnded);
        mediaSource.removeEventListener('sourceclose', handleEnded);
        signal?.removeEventListener('abort', handleAbort);
      };
      const handleOpen = () => {
        cleanup();
        resolve();
      };
      const handleEnded = () => {
        cleanup();
        reject(new Error('MediaSource closed before opening'));
      };
      const handleAbort = () => {
        cleanup();
        reject(createAbortError());
      };
      mediaSource.addEventListener('sourceopen', handleOpen, { once: true });
      mediaSource.addEventListener('sourceended', handleEnded, { once: true });
      mediaSource.addEventListener('sourceclose', handleEnded, { once: true });
      signal?.addEventListener('abort', handleAbort, { once: true });
    });
  }

  function appendSourceBuffer(sourceBuffer: SourceBuffer, bytes: Uint8Array, signal?: AbortSignal): Promise<void> {
    throwIfAborted(signal);
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        sourceBuffer.removeEventListener('updateend', handleDone);
        sourceBuffer.removeEventListener('error', handleError);
        sourceBuffer.removeEventListener('abort', handleError);
        signal?.removeEventListener('abort', handleAbort);
      };
      const handleDone = () => {
        cleanup();
        resolve();
      };
      const handleError = () => {
        cleanup();
        reject(new Error('Unable to append DAV2 audio chunk'));
      };
      const handleAbort = () => {
        cleanup();
        reject(createAbortError());
      };
      sourceBuffer.addEventListener('updateend', handleDone, { once: true });
      sourceBuffer.addEventListener('error', handleError, { once: true });
      sourceBuffer.addEventListener('abort', handleError, { once: true });
      signal?.addEventListener('abort', handleAbort, { once: true });
      try {
        sourceBuffer.appendBuffer(bytes);
      } catch {
        cleanup();
        reject(new Error('Unable to append DAV2 audio chunk'));
      }
    });
  }

  async function pumpAudioV2ToMediaSource(
    mediaSource: MediaSource,
    sourceBuffer: SourceBuffer,
    context: AudioV2StartupContext,
    parsed: ParsedAudioV2,
    key: Uint8Array
  ): Promise<void> {
    const cryptoKeyPromise = importAudioV2ContentKey(key).catch(error => {
      throw new AudioV2ChunkAuthenticationError(error);
    });

    await pumpAudioV2ReadAhead({
      chunks: parsed.header.chunks,
      signal: context.signal,
      prepareChunk: async (chunk, signal) => {
        throwIfAborted(signal);
        const chunkStart = parsed.bodyOffset + audioV2ChunkBodyOffset(parsed.header, chunk.index);
        const chunkEnd = chunkStart + chunk.encryptedLength - 1;
        const range = await fetchAudioV2Range(context, chunkStart, chunkEnd, chunk.index === 0 ? 'first-chunk' : 'chunk', signal);
        if (chunk.index === 0) {
          publishAudioV2StartupMetric(context, {
            phase: 'first-range-ready',
            gatewayUrl: range.gatewayUrl,
            rangeStart: chunkStart,
            rangeEnd: chunkEnd,
            chunkIndex: chunk.index,
            hedged: range.hedged,
            fromCache: range.fromCache
          });
        }

        const cryptoKey = await cryptoKeyPromise;
        let clear: Uint8Array;
        try {
          clear = await decryptAudioV2Chunk(parsed.header, chunk.index, range.bytes, cryptoKey);
        } catch (error) {
          throw new AudioV2ChunkAuthenticationError(error);
        }
        throwIfAborted(signal);
        if (chunk.index === 0) {
          publishAudioV2StartupMetric(context, {
            phase: 'first-chunk-decrypted',
            gatewayUrl: range.gatewayUrl,
            rangeStart: chunkStart,
            rangeEnd: chunkEnd,
            chunkIndex: chunk.index,
            hedged: range.hedged,
            fromCache: range.fromCache
          });
        }
        return { clear, range, chunkStart, chunkEnd };
      },
      appendChunk: async (chunk, prepared, signal) => {
        await appendSourceBuffer(sourceBuffer, prepared.clear, signal);
        if (chunk.index === 0) {
          publishAudioV2StartupMetric(context, {
            phase: 'first-chunk-appended',
            gatewayUrl: prepared.range.gatewayUrl,
            rangeStart: prepared.chunkStart,
            rangeEnd: prepared.chunkEnd,
            chunkIndex: chunk.index,
            hedged: prepared.range.hedged,
            fromCache: prepared.range.fromCache
          });
        }
      }
    });
    if (mediaSource.readyState === 'open') mediaSource.endOfStream();
  }

  async function fetchAndDecryptAudioV2Blob(cid: string, key: Uint8Array, signal?: AbortSignal): Promise<string> {
    throwIfAborted(signal);
    const response = await fetchAudioIpfsCid(cid, { signal });
    if (!response.ok) throw new Error(`Unable to fetch DAV2 audio (${response.status})`);
    throwIfAborted(signal);
    const decrypted = await decryptAudioV2Container(new Uint8Array(await response.arrayBuffer()), key);
    throwIfAborted(signal);
    const blob = new Blob([decrypted.bytes], { type: decrypted.mediaMime });
    return URL.createObjectURL(blob);
  }

  async function recoverAudioV2MseFailure(context: AudioV2StartupContext, key: Uint8Array, failedObjectUrl: string, error: unknown) {
    const { audioRef, cid } = context;
    if (!isAudioV2ContextActive(context) || isAbortError(error)) {
      retireAudioV2MseObjectUrl(audioRef, failedObjectUrl);
      return;
    }
    if (audioV2FallbacksRef.current.has(audioRef)) return;
    if (audioSourceRef.current !== failedObjectUrl) return;

    audioV2FallbacksRef.current.add(audioRef);
    try {
      console.warn('DAV2 streaming failed, falling back to full decrypt', error);
      publishAudioV2StartupMetric(context, {
        phase: 'fallback',
        detail: errorMessage(error)
      });
      const fallbackUrl = await fetchAndDecryptAudioV2Blob(cid, key, context.signal);
      objectUrlsRef.current.add(fallbackUrl);
      resolvedAudioSourcesRef.current.set(audioRef, fallbackUrl);

      if (audioSourceRef.current === failedObjectUrl) {
        setResolvedAudioSource(fallbackUrl);
      }

      retireAudioV2MseObjectUrl(audioRef, failedObjectUrl);
    } catch (fallbackError) {
      if (!isAbortError(fallbackError)) {
        console.warn('DAV2 full decrypt fallback failed', fallbackError);
      }
      retireAudioV2MseObjectUrl(audioRef, failedObjectUrl);
    } finally {
      audioV2FallbacksRef.current.delete(audioRef);
    }
  }

  function createAudioV2MseSource(context: AudioV2StartupContext, parsed: ParsedAudioV2, key: Uint8Array): string {
    if (!canStreamAudioV2WithMse(parsed.header)) throw new Error('DAV2 MSE streaming unsupported for this media type');

    const mediaSource = new MediaSource();
    const objectUrl = URL.createObjectURL(mediaSource);

    void waitForMediaSourceOpen(mediaSource, context.signal)
      .then(() => {
        throwIfAborted(context.signal);
        const sourceBuffer = mediaSource.addSourceBuffer(parsed.header.mediaMime);
        return pumpAudioV2ToMediaSource(mediaSource, sourceBuffer, context, parsed, key);
      })
      .catch(error => {
        routeAudioV2MseFailure({
          error,
          contextActive: isAudioV2ContextActive(context),
          retire: () => retireAudioV2MseObjectUrl(context.audioRef, objectUrl),
          recover: recoverableError => {
            void recoverAudioV2MseFailure(context, key, objectUrl, recoverableError);
          },
          reportAuthenticationFailure: authenticationError => {
            console.warn('DAV2 chunk authentication failed', authenticationError);
            publishAudioV2StartupMetric(context, {
              phase: 'error',
              detail: errorMessage(authenticationError)
            });
          }
        });
        if (mediaSource.readyState === 'open') {
          try {
            mediaSource.endOfStream('decode');
          } catch {
            // The media element will surface the playback error.
          }
        }
      });

    return objectUrl;
  }

  async function fetchAndDecryptAudioV2(context: AudioV2StartupContext, key: Uint8Array): Promise<string> {
    try {
      const parsed = await fetchAudioV2Header(context);
      return createAudioV2MseSource(context, parsed, key);
    } catch (streamError) {
      if (isAbortError(streamError) || !isAudioV2ContextActive(context)) {
        throw streamError;
      }
      console.warn('DAV2 streaming unavailable, falling back to full decrypt', streamError);
      publishAudioV2StartupMetric(context, {
        phase: 'fallback',
        detail: errorMessage(streamError)
      });
    }

    return fetchAndDecryptAudioV2Blob(context.cid, key, context.signal);
  }

  async function fetchAndDecryptAudio(
    audioRef: string,
    gatewayUrl: string,
    contentHash: `0x${string}`,
    accessMode: AccessMode,
    signal?: AbortSignal,
    isCurrent: () => boolean = () => true
  ): Promise<string> {
    throwIfAborted(signal);
    if (isClassicUnlockE2e && contentHash.toLowerCase() === E2E_CLASSIC_HASH.toLowerCase()) {
      const serverKey = await resolveServerContentKey(contentHash);
      throwIfAborted(signal);
      if (!serverKey) throw new Error('E2E full key request denied before payment.');
      return E2E_CLASSIC_AUDIO_URL;
    }

    if (isRoomJoinE2eProtectedHash(contentHash)) {
      const serverKey = await resolveServerContentKey(contentHash);
      throwIfAborted(signal);
      if (!serverKey) throw new Error('E2E room host is not authorized for full playback.');
      return E2E_ROOM_PROTECTED_AUDIO_URL;
    }

    const cacheKey = audioRef;
    const cached = resolvedAudioSourcesRef.current.get(cacheKey);
    if (cached) {
      setAudioStartupStatus(isEncryptedAudioV2Ref(audioRef) ? 'Starting audio' : null);
      return cached;
    }

    if (isEncryptedAudioV2Ref(audioRef)) {
      const context: AudioV2StartupContext = {
        audioRef,
        cid: encryptedRefToCID(audioRef),
        startedAt: nowMs(),
        signal: signal ?? new AbortController().signal,
        isCurrent,
        onMetric: metric => {
          setAudioStartupStatus(audioV2StartupPhaseLabel(metric));
        }
      };
      const serverKey = accessMode === 'free' ? await resolveFreeContentKey(contentHash) : await resolveServerContentKey(contentHash);
      throwIfAborted(context.signal);
      if (!serverKey) {
        publishAudioV2StartupMetric(context, {
          phase: 'error',
          detail: 'DAV2 content key unavailable.'
        });
        throw new Error('DAV2 content key unavailable.');
      }
      publishAudioV2StartupMetric(context, { phase: 'key-authorized' });
      const objectUrl = await fetchAndDecryptAudioV2(context, serverKey);
      objectUrlsRef.current.add(objectUrl);
      resolvedAudioSourcesRef.current.set(cacheKey, objectUrl);
      return objectUrl;
    }

    const serverKey = accessMode === 'free' ? await resolveFreeContentKey(contentHash) : await resolveServerContentKey(contentHash);
    throwIfAborted(signal);
    const response = isEncryptedAudioRef(audioRef)
      ? await fetchAudioIpfsCid(encryptedRefToCID(audioRef), { signal })
      : await fetchAssetRef(audioRef || gatewayUrl, { signal });
    if (!response.ok) throw new Error(`Unable to fetch audio (${response.status})`);
    throwIfAborted(signal);

    const encryptedBytes = new Uint8Array(await response.arrayBuffer());
    // Free tracks fetch their key without a wallet or signature; everything
    // else goes through the signed request. Both fall back to the demo
    // bundle-derived key, which only decrypts demo-published tracks.
    const clearBytes = serverKey ? await decryptAudio(encryptedBytes, serverKey) : await decryptTrackAudio(encryptedBytes, contentHash);
    throwIfAborted(signal);

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
  ): Promise<TrackSelectionResult> {
    const selection = beginTrackSelection();

    // Stop the outgoing track immediately. Resolving the new source (access
    // check + decrypt/fetch) is async, so without this the old audio keeps
    // playing for the whole gap while the cover and title already show the new
    // track. The new source autoplays once it loads.
    const outgoingAudio = localAudioRef.current;
    if (outgoingAudio && !outgoingAudio.paused) {
      outgoingAudio.pause();
    }

    selectedTrackIdRef.current = track.id;
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
    setAudioStartupStatus(track.encrypted ? 'Checking access' : null);
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
      if (!isTrackSelectionCurrent(selection)) return { playbackMode: 'full', audioSource: audioSourceRef.current };
      setCatalogAccessByTrackId(previous => ({ ...previous, [track.id]: hasAccess }));
      if (!hasAccess) {
        setAccessGate(buildAccessGateInfo(track));
        setAudioStartupStatus(null);
      }
    }

    if (hasAccess && track.localUrl) {
      audioUrl = track.encrypted
        ? await fetchAndDecryptAudio(track.audioRef, track.localUrl, track.hash, track.accessMode, selection.controller.signal, () =>
            isTrackSelectionCurrent(selection)
          ).catch(() => null)
        : track.localUrl;
      if (!isTrackSelectionCurrent(selection)) return { playbackMode: 'full', audioSource: audioSourceRef.current };

      if (!audioUrl && track.encrypted) {
        // Access is granted but the key or decryption failed. Say so plainly
        // instead of leaving a silent dead player.
        setTransactionFeedback({
          tone: 'error',
          title: 'Protected playback unavailable',
          message: 'Your access checks out, but the content key could not be obtained or used. The key service may be unreachable; try again shortly.'
        });
        setAudioStartupStatus(null);
      }
    }

    if (!isTrackSelectionCurrent(selection)) return { playbackMode: 'full', audioSource: audioSourceRef.current };
    setResolvedAudioSource(audioUrl);
    if (!audioUrl || !isEncryptedAudioV2Ref(track.audioRef)) setAudioStartupStatus(null);

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

    return { playbackMode: 'full', audioSource: audioUrl };
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

  function explainRuntimeWriteWalletRequirement(): string | null {
    if (!connectedWallet) return null;
    if (runtimeAdapterConfig.kind === 'product-cdm') {
      return connectedWallet.method === 'product-host'
        ? null
        : 'This Product CDM build signs runtime transactions with the Polkadot Product account. Connect with "Use Polkadot app", then try again.';
    }
    return connectedWallet.createEvmClient
      ? null
      : 'This action still requires a passkey or EVM wallet while Dotify contract writes are being validated on the Product DevNet host signer.';
  }

  async function payForTrackAccess(
    track: CatalogTrack,
    socketEmit?: (event: string, data: unknown) => void,
    setLocalStreamReady?: (ready: boolean) => void,
    closeHostPeers?: () => void
  ) {
    const unlockStartedTrackId = track.id;
    const unlockStartedView = activeViewRef.current;
    const shouldRestoreUnlockedTrack = () => selectedTrackIdRef.current === unlockStartedTrackId && activeViewRef.current === unlockStartedView;

    if (!connectedWallet) {
      setAccessGate(buildAccessGateInfo(track));
      setShowWalletModal(true);
      return;
    }

    const walletRequirement = explainRuntimeWriteWalletRequirement();
    if (walletRequirement) {
      setAccessGate(buildAccessGateInfo(track));
      setTransactionFeedback({
        tone: 'error',
        title: 'Payment signer unavailable',
        message: walletRequirement
      });
      return;
    }

    if (isClassicUnlockE2e && track.id === E2E_CLASSIC_TRACK.id) {
      setAccessGate(null);
      setTransactionFeedback({
        tone: 'pending',
        title: 'Support being confirmed',
        message: `Confirming ${track.priceDot} ${nativeRuntimePaymentAsset.symbol} of support to open "${track.title}".`
      });
      await new Promise(resolve => window.setTimeout(resolve, 20));
      e2eClassicAccessGrantedRef.current = true;
      getClassicUnlockE2eState().paid = true;
      setCatalogAccessByTrackId(previous => ({ ...previous, [track.id]: true }));
      setCatalogPaidAccessByTrackId(previous => ({ ...previous, [track.id]: true }));
      setTransactionFeedback({
        ...buildClassicAccessVerifiedFeedback(track, E2E_CLASSIC_TX_HASH)
      });
      if (shouldRestoreUnlockedTrack()) {
        navigateToView('player');
        await selectTrack(track, socketEmit, setLocalStreamReady, closeHostPeers);
      }
      return;
    }

    const runtimeAddress = runtimeAddressFromTrackId(track);
    if (!runtimeAddress) {
      setAccessGate(null);
      setTransactionFeedback({
        tone: 'error',
        title: 'Payment setup failed',
        message: 'This track is missing its artist runtime address. Refresh the catalog and try again.'
      });
      return;
    }

    let paymentIntent;
    try {
      const chain = await resolveEvmChain(ethRpcUrl);
      paymentIntent = createNativeRuntimeAccessPaymentIntent({
        runtimeAddress,
        contentHash: track.hash,
        amountPlanck: classicTrackPaymentAmountPlanck(track),
        asset: nativeRuntimePaymentAssetFromChain(chain)
      });
    } catch (intentError) {
      setTransactionFeedback({
        tone: 'error',
        title: 'Payment setup failed',
        message: intentError instanceof Error ? intentError.message : 'Unable to prepare this payment.'
      });
      return;
    }

    setAccessGate(null);
    setTransactionFeedback({
      tone: 'pending',
      title: 'Support being confirmed',
      message: `Confirming ${track.priceDot} ${paymentIntent.asset.symbol} of support to open "${track.title}".`
    });

    let includedTxHash: `0x${string}` | null = null;

    try {
      const txHash = await runtimeWriter.payForAccess(paymentIntent);
      setTransactionFeedback({ tone: 'pending', title: 'Awaiting confirmation', message: 'Payment submitted.', txHash });
      await runtimeWriter.waitForTransaction(txHash);
      includedTxHash = txHash;

      setTransactionFeedback({
        tone: 'pending',
        title: 'Verifying runtime access',
        message:
          runtimeAdapterConfig.kind === 'product-cdm'
            ? 'Payment included. Reading the Product runtime before opening the track.'
            : 'Payment included. Reading the runtime before opening the track.',
        txHash
      });

      if (!listenerEvmAddress) {
        setTransactionFeedback({
          tone: 'error',
          title: 'Payment included, access not verified',
          message: 'The payment transaction was included, but Dotify cannot verify runtime access without the connected account address.',
          txHash
        });
        return;
      }

      const verification = await verifyRuntimeAccessPayment({
        reader: runtimeReader,
        intent: paymentIntent,
        listenerAddress: listenerEvmAddress
      });

      if (runtimeAdapterConfig.kind === 'product-cdm') {
        publishProductCdmPaymentSmokeMetric(
          buildProductCdmPaymentSmokeMetric({
            verification,
            txHash,
            runtimeAddress: paymentIntent.runtimeAddress,
            contentHash: paymentIntent.contentHash,
            listenerAddress: listenerEvmAddress,
            amountPlanck: paymentIntent.amountPlanck
          })
        );
      }

      if (!verification.ok) {
        setTransactionFeedback({
          tone: 'error',
          title: 'Payment included, access not verified',
          message: buildIncludedPaymentUnverifiedMessage({
            attempts: verification.attempts,
            error: verification.error,
            productCdm: runtimeAdapterConfig.kind === 'product-cdm'
          }),
          txHash
        });
        return;
      }

      setCatalogAccessByTrackId(previous => ({ ...previous, [track.id]: true }));
      setCatalogPaidAccessByTrackId(previous => ({ ...previous, [track.id]: true }));
      setTransactionFeedback(buildClassicAccessVerifiedFeedback(track, txHash));
      if (shouldRestoreUnlockedTrack()) {
        navigateToView('player');
        await selectTrack(track, socketEmit, setLocalStreamReady, closeHostPeers);
      }
    } catch (payError) {
      const message = payError instanceof Error ? payError.message : 'Payment failed';
      if (includedTxHash) {
        setTransactionFeedback({
          tone: 'error',
          title: 'Payment included, access not verified',
          message: `The payment transaction was included, but Dotify could not complete access verification: ${message}`,
          txHash: includedTxHash
        });
        return;
      }
      setTransactionFeedback({ tone: 'error', title: 'Payment failed', message });
    }
  }

  async function fetchRuntimeCatalog(reader: RuntimeReadPort, artistAddress: `0x${string}`, runtimeAddress: `0x${string}`): Promise<RegistryCatalogTrack[]> {
    const snapshots = await reader.listRuntimeTracks(runtimeAddress);
    const tracks = snapshots.map((snapshot: RuntimeTrackSnapshot): RegistryCatalogTrack => {
      const { hash, record: track } = snapshot;
      const imageRef = resolveVisualAssetRef(track.imageRef, track.title);
      const encrypted = isEncryptedAudioRef(track.audioRef);
      const localUrl = resolveAudioAssetRef(track.audioRef);

      return {
        id: `${runtimeAddress}:${hash}`,
        hash,
        title: track.title,
        artist: track.artistName,
        artistAddress: track.artist || artistAddress,
        audioRef: track.audioRef,
        imageRef,
        priceDot: formatWeiAsDot(track.pricePlanck),
        pricePlanck: track.pricePlanck,
        localUrl,
        description: track.description,
        bulletinRef: track.metadataRef.startsWith('paseo-bulletin:') ? track.metadataRef : '',
        metadataRef: track.metadataRef,
        royaltyBps: Number(track.royaltyBps),
        txHash: undefined,
        durationLabel: 'ready',
        accessMode: decodeAccessMode(Number(track.accessMode)),
        active: track.active,
        source: 'artist' as const,
        royaltySplits: snapshot.royaltySplits.map((split, splitIndex) => ({
          label: splitIndex === 0 ? 'Primary recipient' : `Split ${splitIndex + 1}`,
          ...split
        })),
        personhoodLevel: decodePersonhood(Number(track.requiredPersonhood)),
        zone: 'Registry',
        encrypted,
        registeredAtBlock: Number(track.registeredAtBlock)
      };
    });

    return tracks;
  }

  function commitCatalog(allTracks: CatalogTrack[], preferredTrackHash: `0x${string}` | undefined, status: string): CatalogTrack[] {
    const nextCatalog = allTracks.filter(track => track.active !== false);
    setAllCatalogTracks(allTracks);
    setCatalogTracks(nextCatalog);
    setSelectedTrackId(previous => {
      const preferredTrack = preferredTrackHash ? nextCatalog.find(track => track.hash.toLowerCase() === preferredTrackHash.toLowerCase()) : null;
      if (preferredTrack) return preferredTrack.id;
      return nextCatalog.some(track => track.id === previous) ? previous : (nextCatalog[0]?.id ?? '');
    });
    setCatalogStatus(status);
    return nextCatalog;
  }

  async function refreshCatalogFromRegistry(preferredTrackHash?: `0x${string}`) {
    if (isClassicUnlockE2e || isArtistPublishE2e || isRoomJoinE2e) {
      const nextCatalog = getDeterministicE2eCatalogTracks();
      setAllCatalogTracks(nextCatalog);
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

    if (usesCatalogApi) {
      if (allCatalogTracks.length === 0) setCatalogStatus('Loading registry catalog');
      try {
        const response = await fetchCatalog({ includeInactive: true, limit: 100 });
        const apiTracks = response.items.map(catalogApiReleaseToTrack);
        const allTracks = response.meta.cacheAvailable || allCatalogTracks.length === 0 ? apiTracks : allCatalogTracks;
        return commitCatalog(allTracks, preferredTrackHash, catalogApiStatus(response.meta, allTracks.filter(track => track.active !== false).length));
      } catch (catalogError) {
        console.warn('Failed to load catalog API', catalogError);
        setCatalogStatus(allCatalogTracks.length > 0 ? 'Showing saved catalog while the catalog API reconnects' : catalogLoadFailureStatus(catalogError));
        return catalogTracks;
      }
    }

    if (!directoryAddress) {
      setCatalogTracks([]);
      setAllCatalogTracks([]);
      setSelectedTrackId('');
      setCatalogStatus('Registry directory not configured');
      return [];
    }

    setCatalogStatus('Loading registry catalog');

    try {
      const directoryExists = await runtimeReader.ensureContract(directoryAddress);
      if (!directoryExists) {
        setCatalogTracks([]);
        setAllCatalogTracks([]);
        setSelectedTrackId('');
        setCatalogStatus('Registry directory unavailable');
        return [];
      }

      const artistCount = await runtimeReader.getArtistCount(directoryAddress);

      if (artistCount === 0n) {
        setCatalogTracks([]);
        setAllCatalogTracks([]);
        setSelectedTrackId('');
        setCatalogStatus('No tracks registered on this directory yet');
        return [];
      }

      const entries = await runtimeReader.listArtistRuntimes(directoryAddress, artistCount);
      const runtimeCatalogs = await Promise.all(
        entries.map(async entry => {
          try {
            return await fetchRuntimeCatalog(runtimeReader, entry.artist, entry.runtime);
          } catch (runtimeError) {
            console.warn(`Failed to load runtime catalog for ${entry.runtime}`, runtimeError);
            return [];
          }
        })
      );
      const allTracks = runtimeCatalogs
        .flat()
        .sort((left, right) => {
          if (left.registeredAtBlock !== right.registeredAtBlock) {
            return right.registeredAtBlock - left.registeredAtBlock;
          }
          return left.title.localeCompare(right.title);
        })
        .map(({ registeredAtBlock: _registeredAtBlock, ...track }): CatalogTrack => track);
      const nextCatalog = allTracks.filter(track => track.active !== false);

      return commitCatalog(
        allTracks,
        preferredTrackHash,
        nextCatalog.length > 0
          ? `Loaded ${nextCatalog.length} registered track${nextCatalog.length > 1 ? 's' : ''}`
          : 'No tracks registered on this directory yet'
      );
    } catch (catalogError) {
      console.warn('Failed to load registry catalog', catalogError);
      setCatalogTracks([]);
      setAllCatalogTracks([]);
      setSelectedTrackId('');
      setCatalogStatus(catalogLoadFailureStatus(catalogError));
      return [];
    }
  }

  function clearObjectUrls() {
    abortActiveTrackSelection();
    for (const url of objectUrlsRef.current.values()) {
      URL.revokeObjectURL(url);
    }
    resolvedAudioSourcesRef.current.clear();
  }

  return {
    // State
    catalogTracks,
    allCatalogTracks,
    catalogStatus,
    selectedTrackId,
    setSelectedTrackId,
    catalogAccessByTrackId,
    setCatalogAccessByTrackId,
    catalogPaidAccessByTrackId,
    setCatalogPaidAccessByTrackId,
    nativeRuntimePaymentAsset,
    usesCatalogApi,
    audioSource,
    setAudioSource: setResolvedAudioSource,
    audioStartupStatus,
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
    fetchRuntimeCatalog,
    clearObjectUrls
  };
}
