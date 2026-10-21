import React, { useRef } from 'react';
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
    onHostMediaSettled: catalog.settleTrackSelectionMedia,
    remoteReady: false,
    remoteStreamVersion: 0,
    localStreamReady: false,
    playerState: null,
    catalogTracks: tracks,
    selectedTrackId: catalog.selectedTrackId,
    lineup: [],
    onLineupChange: noop,
    onOpenTrack: track => void catalog.selectTrack(track),
    onEmitPlayerState: noop
  });
  return (
    <>
      {tracks.map(track => (
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
      <output
        data-testid='state'
        data-generation={catalog.audioSourceGeneration}
        data-track={catalog.selectedTrackId}
        data-status={playback.status}
        data-pending={catalog.trackSelectionPending}
        data-failure={catalog.playbackFailure?.kind ?? ''}
        data-time={playback.transport.currentTime}
        data-playing={playback.transport.playing}
      />
      <PersistentAudio
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
