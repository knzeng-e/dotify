import { StandbyAudio } from '../features/player/standbyAudio';
import { publishStreamingStartupMetric, type StreamingStartupMetric } from '../features/catalog/audioStartupTelemetry';
import { createStreamingPlayback } from '../features/catalog/streamingPlayback';
import { registerAudioGain, forgetAudioGain } from '../features/player/audioNormalization';
import { resolveDonationArtist } from '../features/donations/donationModel';
import type { RoomTrackEmitter } from '../features/rooms/roomRealtimePort';
import { retireHostAudio } from '../features/player/hostAudioOutput';
import { captureAudioContinuation, type AudioContinuation } from '../features/player/audioContinuation';
import { formatEther } from 'viem';
import { createSupportPaymentFlow } from '../features/payments/supportPayment';
import { browserPaymentLock, persistentPaymentJournal } from '../features/payments/paymentJournal';
import type { PaymentAccountState } from '../features/payments/paymentModel';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getGatewayUrl, type ProtectedAudioUpload } from '../services/pinata';
import { resolveEvmChain } from '../shared/config/contracts';
import { hexToBytes } from '../shared/utils/crypto';
import { formatWeiAsDot, normalizeDisplayText, shorten, shortenAddress } from '../shared/utils/format';
import {
  isKeyServiceConfigured,
  requestContentKey,
  prepareContentKeys,
  readPreparedContentKey,
  requestFreeContentKey,
  type ContentKeyReleaseIdentity,
  type KeyRequestPurpose
} from '../services/keyService';
import { contentKeyVersionForAudioRef, encryptedRefToCID, isEncryptedAudioRef, isEncryptedAudioV3Ref } from '../shared/utils/protectedAudio';
import { isPolicyManagedTrack } from '../features/access/accessPolicy';
import { buildAccessGate, buildClassicAccessVerifiedFeedback, buildClassicSupportFacts } from '../features/access/accessPromise';
import { catalogApiStatus, catalogLoadFailureStatus } from '../features/catalog/catalogStatus';
import { prefetchStreamingAudio } from '../features/catalog/streamingPrefetch';
import { runtimeAddressFromTrackId } from '../features/catalog/trackModel';
import {
  DOTIFY_FALLBACK_NATIVE_RUNTIME_ASSET,
  DOTIFY_PRODUCT_DEVNET_NATIVE_RUNTIME_ASSET,
  classicTrackPaymentAmountPlanck,
  createRuntimeNativeAccessPaymentIntent,
  nativeRuntimePaymentAssetFromChain
} from '../features/payments/paymentModel';
import { type RuntimeAccessPaymentVerificationResult } from '../features/payments/paymentReadback';
import { decodeAccessMode, decodePersonhood } from '../features/runtime/accessEncoding';
import { PRODUCT_DEVNET_EVM_CHAIN_ID, resolveRuntimeAdapterConfig } from '../features/runtime/runtimeAdapterConfig';
import { createRuntimeReader } from '../features/runtime/runtimeReaderProvider';
import { createRuntimeWriter } from '../features/runtime/runtimeWriterProvider';
import type { RuntimeReadPort, RuntimeTrackSnapshot } from '../features/runtime/runtimePorts';
import { resolveProductHostConfig } from '../features/productHost/productHost';
import { publishProductCdmPaymentSmokeMetric, type ProductCdmPaymentSmokeMetric } from '../features/productHost/productCdmHostSmokeEvidence';
import { captureProductAccessReadback } from '../features/productHost/productAccessReadback';
import { publishHostAudioStartupMetric, type HostAudioTerminalReason } from '../features/catalog/audioStartupTelemetry';
import {
  PROTECTED_PLAYBACK_RETRY_DELAYS_MS,
  ProtectedPlaybackError,
  classifyProtectedPlaybackFailure,
  isTransientProtectedPlaybackFailure,
  type ProtectedPlaybackFailure,
  type ProtectedPlaybackFailureKind
} from '../features/catalog/protectedPlaybackFailure';
import {
  fetchCatalog,
  isAuthoritativeCatalogResponse,
  isCatalogApiConfigured,
  readBundledCatalog,
  readCachedCatalog,
  type CatalogApiRelease
} from '../services/catalog';
import { createCoverFallbackDataUri } from '../features/catalog/coverArtwork';
import {
  E2E_CLASSIC_AUDIO_URL,
  E2E_CLASSIC_HASH,
  E2E_CLASSIC_TRACK,
  classicSupportE2ePorts,
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
  TransactionFeedbackFact,
  View
} from '../shared/types';
import type { ConnectedWallet } from './useWallet';

const zeroAddress = '0x0000000000000000000000000000000000000000' as const;
const AUDIO_STARTUP_TIMEOUT_MS = 60_000;

export type TrackSelectionResult = {
  playbackMode: RoomPlaybackMode;
  audioSource: string | null;
};

type ActiveTrackSelection = {
  id: number;
  attemptId: string;
  controller: AbortController;
  source: string;
  startedAt: number;
  pending: boolean;
  terminalReported: boolean;
  startupDeadline?: ReturnType<typeof setTimeout>;
};

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
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
    timestamp: wallTimestamp()
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
    title: normalizeDisplayText(title) || 'Untitled',
    artist: normalizeDisplayText(artist) || 'Unknown artist',
    hash,
    bulletinRef,
    duration,
    updatedAt: Date.now(),
    ...metadata
  };
}

function normalizeCatalogTrackDisplay(track: CatalogTrack): CatalogTrack {
  return {
    ...track,
    title: normalizeDisplayText(track.title) || 'Untitled',
    artist: normalizeDisplayText(track.artist) || 'Unknown artist'
  };
}

