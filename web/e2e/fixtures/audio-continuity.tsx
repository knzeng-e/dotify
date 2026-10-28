import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useCatalog } from '../../src/hooks/useCatalog';
import { usePlayback } from '../../src/hooks/usePlayback';
import { PersistentAudio } from '../../src/components/PersistentAudio';
import type { CatalogTrack } from '../../src/shared/types';

const noop = () => {};
const scope = Reflect.get(window, '__STREAMING_SCOPE__') as { runtimeAddress: string; contentHash: `0x${string}` };
const tracks: CatalogTrack[] = ['a', 'b'].map(id => ({
  id: `${scope.runtimeAddress}:${scope.contentHash}:${id}`,
  source: 'artist',
  artistAddress: `0x${'33'.repeat(20)}`,
  title: `Tone ${id}`,
  artist: 'Synthetic fixture',
  audioRef: `dotify:enc:v3:key-v2:ipfs://Qm${id.repeat(44)}`,
  localUrl: `https://gateway.pinata.cloud/ipfs/Qm${id.repeat(44)}`,
  imageRef: '',
  hash: scope.contentHash,
  priceDot: '0',
  accessMode: 'free',
  encrypted: true,
  metadataRef: '',
  bulletinRef: '',
  description: '',
  royaltyBps: 0,
  royaltySplits: [],
  personhoodLevel: 'DIM1',
  zone: 'test',
  durationLabel: '8s'
}));

function Harness() {
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const plainPolicy = Reflect.get(window, '__plainPolicy') as 'classic' | 'human-free' | 'free' | undefined;
  const encryptedOnPolicy = Boolean(Reflect.get(window, '__encryptedOnPolicy'));
  const [policyApplied, setPolicyApplied] = useState(!Reflect.get(window, '__plainSeedCandidate'));
  const [preparations, setPreparations] = useState(0);
  const playbackTracks = tracks.map(track =>
    plainPolicy && track.id.endsWith(':b')
      ? {
          ...track,
          source: policyApplied ? ('artist' as const) : ('seed' as const),
          accessMode: plainPolicy,
          encrypted: encryptedOnPolicy && policyApplied,
          audioRef: encryptedOnPolicy ? track.audioRef : 'http://media.audio.test/unencrypted-policy.wav',
          localUrl: 'http://media.audio.test/unencrypted-policy.wav'
        }
      : track
  );
  const catalog = useCatalog({
    ethRpcUrl: 'http://rpc.audio.test',
    listenerEvmAddress: null,
    connectedWallet: null,
    directoryAddress: undefined,
    openSupportWalletModal: noop,
    setTransactionFeedback: noop,
    activeView: 'player',
    navigateToView: noop,
    getActiveWalletClient: async () => {
      throw new Error('No wallet allowed');
    },
    setBulletinManifestRef: noop,
    setAccessMode: noop,
    setPriceDot: noop,
    setPersonhoodLevel: noop,
    setArtistName: noop,
    setDescription: noop,
    setTitle: noop
  });
  const playback = usePlayback({
    mode: 'host',
    roomId: '',
    localAudioRef: catalog.localAudioRef,
    remoteAudioRef,
    audioSource: catalog.audioSource,
    audioSourceGeneration: catalog.audioSourceGeneration,
    audioContinuation: catalog.audioContinuation,
    audioRecovery: catalog.audioRecovery,
    audioStartupAttemptId: catalog.audioStartupAttemptId,
    trackSelectionPending: catalog.trackSelectionPending,
    audioSourcePending: catalog.audioSourcePending,
    onHostMediaSettled: catalog.settleTrackSelectionMedia,
    remoteReady: false,
    remoteStreamVersion: 0,
    localStreamReady: false,
    playerState: null,
    catalogTracks: playbackTracks,
    selectedTrackId: catalog.selectedTrackId,
    lineup: [],
    onLineupChange: noop,
    onPrepareNext: new URLSearchParams(location.search).has('continuous')
      ? async (track, signal) => {
          await catalog.prepareNextPlayback(track, signal);
          setPreparations(count => count + 1);
        }
      : undefined,
    onOpenTrack: track => void catalog.selectTrack(track, Reflect.get(window, '__selectForRoom') ? noop : undefined),
    onEmitPlayerState: noop
  });
  return (
    <>
      {playbackTracks.map(track => (
        <button
          key={track.id}
          onClick={() => {
            playback.requestAutoplay();
            void catalog.selectTrack(track);
          }}
        >
          Select {track.title.slice(-1)}
        </button>
      ))}
      <button onClick={() => void playback.togglePlay()}>Toggle playback</button>
      {plainPolicy && <button onClick={() => setPolicyApplied(true)}>Apply artist policy to b</button>}
      <output
        data-testid='state'
        data-generation={catalog.audioSourceGeneration}
        data-track={catalog.selectedTrackId}
        data-status={playback.status}
        data-pending={catalog.trackSelectionPending}
        data-failure={catalog.playbackFailure?.kind ?? ''}
        data-time={playback.transport.currentTime}
        data-playing={playback.transport.playing}
        data-access={String(catalog.catalogAccessByTrackId[catalog.selectedTrackId])}
        data-preparations={preparations}
      />
      <PersistentAudio
        adoptPreparedAudio={catalog.adoptPreparedAudio}
        audioSource={catalog.audioSource}
        audioSourceGeneration={catalog.audioSourceGeneration}
        localAudioRef={catalog.localAudioRef}
        remoteAudioRef={remoteAudioRef}
        playback={playback}
        onPrepareLocalStream={noop}
        onEmitPlayerState={noop}
      />
    </>
  );
}
createRoot(document.getElementById('root')!).render(<Harness />);
