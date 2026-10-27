import { attachAudioNormalization } from '../features/player/audioNormalization';
// ── Persistent audio elements ───────────────────────────────────────────────
// Rendered once at the App root. Owns the two <audio> nodes so playback survives
// tab navigation. The host node is replaced only for a new resolved source
// generation, preventing retired resource errors from reaching its successor:
//   - localAudioRef: host source (also captured into the WebRTC stream)
//   - remoteAudioRef: room-listener stream (srcObject set by useSession.ontrack)
// All transport state lives in usePlayback; this component only forwards DOM
// media events into that shared state and the host streaming callbacks.

import { useLayoutEffect, useRef, type MutableRefObject, type RefObject } from 'react';
import type { PlaybackControls } from '../hooks/usePlayback';
import { retireHostAudio } from '../features/player/hostAudioOutput';

type PersistentAudioProps = {
  audioSource: string | null;
  audioSourceGeneration: number;
  localAudioRef: MutableRefObject<HTMLAudioElement | null>;
  remoteAudioRef: RefObject<HTMLAudioElement | null>;
  playback: PlaybackControls;
  adoptPreparedAudio?: (url: string | null) => HTMLAudioElement | null;
  onPrepareLocalStream: () => void;
  onEmitPlayerState: (force: boolean) => void;
};

function LocalAudio(props: PersistentAudioProps) {
  const mount = useRef<HTMLSpanElement>(null);
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  }, [props]);
  useLayoutEffect(() => {
    const { localAudioRef, audioSource, adoptPreparedAudio } = latest.current;
    const audio = adoptPreparedAudio?.(audioSource) ?? new Audio();
    audio.className = 'native-player-source';
    audio.crossOrigin = 'anonymous';
    audio.setAttribute('playsinline', '');
    if (audioSource && audio.getAttribute('src') !== audioSource) audio.src = audioSource;
    localAudioRef.current = audio;
    attachAudioNormalization(audio);
    mount.current?.replaceChildren(audio);
    const on = (name: string, action: (props: PersistentAudioProps) => void) => {
      const listener = () => {
        if (audio === localAudioRef.current) action(latest.current);
      };
      audio.addEventListener(name, listener);
      return () => audio.removeEventListener(name, listener);
    };
    const removers = [
      on('loadedmetadata', p => {
        p.playback.handleHostLoadedMetadata(audio);
        p.onEmitPlayerState(true);
        void p.onPrepareLocalStream();
      }),
      on('canplay', p => p.playback.handleHostCanPlay(audio)),
      on('play', p => {
        p.playback.syncFromAudio(audio);
        void p.onPrepareLocalStream();
        p.onEmitPlayerState(true);
      }),
      on('playing', p => {
        p.playback.handleHostPlaying(audio);
        p.onEmitPlayerState(true);
        void p.onPrepareLocalStream();
      }),
      on('pause', p => {
        p.playback.syncFromAudio(audio);
        p.onEmitPlayerState(true);
      }),
      on('waiting', p => {
        p.playback.handleHostWaiting(audio);
        p.onEmitPlayerState(true);
      }),
      on('seeking', p => p.onEmitPlayerState(true)),
      on('seeked', p => {
        p.playback.syncFromAudio(audio);
        p.onEmitPlayerState(true);
      }),
      on('timeupdate', p => {
        p.playback.syncFromAudio(audio);
        p.onEmitPlayerState(false);
      }),
      on('ended', p => {
        p.onEmitPlayerState(true);
        p.playback.handleEnded(audio);
      }),
      on('error', p => {
        if (p.playback.handleHostError(audio) && p.audioSource) p.playback.markNoAudio();
      })
    ];
    // A warmed node already fired metadata/canplay while silent. Replay those
    // callbacks only after all source-owner layout effects have committed.
    queueMicrotask(() => {
      if (localAudioRef.current !== audio) return;
      if (audio.readyState >= 1) latest.current.playback.handleHostLoadedMetadata(audio);
      if (audio.readyState >= 3) latest.current.playback.handleHostCanPlay(audio);
    });
    return () => {
      for (const remove of removers) remove();
      if (localAudioRef.current === audio) localAudioRef.current = null;
      retireHostAudio(audio);
      audio.remove();
    };
  }, [props.audioSourceGeneration, props.audioSource]);
  useLayoutEffect(() => {
    const audio = props.localAudioRef.current;
    if (audio) {
      audio.muted = props.playback.muted;
      audio.loop = props.playback.repeatEnabled;
    }
  }, [props.localAudioRef, props.audioSourceGeneration, props.playback.muted, props.playback.repeatEnabled]);
  return <span ref={mount} />;
}

export function PersistentAudio(props: PersistentAudioProps) {
  const { playback, remoteAudioRef } = props;
  return (
    <div className='persistent-audio' aria-hidden='true'>
      <LocalAudio {...props} />

      {/* Room listener: live stream attached to srcObject by the session hook. */}
      <audio
        className='native-player-source'
        ref={remoteAudioRef as RefObject<HTMLAudioElement>}
        autoPlay
        muted={playback.remoteMuted}
        playsInline
        onLoadedMetadata={event => playback.syncFromAudio(event.currentTarget)}
        onPlay={event => playback.syncFromAudio(event.currentTarget)}
        onPause={event => playback.syncFromAudio(event.currentTarget)}
        onSeeked={event => playback.syncFromAudio(event.currentTarget)}
        onTimeUpdate={event => playback.syncFromAudio(event.currentTarget)}
        onEnded={event => playback.handleEnded(event.currentTarget)}
        onError={() => {
          // A live stream that errors mid-session should surface, not hang on
          // "Joining". Only fault when a stream was actually attached.
          if (remoteAudioRef.current?.srcObject) playback.markNoAudio();
        }}
      />
    </div>
  );
}