function createTrackInfoFromCatalog(track: CatalogTrack): TrackInfo {
  return createTrackInfo(track.title, track.artist, track.hash, track.bulletinRef, track.duration ?? 0, {
    runtimeAddress: runtimeAddressFromTrackId(track) ?? undefined,
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
  return normalizeCatalogTrackDisplay({
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
  });
}

function releaseIdentityFromTrack(track: CatalogTrack): ContentKeyReleaseIdentity | undefined {
  if (track.source !== 'artist' || !track.artistAddress || !isEncryptedAudioRef(track.audioRef)) return undefined;
  const runtimeAddress = runtimeAddressFromTrackId(track);
  const keyVersion = contentKeyVersionForAudioRef(track.audioRef);
  if (!runtimeAddress || !keyVersion) return undefined;
  return {
    releaseId: `${runtimeAddress}:${track.hash}`,
    runtimeAddress,
    artistAddress: track.artistAddress,
    audioRef: track.audioRef,
    keyVersion
  };
}

export type UseCatalogDeps = {
  ethRpcUrl: string;
  listenerEvmAddress: `0x${string}` | null;
  connectedWallet: ConnectedWallet | null;
  directoryAddress: `0x${string}` | undefined;
  openSupportWalletModal: () => void;
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

// Imperative event clocks/IDs, never evaluated by the render path.
function wallTimestamp() {
  return Date.now();
}
function newOperationId() {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

export function useCatalog(deps: UseCatalogDeps) {
  const {
    ethRpcUrl,
    listenerEvmAddress,
    connectedWallet,
    directoryAddress,
    openSupportWalletModal,
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

  const [supportFlow] = useState(() => {
    const journal = persistentPaymentJournal(
      () => window.localStorage,
      () => window.sessionStorage
    );
    return createSupportPaymentFlow(() => journal, browserPaymentLock);
  });
  const supportBusyRef = useRef(false);
  const supportAccount = `${connectedWallet?.method ?? ''}:${listenerEvmAddress?.toLowerCase() ?? ''}`;
  const supportAccountRef = useRef(supportAccount);
  useLayoutEffect(() => {
    supportAccountRef.current = supportAccount;
  }, [supportAccount]);
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
  const [catalogIsAuthoritative, setCatalogIsAuthoritative] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [catalogAccessByTrackId, setCatalogAccessByTrackId] = useState<Record<string, boolean>>({});
  const [catalogPaidAccessByTrackId, setCatalogPaidAccessByTrackId] = useState<Record<string, boolean>>({});
  const [nativeRuntimePaymentAsset, setNativeRuntimePaymentAsset] = useState(() =>
    runtimeAdapterConfig.kind === 'product-cdm' ? DOTIFY_PRODUCT_DEVNET_NATIVE_RUNTIME_ASSET : DOTIFY_FALLBACK_NATIVE_RUNTIME_ASSET
  );
  const [standbyAudio] = useState(() => new StandbyAudio());
  const [audioSource, setAudioSource] = useState<string | null>(null);
  const [audioSourceGeneration, setAudioSourceGeneration] = useState(0);
  const [audioContinuation, setAudioContinuation] = useState<AudioContinuation | null>(null);
  const [audioRecovery, setAudioRecovery] = useState<'recovering' | 'failed' | null>(null);
  const [audioStartupAttemptId, setAudioStartupAttemptId] = useState<string | null>(null);
  const [trackSelectionPending, setTrackSelectionPending] = useState(false);
  const [audioSourcePending, setAudioSourcePending] = useState(false);
  const [trackInfo, setTrackInfo] = useState<TrackInfo | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [accessGate, setAccessGate] = useState<AccessGate | null>(null);
  const [audioStartupStatus, setAudioStartupStatus] = useState<string | null>(null);
  const [playbackFailure, setPlaybackFailure] = useState<ProtectedPlaybackFailure | null>(null);
  const [fileHash, setFileHashState] = useState<`0x${string}` | ''>('');
  const [audioCID, setAudioCID] = useState('');
  const [coverCID, setCoverCID] = useState('');
  const [coverSource, setCoverSource] = useState(() => createCoverFallbackDataUri('Dotify', 'resting'));

  const objectUrlsRef = useRef<Set<string>>(new Set());
  const resolvedAudioSourcesRef = useRef<Map<string, string>>(new Map());
  // MediaSource URLs belong to one selection; only complete Blobs are reusable.
  const mseObjectUrlsRef = useRef<Set<string>>(new Set());
  const audioSourceRef = useRef<string | null>(null);
  const pendingTrackMediaSourceRef = useRef<string | null>(null);
  const audioUploadRef = useRef<Promise<ProtectedAudioUpload> | null>(null);
  const coverUploadRef = useRef<Promise<string> | null>(null);
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const selectedTrackIdRef = useRef(selectedTrackId);
  const activeViewRef = useRef(activeView);
  const activeTrackSelectionRef = useRef<ActiveTrackSelection | null>(null);
  const nextTrackSelectionIdRef = useRef(0);
  const e2eClassicAccessGrantedRef = useRef(false);
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
    // Product CDM has one supported environment (DevNet/Paseo). Its asset is
    // known at build time, and opening a room or catalog must not trigger an
    // unrelated direct EVM RPC request just to rediscover the PAS label.
    if (runtimeAdapterConfig.kind === 'product-cdm') {
      setNativeRuntimePaymentAsset(DOTIFY_PRODUCT_DEVNET_NATIVE_RUNTIME_ASSET);
      return;
    }

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
  }, [ethRpcUrl, runtimeAdapterConfig.kind]);

  function internalSetFileHash(hash: `0x${string}` | '') {
    setFileHashState(hash);
  }

  function setResolvedAudioSource(source: string | null, continuePlayback = false) {
    setAudioContinuation(source && continuePlayback ? captureAudioContinuation(localAudioRef.current, source) : null);
    // Capture can materialize a URL before its first canplay; readiness must
    // then follow the replacement rather than wait forever for the old URL.
    if (audioSourceRef.current && pendingTrackMediaSourceRef.current === audioSourceRef.current) {
      pendingTrackMediaSourceRef.current = source;
    }
    audioSourceRef.current = source;
    setAudioSource(source);
    // A resolved source owns one media-element lifetime. Increment even when
    // the URL is reused so an obsolete element cannot deliver a native media
    // error into a later selection of the same source.
    setAudioSourceGeneration(value => value + 1);
  }

  function retireStreamingObjectUrl(audioRef: string, objectUrl: string) {
    mseObjectUrlsRef.current.delete(objectUrl);
    if (resolvedAudioSourcesRef.current.get(audioRef) === objectUrl) {
      resolvedAudioSourcesRef.current.delete(audioRef);
    }
    if (objectUrlsRef.current.delete(objectUrl)) {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    }
  }

  function retireActiveTrackSelection(reportCancellation: boolean) {
    const activeSelection = activeTrackSelectionRef.current;
    if (activeSelection && reportCancellation && activeSelection.pending && !activeSelection.terminalReported && !activeSelection.controller.signal.aborted) {
      activeSelection.terminalReported = true;
      publishHostAudioStartupMetric({
        phase: 'error',
        attemptId: activeSelection.attemptId,
        source: activeSelection.source,
        elapsedMs: Number((nowMs() - activeSelection.startedAt).toFixed(1)),
        timestamp: wallTimestamp(),
        terminalReason: 'selection-interrupted'
      });
    }
    clearTimeout(activeSelection?.startupDeadline);
    activeSelection?.controller.abort();
    activeTrackSelectionRef.current = null;
    pendingTrackMediaSourceRef.current = null;
  }

  function beginTrackSelection(source: string, startedAt: number) {
    // A new choice ends the previous in-flight attempt. Publish its terminal
    // event before the next playback intent so evidence correlation does not
    // strand an interrupted attempt in "Timing active".
    retireActiveTrackSelection(true);
    setAudioRecovery(null);
    setAudioContinuation(null);
    setTrackSelectionPending(true);
    setAudioSourcePending(true);
    const id = (nextTrackSelectionIdRef.current += 1);
    const selection: ActiveTrackSelection = {
      id,
      attemptId: `selection:${id}`,
      controller: new AbortController(),
      source,
      startedAt,
      pending: true,
      terminalReported: false
    };
    activeTrackSelectionRef.current = selection;
    setAudioStartupAttemptId(selection.attemptId);
    return selection;
  }

  function armAudioStartupDeadline(selection: ActiveTrackSelection) {
    if (!isTrackSelectionCurrent(selection) || selection.startupDeadline !== undefined) return;
    // Start after authorization, so waiting for a wallet signature consumes no
    // media budget. Bound retries, compatibility downloads and native readiness
    // together; a transport that keeps dribbling bytes must not trap the UI.
    selection.startupDeadline = setTimeout(() => {
      if (!isTrackSelectionCurrent(selection) || !selection.pending) return;
      selection.terminalReported = true;
      publishHostAudioStartupMetric({
        phase: 'error',
        attemptId: selection.attemptId,
        source: selection.source,
        elapsedMs: Number((nowMs() - selection.startedAt).toFixed(1)),
        timestamp: wallTimestamp(),
        terminalReason: 'selection-failed'
      });
      retireActiveTrackSelection(false);
      if (localAudioRef.current) retireHostAudio(localAudioRef.current);
      setResolvedAudioSource(null);
      setAudioSourcePending(false);
      setTrackSelectionPending(false);
      setAudioRecovery(null);
      setAudioStartupStatus(null);
      setPlaybackFailure({ trackId: selection.source, kind: 'audio-unavailable' });
    }, AUDIO_STARTUP_TIMEOUT_MS);
  }

  function isTrackSelectionCurrent(selection: ActiveTrackSelection): boolean {
    return activeTrackSelectionRef.current?.id === selection.id && !selection.controller.signal.aborted;
  }

  function abortActiveTrackSelection() {
    retireActiveTrackSelection(true);
    setAudioSourcePending(false);
    setTrackSelectionPending(false);
  }

  function cancelPlaybackPreparation() {
    if (!activeTrackSelectionRef.current?.pending || (localAudioRef.current?.readyState ?? 0) >= 3) return;
    abortActiveTrackSelection();
    setResolvedAudioSource(null);
    setAudioRecovery(null);
    setAudioStartupStatus(null);
    setPlaybackFailure(null);
  }

  function settleTrackSelectionMedia(source: string | null, terminal = false, attemptId: string | null = null) {
    if (!source) return;
    // `canplay` makes transport usable, but it is not terminal evidence: the
    // following play can still be rejected or the listener can replace the
    // track before a frame is heard. Keep cancellation armed until playing or
    // an explicit playback error closes the startup attempt.
    if (terminal && audioSourceRef.current === source && activeTrackSelectionRef.current && activeTrackSelectionRef.current.attemptId === attemptId) {
      activeTrackSelectionRef.current.pending = false;
    }
    if (pendingTrackMediaSourceRef.current !== source) return;
    clearTimeout(activeTrackSelectionRef.current?.startupDeadline);
    pendingTrackMediaSourceRef.current = null;
    setTrackSelectionPending(false);
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
      return getClassicUnlockE2eState().paid;
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

  function buildSupportAccountFacts(): TransactionFeedbackFact[] {
    if (!connectedWallet || !listenerEvmAddress) return [];

    if (connectedWallet.method === 'product-host') {
      const facts: TransactionFeedbackFact[] = [
        {
          label: 'Paying as',
          value: connectedWallet.displayName ?? connectedWallet.label
        }
      ];

      if (connectedWallet.substrateAddress) {
        facts.push({
          label: 'Fund this account',
          value: shorten(connectedWallet.substrateAddress, 10),
          code: true,
          copyValue: connectedWallet.substrateAddress,
          copyLabel: 'Copy account to fund'
        });
      }

      facts.push({
        label: 'Runtime identity',
        value: shortenAddress(listenerEvmAddress),
        code: true,
        copyValue: listenerEvmAddress,
        copyLabel: 'Copy runtime identity'
      });

      return facts;
    }

    return [
      {
        label: 'Paying wallet',
        value: shortenAddress(listenerEvmAddress),
        code: true,
        copyValue: listenerEvmAddress,
        copyLabel: 'Copy paying wallet'
      }
    ];
  }

  function buildSupportFacts(
    track: CatalogTrack,
    asset: typeof nativeRuntimePaymentAsset,
    status: Parameters<typeof buildClassicSupportFacts>[2],
    accountState?: PaymentAccountState
  ): TransactionFeedbackFact[] {
    const amount = classicTrackPaymentAmountPlanck(track);
    return [
      { label: 'Track', value: track.title },
      { label: 'Artist', value: track.artist },
      ...buildSupportAccountFacts().filter(fact => fact.label === 'Paying as' || fact.label === 'Paying wallet'),
      ...buildClassicSupportFacts(track, asset, status).filter(fact => fact.label === 'Amount'),
      ...(status === 'pending'
        ? [
            {
              label: 'Known total',
              value: `${formatEther(amount + (accountState?.estimatedFee ?? 0n))} ${asset.symbol}${accountState?.estimatedFee === undefined ? ' + network fee' : ' (estimated)'}`
            },
            {
              label: 'Network fee',
              value:
                accountState?.estimatedFee === undefined
                  ? 'Not available yet. Review the fee before signing.'
                  : `${formatEther(accountState.estimatedFee)} ${asset.symbol} (estimated)`
            },
            {
              label: 'Available balance',
              value: accountState?.availableBalance === undefined ? 'Unavailable' : `${formatEther(accountState.availableBalance)} ${asset.symbol}`
            }
          ]
        : []),
      ...buildClassicSupportFacts(track, asset, status).filter(fact => fact.label === 'Access')
    ];
  }

  function buildSupportTechnicalFacts(
    track: CatalogTrack,
    asset: typeof nativeRuntimePaymentAsset,
    status: Parameters<typeof buildClassicSupportFacts>[2]
  ): TransactionFeedbackFact[] {
    return [
      ...buildSupportAccountFacts().filter(fact => fact.label !== 'Paying as' && fact.label !== 'Paying wallet'),
      ...buildClassicSupportFacts(track, asset, status).filter(fact => fact.label === 'Recipients' || fact.label === 'Settlement'),
      { label: 'Runtime', value: runtimeAddressFromTrackId(track) ?? 'Unavailable', code: true }
    ];
  }

  /**
   * Obtain the per-track content key from the backend key service.
   * Returns null only when the backend key service is not configured.
   * Configured-service failures travel with their invocation as thrown errors;
   * concurrent requests never share mutable failure state.
   */
  async function resolveServerContentKey(contentHash: `0x${string}`, release?: ContentKeyReleaseIdentity): Promise<Uint8Array | null> {
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

    if (!isKeyServiceConfigured()) return null;
    if (!connectedWallet || (!connectedWallet.createEvmClient && !connectedWallet.keyRequestSigner)) {
      throw new ProtectedPlaybackError('account-required', 'No connected account can request protected playback.');
    }

    const walletClient = connectedWallet.keyRequestSigner ? null : await getActiveWalletClient();
    const chainId = walletClient?.chain?.id ?? PRODUCT_DEVNET_EVM_CHAIN_ID;
    const response = await requestContentKey({
      contentHash,
      purpose: keyRequestPurposeRef.current,
      ...(connectedWallet.keyRequestSigner ? { signer: connectedWallet.keyRequestSigner } : { walletClient: walletClient! }),
      chainId,
      release
    });
    if (response.access !== 'allowed') {
      throw new ProtectedPlaybackError('access-not-confirmed', response.message);
    }
    const keyBytes = hexToBytes(response.contentKey);
    return keyBytes;
  }

  /**
   * Obtain the content key for a Free track: no wallet, no signature. The
   * backend re-verifies the mode on-chain before releasing anything, so this
   * cannot open a paid or human-gated track.
   */
  async function resolveFreeContentKey(contentHash: `0x${string}`, release?: ContentKeyReleaseIdentity): Promise<Uint8Array | null> {
    if (!isKeyServiceConfigured()) return null;

    const response = await requestFreeContentKey(contentHash, release, keyRequestPurposeRef.current);
    if (response.access !== 'allowed') {
      throw new ProtectedPlaybackError('access-not-confirmed', response.message);
    }
    const keyBytes = hexToBytes(response.contentKey);
    return keyBytes;
  }

  async function prepareStreamingAudio(
    audioRef: string,
    contentHash: `0x${string}`,
    accessMode: AccessMode,
    release: ContentKeyReleaseIdentity | undefined,
    signal?: AbortSignal,
    isCurrent: () => boolean = () => true,
    options?: { key: Uint8Array; audio: () => HTMLAudioElement; speculative: true },
    onAuthorized?: () => void
  ): Promise<string> {
    throwIfAborted(signal);
    if (isClassicUnlockE2e && contentHash.toLowerCase() === E2E_CLASSIC_HASH.toLowerCase()) {
      const serverKey = await resolveServerContentKey(contentHash, release);
      throwIfAborted(signal);
      if (!serverKey) throw new Error('E2E full key request denied before payment.');
      return E2E_CLASSIC_AUDIO_URL;
    }

    if (isRoomJoinE2eProtectedHash(contentHash)) {
      const serverKey = await resolveServerContentKey(contentHash, release);
      throwIfAborted(signal);
      if (!serverKey) throw new Error('E2E room host is not authorized for full playback.');
      return E2E_ROOM_PROTECTED_AUDIO_URL;
    }

    const cacheKey = audioRef;
    const cached = resolvedAudioSourcesRef.current.get(cacheKey);
    if (cached) {
      if (!options?.speculative) setAudioStartupStatus('Starting audio');
      return cached;
    }

    if (isEncryptedAudioV3Ref(audioRef)) {
      if (!release) throw new Error('The release identity is required for streaming playback.');
      const controllerSignal = signal ?? new AbortController().signal;
      const startedAt = performance.now();
      const metric = (detail: Omit<StreamingStartupMetric, 'audioRef' | 'cid' | 'elapsedMs' | 'timestamp'>) => {
        if (!options?.speculative && isCurrent() && !controllerSignal.aborted)
          publishStreamingStartupMetric({
            ...detail,
            audioRef,
            cid: encryptedRefToCID(audioRef),
            elapsedMs: performance.now() - startedAt,
            timestamp: wallTimestamp()
          });
      };
      const key =
        options?.key ?? (accessMode === 'free' ? await resolveFreeContentKey(contentHash, release) : await resolveServerContentKey(contentHash, release));
      controllerSignal.throwIfAborted();
      if (!key) throw new Error('The audio access check could not be completed.');
      onAuthorized?.();
      metric({ phase: 'key-authorized' });
      if (!options?.speculative) setAudioStartupStatus('Preparing audio');
      const prepared = await createStreamingPlayback({
        cid: encryptedRefToCID(audioRef),
        key,
        scope: {
          chainId: runtimeAdapterConfig.kind === 'product-cdm' ? PRODUCT_DEVNET_EVM_CHAIN_ID : (await resolveEvmChain(ethRpcUrl)).id,
          runtimeAddress: release.runtimeAddress.toLowerCase(),
          contentHash: contentHash.toLowerCase(),
          keyVersion: release.keyVersion
        },
        signal: controllerSignal,
        onMetric: metric,
        audio: options?.audio ?? (() => localAudioRef.current),
        bufferAheadSeconds: options ? () => (options.audio().isConnected ? 30 : 4) : undefined,
        onError: () => {
          if ((!options?.speculative || options.audio().isConnected) && isCurrent()) {
            setAudioRecovery('failed');
            setAudioStartupStatus('Audio connection interrupted');
          }
        }
      });
      if (controllerSignal.aborted || !isCurrent()) {
        URL.revokeObjectURL(prepared.url);
        controllerSignal.throwIfAborted();
        throw new Error('Track selection changed');
      }
      registerAudioGain(prepared.url, prepared.gainDb);
      objectUrlsRef.current.add(prepared.url);
      if (prepared.progressive) mseObjectUrlsRef.current.add(prepared.url);
      else resolvedAudioSourcesRef.current.set(cacheKey, prepared.url);
      controllerSignal.addEventListener(
        'abort',
        () => {
          if (prepared.progressive) {
            forgetAudioGain(prepared.url);
            retireStreamingObjectUrl(audioRef, prepared.url);
          }
        },
        { once: true }
      );
      return prepared.url;
    }

    throw new Error('This audio format is no longer supported. Publish this track again from your artist space.');
  }

  async function selectTrack(
    track: CatalogTrack,
    socketEmit?: RoomTrackEmitter,
    setLocalStreamReady?: (ready: boolean) => void,
    closeHostPeers?: () => void,
    showAccessGateOnDenied = false
  ): Promise<TrackSelectionResult> {
    const selectionStartedAt = nowMs();
    const selection = beginTrackSelection(track.id, selectionStartedAt);
    // Resolve the destination purpose before comparing a prepared identity.
    // A solo candidate cannot be adopted for a room-host request (or vice versa).
    keyRequestPurposeRef.current = socketEmit ? 'room_host' : 'individual';
    // Transfer ownership before pausing the outgoing element triggers speculative
    // cancellation. A protected candidate still requires a live W34 grant.
    const canAdopt =
      track.active !== false &&
      (!isPolicyManagedTrack(track) ||
        (track.encrypted &&
          (track.accessMode === 'free' ||
            readPreparedContentKey(track.hash, releaseIdentityFromTrack(track), keyRequestPurposeRef.current)?.access === 'allowed')));
    const warmSource = canAdopt ? standbyAudio.take(standbyIdentity(track), selection.controller.signal) : null;
    if (!canAdopt) standbyAudio.clear();
    publishHostAudioStartupMetric({
      phase: 'playback-intent',
      attemptId: selection.attemptId,
      source: track.id,
      elapsedMs: 0,
      timestamp: wallTimestamp()
    });
    if (warmSource && isEncryptedAudioV3Ref(track.audioRef))
      publishStreamingStartupMetric({
        phase: 'prepared-source-adopted',
        audioRef: track.audioRef,
        cid: encryptedRefToCID(track.audioRef),
        elapsedMs: 0,
        timestamp: wallTimestamp()
      });
    let selectionFailureReported = false;
    const reportSelectionFailure = (terminalReason: HostAudioTerminalReason) => {
      if (selectionFailureReported || !isTrackSelectionCurrent(selection)) return;
      selectionFailureReported = true;
      selection.terminalReported = true;
      publishHostAudioStartupMetric({
        phase: 'error',
        attemptId: selection.attemptId,
        source: track.id,
        elapsedMs: Number((nowMs() - selectionStartedAt).toFixed(1)),
        timestamp: wallTimestamp(),
        terminalReason
      });
    };
    let waitsForMediaReadiness = false;

    try {
      // Stop the outgoing track immediately. Resolving the new source (access
      // check + decrypt/fetch) is async, so without this the old audio keeps
      // playing for the whole gap while the cover and title already show the new
      // track. The playback controller owns whether the new source starts.
      const outgoingAudio = localAudioRef.current;
      // Invalidate the old DOM source synchronously too: a capture fetch may
      // still resolve while the next selection is checking access.
      if (outgoingAudio) retireHostAudio(outgoingAudio);

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
      setPlaybackFailure(null);
      setAudioStartupStatus(track.encrypted ? 'Checking your access…' : null);
      // Access model v2: access is binary. An authorized listener plays the full
      // track; an unauthorized one gets the access gate and no audio at all. The
      // 42% preview is retired.
      let audioUrl: string | null = null;
      let hasAccess = true;

      const preparedGrant = track.encrypted ? readPreparedContentKey(track.hash, releaseIdentityFromTrack(track), keyRequestPurposeRef.current) : null;
      // Readiness is not authorization. Non-encrypted policy-managed sources
      // have no key grant and must always take the ordinary runtime check.
      if (isPolicyManagedTrack(track) && (!track.encrypted || (!preparedGrant && !warmSource))) {
        hasAccess = await checkTrackAccess(track, listenerEvmAddress);
        if (!isTrackSelectionCurrent(selection)) return { playbackMode: 'full', audioSource: audioSourceRef.current };
        const smokeRuntime = runtimeAddressFromTrackId(track);
        if (
          runtimeAdapterConfig.kind === 'product-cdm' &&
          connectedWallet?.method === 'product-host' &&
          track.accessMode === 'classic' &&
          listenerEvmAddress &&
          smokeRuntime
        ) {
          const accountAtRead = supportAccountRef.current;
          await captureProductAccessReadback({
            reader: runtimeReader,
            buildSha: import.meta.env.VITE_DOTIFY_BUILD_SHA,
            productAppVersion: import.meta.env.VITE_DOTIFY_PRODUCT_APP_VERSION,
            chainId: PRODUCT_DEVNET_EVM_CHAIN_ID,
            runtimeAddress: smokeRuntime,
            contentHash: track.hash,
            listenerAddress: listenerEvmAddress,
            isCurrent: () => isTrackSelectionCurrent(selection) && supportAccountRef.current === accountAtRead
          });
          if (!isTrackSelectionCurrent(selection) || supportAccountRef.current !== accountAtRead)
            return { playbackMode: 'full', audioSource: audioSourceRef.current };
        }
        setCatalogAccessByTrackId(previous => ({ ...previous, [track.id]: hasAccess }));
        if (!hasAccess) {
          // A room host has just chosen this release from the lineup, so the
          // access explanation is the direct result of that explicit action.
          // Solo browsing stays calm until the listener presses the cover CTA.
          if (showAccessGateOnDenied) setAccessGate(buildAccessGateInfo(track));
          setAudioStartupStatus(null);
        }
      }

      if (hasAccess && track.localUrl) {
        let failureKind: ProtectedPlaybackFailureKind | null = null;
        if (warmSource) audioUrl = warmSource;
        else if (track.encrypted) {
          // Transient failures (service out of reach, access not propagated
          // yet, slow gateway) retry quietly. Failed key requests repeat
          // authorization; transport retries reuse an already authorized key.
          for (let attempt = 0; ; attempt += 1) {
            try {
              audioUrl = await prepareStreamingAudio(
                track.audioRef,
                track.hash,
                track.accessMode,
                releaseIdentityFromTrack(track),
                selection.controller.signal,
                () => isTrackSelectionCurrent(selection),
                undefined,
                () => armAudioStartupDeadline(selection)
              );
              failureKind = null;
              break;
            } catch (error) {
              if (isAbortError(error) || !isTrackSelectionCurrent(selection)) break;
              failureKind = classifyProtectedPlaybackFailure(error);
              const retryDelay = PROTECTED_PLAYBACK_RETRY_DELAYS_MS[attempt];
              if (retryDelay === undefined || !isTransientProtectedPlaybackFailure(failureKind)) break;
              setAudioStartupStatus('Still preparing');
              await new Promise(resolve => window.setTimeout(resolve, retryDelay));
              if (!isTrackSelectionCurrent(selection)) break;
            }
          }
        } else {
          audioUrl = track.localUrl;
        }
        if (!isTrackSelectionCurrent(selection)) return { playbackMode: 'full', audioSource: audioSourceRef.current };

        if (!audioUrl && track.encrypted) {
          // Access is granted but the key, the audio, or decryption failed. The
          // player names the cause and offers a retry in place.
          setPlaybackFailure({ trackId: track.id, kind: failureKind ?? 'unknown' });
          setAudioStartupStatus(null);
        }
      }

      if (!isTrackSelectionCurrent(selection)) return { playbackMode: 'full', audioSource: audioSourceRef.current };
      if (!audioUrl) reportSelectionFailure(hasAccess ? 'selection-failed' : 'access-denied');
      const sourceAlreadyReady = Boolean(
        audioUrl && audioSourceRef.current === audioUrl && localAudioRef.current && localAudioRef.current.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA
      );
      pendingTrackMediaSourceRef.current = sourceAlreadyReady ? null : audioUrl;
      waitsForMediaReadiness = Boolean(audioUrl && !sourceAlreadyReady);
      setResolvedAudioSource(audioUrl);
      setAudioSourcePending(false);
      if (audioUrl) armAudioStartupDeadline(selection);
      if (!audioUrl) setAudioStartupStatus(null);

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
    } catch (error) {
      reportSelectionFailure('selection-failed');
      throw error;
    } finally {
      if (isTrackSelectionCurrent(selection)) setAudioSourcePending(false);
      if (isTrackSelectionCurrent(selection) && !waitsForMediaReadiness) {
        clearTimeout(selection.startupDeadline);
        selection.pending = false;
        pendingTrackMediaSourceRef.current = null;
        setTrackSelectionPending(false);
      }
    }
  }

  async function openTrack(
    track: CatalogTrack,
    socketEmit?: RoomTrackEmitter,
    setLocalStreamReady?: (ready: boolean) => void,
    closeHostPeers?: () => void,
    showAccessGateOnDenied = false
  ) {
    navigateToView('player');
    return selectTrack(track, socketEmit, setLocalStreamReady, closeHostPeers, showAccessGateOnDenied);
  }

  const prefetchTrackAudio = useCallback((track: CatalogTrack): void => {
    if (!track.encrypted) return;
    void prefetchStreamingAudio(track.audioRef).catch(() => undefined);
  }, []);

  function explainRuntimeWriteWalletRequirement(): string | null {
    if (!connectedWallet) return null;
    if (runtimeAdapterConfig.kind === 'product-cdm') {
      return connectedWallet.method === 'product-host' ? null : 'Connect with "Use Polkadot app" to confirm payment in this app.';
    }
    return connectedWallet.createEvmClient
      ? null
      : 'This version cannot approve payment in Polkadot App. Open Dotify in a browser and connect a compatible wallet.';
  }

  async function payForTrackAccess(
    track: CatalogTrack,
    socketEmit?: RoomTrackEmitter,
    setLocalStreamReady?: (ready: boolean) => void,
    closeHostPeers?: () => void,
    readOnly = false
  ) {
    if (supportBusyRef.current) return;
    supportBusyRef.current = true;
    try {
      await performTrackSupport(track, socketEmit, setLocalStreamReady, closeHostPeers, readOnly);
    } finally {
      supportBusyRef.current = false;
    }
  }

  async function performTrackSupport(
    track: CatalogTrack,
    socketEmit?: RoomTrackEmitter,
    setLocalStreamReady?: (ready: boolean) => void,
    closeHostPeers?: () => void,
    readOnly = false
  ) {
    const operationId = newOperationId();
    const showPaymentFeedback = (feedback: TransactionFeedback) => setTransactionFeedback({ ...feedback, operationId });
    const unlockStartedTrackId = track.id;
    const unlockStartedView = activeViewRef.current;
    const supportProofKind = runtimeAdapterConfig.kind === 'product-cdm' ? 'substrate-extrinsic' : 'evm-transaction';
    const accountAtStart = supportAccountRef.current;
    const currentAccount = () => supportAccountRef.current === accountAtStart;
    const shouldRestoreUnlockedTrack = () =>
      currentAccount() && selectedTrackIdRef.current === unlockStartedTrackId && activeViewRef.current === unlockStartedView;

    if (!connectedWallet) {
      // The access receipt is itself a modal. Dismiss it before handing off to
      // account selection so Product hosts never render two dialogs at once.
      setAccessGate(null);
      openSupportWalletModal();
      return;
    }

    const walletRequirement = readOnly ? null : explainRuntimeWriteWalletRequirement();
    if (walletRequirement || !listenerEvmAddress) {
      setAccessGate(null);
      showPaymentFeedback({
        tone: 'error',
        title: 'Payment could not start',
        message: walletRequirement || 'Reconnect your account before paying for listening access.',
        facts: buildSupportFacts(track, nativeRuntimePaymentAsset, 'failed')
      });
      return;
    }

    const runtimeAddress = runtimeAddressFromTrackId(track);
    if (!runtimeAddress) {
      setAccessGate(null);
      showPaymentFeedback({
        tone: 'error',
        title: 'Payment setup failed',
        message: 'This track is missing its artist runtime address. Refresh the catalog and try again.'
      });
      return;
    }

    // Every subsequent state is rendered by TransactionModal. Clear the
    // receipt first, including when intent preparation fails synchronously.
    setAccessGate(null);
    let paymentIntent;
    try {
      paymentIntent = await createRuntimeNativeAccessPaymentIntent({
        runtimeAddress,
        contentHash: track.hash,
        amountPlanck: classicTrackPaymentAmountPlanck(track),
        adapterKind: runtimeAdapterConfig.kind,
        currentAsset: nativeRuntimePaymentAsset,
        resolveChain: () => resolveEvmChain(ethRpcUrl)
      });
    } catch (intentError) {
      showPaymentFeedback({
        tone: 'error',
        title: 'Payment setup failed',
        message: intentError instanceof Error ? intentError.message : 'Unable to prepare this payment.'
      });
      return;
    }

    if (!currentAccount()) {
      openSupportWalletModal();
      return;
    }
    const ports =
      isClassicUnlockE2e && track.id === E2E_CLASSIC_TRACK.id
        ? classicSupportE2ePorts(runtimeReader, runtimeWriter)
        : { reader: runtimeReader, writer: runtimeWriter };
    const result = await supportFlow.run({
      network: `${runtimeAdapterConfig.kind}:${ethRpcUrl}`,
      intent: paymentIntent,
      listenerAddress: listenerEvmAddress!,
      ...ports,
      verificationOptions: isClassicUnlockE2e ? { attempts: 1, delayMs: 0 } : undefined,
      currentAccount,
      readOnly,
      onProgress(stage, txHash, accountState) {
        if (!currentAccount()) return;
        const titles = {
          checking: 'Checking your listening access',
          approval: connectedWallet.method === 'product-host' ? 'Confirm in Polkadot App' : 'Confirm in your wallet',
          confirming: 'Confirming your access payment',
          processing: 'Payment processing',
          finalized: 'Payment finalized; checking access',
          verifying: 'Opening your listening access'
        };
        showPaymentFeedback({
          tone: 'pending',
          title: titles[stage],
          message:
            stage === 'approval'
              ? `Review ${formatEther(paymentIntent.amountPlanck)} ${paymentIntent.asset.symbol} for “${track.title}” in the confirmation request.`
              : 'Dotify checks your listening access separately from payment confirmation.',
          txHash,
          proofKind: supportProofKind,
          facts: buildSupportFacts(track, paymentIntent.asset, 'pending', accountState),
          technicalFacts: [
            ...buildSupportTechnicalFacts(track, paymentIntent.asset, 'pending'),
            ...(accountState?.detail ? [{ label: 'Account check', value: accountState.detail }] : [])
          ]
        });
      }
    });
    if (!currentAccount()) {
      showPaymentFeedback({
        tone: 'error',
        title: 'Account changed',
        message: 'Your payment reference is saved in this browser. Reconnect the original account and check access before paying again.',
        txHash: result.txHash,
        proofKind: supportProofKind
      });
      return;
    }
    if (result.verification && runtimeAdapterConfig.kind === 'product-cdm' && result.txHash) {
      publishProductCdmPaymentSmokeMetric(
        buildProductCdmPaymentSmokeMetric({
          verification: result.verification,
          txHash: result.txHash,
          runtimeAddress: paymentIntent.runtimeAddress,
          contentHash: paymentIntent.contentHash,
          listenerAddress: listenerEvmAddress!,
          amountPlanck: result.amountPlanck ?? paymentIntent.amountPlanck
        })
      );
    }
    const receiptTrack = result.amountPlanck === undefined ? track : { ...track, pricePlanck: result.amountPlanck };
    const receiptAsset = { ...paymentIntent.asset, symbol: result.assetSymbol ?? paymentIntent.asset.symbol };
    if (result.status === 'verified' || result.verification?.readback?.hasPaid || result.hasPaid) {
      setCatalogPaidAccessByTrackId(previous => ({ ...previous, [track.id]: true }));
    }
    if (result.status === 'verified' || result.status === 'existing-access') {
      if (isClassicUnlockE2e && track.id === E2E_CLASSIC_TRACK.id) e2eClassicAccessGrantedRef.current = true;
      setCatalogAccessByTrackId(previous => ({ ...previous, [track.id]: true }));
      showPaymentFeedback(
        result.status === 'verified'
          ? {
              ...buildClassicAccessVerifiedFeedback(receiptTrack, result.txHash, receiptAsset),
              proofKind: supportProofKind,
              facts: buildSupportFacts(receiptTrack, receiptAsset, 'confirmed'),
              technicalFacts: buildSupportTechnicalFacts(receiptTrack, receiptAsset, 'confirmed')
            }
          : { tone: 'success', title: 'Listening access available', message: 'This account can already listen. No payment was sent.' }
      );
      if (shouldRestoreUnlockedTrack()) {
        navigateToView('player');
        try {
          await selectTrack(track, socketEmit, setLocalStreamReady, closeHostPeers);
        } catch {
          showPaymentFeedback({
            tone: 'error',
            title: 'Payment recorded, audio unavailable',
            message: 'Your access is verified. Reopen the track to try loading the audio again; no new payment is needed.',
            txHash: result.txHash,
            proofKind: supportProofKind
          });
        }
      }
      return;
    }
    const recoverable = result.status === 'unverified' || result.status === 'uncertain';
    const retryApproval = result.failureKind === 'approval-expired';
    showPaymentFeedback({
      tone: 'error',
      title:
        result.status === 'canceled'
          ? 'Access payment canceled'
          : retryApproval
            ? 'Confirmation request expired'
            : result.failureKind === 'funding-required'
              ? `Add ${receiptAsset.symbol} to continue`
              : result.status === 'unverified'
                ? 'Listening access not verified'
                : result.status === 'uncertain'
                  ? 'Payment status needs checking'
                  : 'Access payment could not start',
      message:
        result.status === 'uncertain'
          ? 'Confirmation was interrupted. Your payment may still complete. Check access here and your account activity in Polkadot App or your wallet before paying again.'
          : result.message || 'Listening is not available yet.',
      txHash: result.txHash,
      proofKind: supportProofKind,
      facts: buildSupportFacts(receiptTrack, receiptAsset, recoverable ? 'included-unverified' : result.status === 'canceled' ? 'canceled' : 'failed'),
      technicalFacts: [
        ...buildSupportTechnicalFacts(receiptTrack, receiptAsset, recoverable ? 'included-unverified' : result.status === 'canceled' ? 'canceled' : 'failed'),
        ...(result.errorDetail ? [{ label: 'Payment error', value: result.errorDetail }] : [])
      ],
      recoveryAction:
        recoverable || retryApproval
          ? {
              label: retryApproval ? 'Try payment again' : 'Check access again',
              run: () => {
                if (!currentAccount()) {
                  setTransactionFeedback({
                    tone: 'error',
                    title: 'Account changed',
                    message: 'Reconnect the account used for this payment before checking its access.'
                  });
                  return;
                }
                void payForTrackAccess(track, socketEmit, setLocalStreamReady, closeHostPeers, !retryApproval);
              }
            }
          : undefined
    });
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

  function commitCatalog(allTracks: CatalogTrack[], preferredTrackHash: `0x${string}` | undefined, status: string, authoritative = false): CatalogTrack[] {
    const normalizedTracks = allTracks.map(normalizeCatalogTrackDisplay);
    const nextCatalog = normalizedTracks.filter(track => track.active !== false);
    setAllCatalogTracks(normalizedTracks);
    setCatalogTracks(nextCatalog);
    setSelectedTrackId(previous => {
      const preferredTrack = preferredTrackHash ? nextCatalog.find(track => track.hash.toLowerCase() === preferredTrackHash.toLowerCase()) : null;
      if (preferredTrack) return preferredTrack.id;
      return nextCatalog.some(track => track.id === previous) ? previous : (nextCatalog[0]?.id ?? '');
    });
    setCatalogStatus(status);
    setCatalogIsAuthoritative(authoritative);
    return nextCatalog;
  }

  async function refreshCatalogFromRegistry(preferredTrackHash?: `0x${string}`, options: { fresh?: boolean } = {}) {
    setCatalogIsAuthoritative(false);
    if (isClassicUnlockE2e || isArtistPublishE2e || isRoomJoinE2e) {
      const nextCatalog = getDeterministicE2eCatalogTracks().map(normalizeCatalogTrackDisplay);
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
        Object.fromEntries(nextCatalog.map(track => [track.id, track.id === E2E_CLASSIC_TRACK.id && getClassicUnlockE2eState().paid]))
      );
      setCatalogStatus(
        nextCatalog.length > 0 ? `Loaded ${nextCatalog.length} deterministic e2e track${nextCatalog.length === 1 ? '' : 's'}` : 'No e2e tracks registered yet'
      );
      setCatalogIsAuthoritative(true);
      return nextCatalog;
    }

    if (usesCatalogApi) {
      if (allCatalogTracks.length === 0) setCatalogStatus('Loading registry catalog');
      try {
        const response = await fetchCatalog({ includeInactive: true, limit: 100, fresh: options.fresh, allPages: options.fresh });
        const apiTracks = response.items.map(catalogApiReleaseToTrack);
        const usesApiResponse = response.meta.cacheAvailable || allCatalogTracks.length === 0;
        const allTracks = usesApiResponse ? apiTracks : allCatalogTracks;
        return commitCatalog(
          allTracks,
          preferredTrackHash,
          catalogApiStatus(response.meta, allTracks.filter(track => track.active !== false).length),
          usesApiResponse && isAuthoritativeCatalogResponse(response)
        );
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
        setCatalogIsAuthoritative(false);
        return [];
      }

      const artistCount = await runtimeReader.getArtistCount(directoryAddress);

      if (artistCount === 0n) {
        setCatalogTracks([]);
        setAllCatalogTracks([]);
        setSelectedTrackId('');
        setCatalogStatus('No tracks registered on this directory yet');
        setCatalogIsAuthoritative(true);
        return [];
      }

      const entries = await runtimeReader.listArtistRuntimes(directoryAddress, artistCount);
      const runtimeCatalogs = await Promise.all(
        entries.map(async entry => {
          try {
            return { tracks: await fetchRuntimeCatalog(runtimeReader, entry.artist, entry.runtime), complete: true };
          } catch (runtimeError) {
            console.warn(`Failed to load runtime catalog for ${entry.runtime}`, runtimeError);
            return { tracks: [], complete: false };
          }
        })
      );
      const allTracks = runtimeCatalogs
        .flatMap(result => result.tracks)
        .sort((left, right) => {
          if (left.registeredAtBlock !== right.registeredAtBlock) {
            return right.registeredAtBlock - left.registeredAtBlock;
          }
          return left.title.localeCompare(right.title);
        });
      const nextCatalog = allTracks.filter(track => track.active !== false);

      return commitCatalog(
        allTracks,
        preferredTrackHash,
        nextCatalog.length > 0
          ? `Loaded ${nextCatalog.length} registered track${nextCatalog.length > 1 ? 's' : ''}`
          : 'No tracks registered on this directory yet',
        BigInt(entries.length) === artistCount && runtimeCatalogs.every(result => result.complete)
      );
    } catch (catalogError) {
      console.warn('Failed to load registry catalog', catalogError);
      setCatalogTracks([]);
      setAllCatalogTracks([]);
      setSelectedTrackId('');
      setCatalogStatus(catalogLoadFailureStatus(catalogError));
      setCatalogIsAuthoritative(false);
      return [];
    }
  }

  const preparationSigner = connectedWallet?.keyRequestSigner;
  const preparationIdentity = `${connectedWallet?.evmAddress}:${connectedWallet?.chainId}:${preparationSigner?.signatureScheme}:${preparationSigner?.signatureScheme === 'product-sr25519-v1' ? preparationSigner.productPublicKey : ''}`;
  const preparationLifetime = useRef(new AbortController());
  const preparationIdentityRef = useRef(preparationIdentity);
  useLayoutEffect(() => {
    preparationIdentityRef.current = preparationIdentity;
    standbyAudio.clear();
    const lifetime = new AbortController();
    preparationLifetime.current = lifetime;
    return () => {
      lifetime.abort();
      standbyAudio.clear();
    };
  }, [preparationIdentity, standbyAudio]);

  async function prepareQueuedContentKeys(tracks: CatalogTrack[], signal: AbortSignal) {
    if (
      !connectedWallet ||
      (!connectedWallet.keyRequestSigner && !connectedWallet.createEvmClient) ||
      signal.aborted ||
      preparationIdentityRef.current !== preparationIdentity
    )
      return;
    const lifetime = preparationLifetime.current;
    const candidates = tracks
      .filter(track => track.active !== false)
      .flatMap(track => {
        const release = releaseIdentityFromTrack(track);
        return release ? [{ contentHash: track.hash, release }] : [];
      })
      .slice(0, 5);
    if (!candidates.length) return;
    const walletClient = connectedWallet.keyRequestSigner ? undefined : await getActiveWalletClient();
    if (signal.aborted || lifetime.signal.aborted) return;
    await prepareContentKeys({
      ...(connectedWallet.keyRequestSigner ? { signer: connectedWallet.keyRequestSigner } : { walletClient }),
      chainId: walletClient?.chain?.id ?? PRODUCT_DEVNET_EVM_CHAIN_ID,
      purpose: keyRequestPurposeRef.current,
      tracks: candidates,
      signal: AbortSignal.any([signal, lifetime.signal])
    });
  }

  function standbyIdentity(track: CatalogTrack) {
    return JSON.stringify([
      preparationIdentityRef.current,
      keyRequestPurposeRef.current,
      track.source,
      track.encrypted,
      track.id,
      track.hash,
      track.artistAddress?.toLowerCase(),
      track.audioRef,
      track.localUrl,
      track.accessMode
    ]);
  }

  async function prepareNextPlayback(track: CatalogTrack, signal: AbortSignal) {
    const identity = standbyIdentity(track);
    const current = () => !signal.aborted && standbyIdentity(track) === identity;
    if (!current() || track.active === false || !track.localUrl) return;
    // Do not expose even a paused media URL before its runtime policy passes.
    // These sources use the authoritative check on explicit selection instead.
    if (!track.encrypted && isPolicyManagedTrack(track)) return;
    if (track.encrypted && (typeof MediaSource === 'undefined' || !MediaSource.isTypeSupported('audio/mp4; codecs="mp4a.40.2"'))) return;
    const expires = Date.now() + 30_000;
    let key: Uint8Array | null = null;
    if (track.encrypted) {
      if (track.accessMode === 'free') key = await resolveFreeContentKey(track.hash, releaseIdentityFromTrack(track));
      else {
        await prepareQueuedContentKeys([track], signal);
        const grant = readPreparedContentKey(track.hash, releaseIdentityFromTrack(track), keyRequestPurposeRef.current);
        if (grant?.access === 'allowed') key = hexToBytes(grant.contentKey);
      }
      if (!key || !current()) return;
    }
    await standbyAudio.prepare(identity, expires, signal, (owner, audio) =>
      track.encrypted
        ? prepareStreamingAudio(
            track.audioRef,
            track.hash,
            track.accessMode,
            releaseIdentityFromTrack(track),
            owner,
            () => !owner.aborted && standbyIdentity(track) === identity,
            { key: key!, audio: () => audio, speculative: true }
          )
        : Promise.resolve(track.localUrl!)
    );
  }

  function clearObjectUrls() {
    standbyAudio.clear();
    abortActiveTrackSelection();
    for (const url of objectUrlsRef.current.values()) {
      forgetAudioGain(url);
      URL.revokeObjectURL(url);
    }
    objectUrlsRef.current.clear();
    mseObjectUrlsRef.current.clear();
    resolvedAudioSourcesRef.current.clear();
  }

  return {
    resolveArtistForDonation: (track: CatalogTrack) =>
      isClassicUnlockE2e && track.id === E2E_CLASSIC_TRACK.id
        ? Promise.resolve({ name: track.artist, recipient: E2E_CLASSIC_TRACK.artistAddress!, releaseTitle: track.title })
        : resolveDonationArtist(track, runtimeReader),
    prepareQueuedContentKeys,
    prepareNextPlayback,
    cancelNextPlayback: () => standbyAudio.clear(),
    adoptPreparedAudio: (url: string | null) => standbyAudio.adopt(url),
    // State
    catalogTracks,
    allCatalogTracks,
    catalogStatus,
    catalogIsAuthoritative,
    selectedTrackId,
    setSelectedTrackId,
    catalogAccessByTrackId,
    setCatalogAccessByTrackId,
    catalogPaidAccessByTrackId,
    setCatalogPaidAccessByTrackId,
    nativeRuntimePaymentAsset,
    usesCatalogApi,
    audioSource,
    audioSourceGeneration,
    audioContinuation,
    audioRecovery,
    audioStartupAttemptId,
    trackSelectionPending,
    audioSourcePending,
    settleTrackSelectionMedia,
    setAudioSource: (source: string | null) => setResolvedAudioSource(source, true),
    audioStartupStatus,
    playbackFailure,
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
    prefetchTrackAudio,
    checkTrackAccess,
    checkTrackPaidAccess,
    buildAccessGateInfo,
    payForTrackAccess,
    prepareStreamingAudio,
    refreshCatalogFromRegistry,
    fetchRuntimeCatalog,
    clearObjectUrls,
    cancelPlaybackPreparation
  };
}
