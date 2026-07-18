// ── Persistent audio elements ───────────────────────────────────────────────
// Rendered once at the App root, always mounted. Owns the two <audio> nodes so
// playback survives tab navigation:
//   - localAudioRef:  host source (also captured into the WebRTC stream)
//   - remoteAudioRef: room-listener stream (srcObject set by useSession.ontrack)
// All transport state lives in usePlayback; this component only forwards DOM
// media events into that shared state and the host streaming callbacks.

import { useEffect, type RefObject } from 'react';
import type { PlaybackControls } from '../hooks/usePlayback';

type PersistentAudioProps = {
  audioSource: string | null;
  localAudioRef: RefObject<HTMLAudioElement | null>;
  remoteAudioRef: RefObject<HTMLAudioElement | null>;
  playback: PlaybackControls;
  onPrepareLocalStream: () => void;
  onEmitPlayerState: (force: boolean) => void;
};

export function PersistentAudio({ audioSource, localAudioRef, remoteAudioRef, playback, onPrepareLocalStream, onEmitPlayerState }: PersistentAudioProps) {
  // Keep the mute flag applied to whichever element exists at any moment.
  useEffect(() => {
    if (localAudioRef.current) localAudioRef.current.muted = playback.muted;
    if (remoteAudioRef.current) remoteAudioRef.current.muted = playback.muted;
  }, [playback.muted, localAudioRef, remoteAudioRef]);

  return (
    <div className='persistent-audio' aria-hidden='true'>
      {/* Host source: drives local playback and the WebRTC capture. */}
      <audio
        className='native-player-source'
        ref={localAudioRef as RefObject<HTMLAudioElement>}
        src={audioSource ?? undefined}
        crossOrigin='anonymous'
        onLoadedMetadata={() => {
          playback.handleHostLoadedMetadata(localAudioRef.current!);
          void onPrepareLocalStream();
        }}
        onPlay={() => {
          playback.syncFromAudio(localAudioRef.current);
          // Re-run capture now that audio is actually flowing: a captureStream()
          // taken at loadedmetadata can have no live track yet. This is a cheap
          // no-op once the current source is already streaming (guarded in
          // prepareLocalStream), so it only does work when the room would
          // otherwise be left with a silent or stale stream.
          void onPrepareLocalStream();
          onEmitPlayerState(true);
        }}
        onPlaying={() => {
          playback.handleHostPlaying(localAudioRef.current!);
          // Some browsers expose a track at `play` before media frames are
          // actually flowing. Re-check at `playing`; prepareLocalStream keeps
          // this cheap when the current capture is already valid.
          void onPrepareLocalStream();
        }}
        onPause={() => {
          playback.syncFromAudio(localAudioRef.current);
          onEmitPlayerState(true);
        }}
        onSeeked={() => {
          playback.syncFromAudio(localAudioRef.current);
          onEmitPlayerState(true);
        }}
        onTimeUpdate={() => {
          playback.syncFromAudio(localAudioRef.current);
          onEmitPlayerState(false);
        }}
        onEnded={event => playback.handleEnded(event.currentTarget)}
        onError={() => {
          playback.handleHostError();
          if (audioSource) playback.markNoAudio();
        }}
      />

      {/* Room listener: live stream attached to srcObject by the session hook. */}
      <audio
        className='native-player-source'
        ref={remoteAudioRef as RefObject<HTMLAudioElement>}
        autoPlay
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
