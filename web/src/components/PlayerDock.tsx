// ── Player dock (persistent bottom bar) ─────────────────────────────────────
// Real transport controls over the shared persistent audio: play/pause, a
// draggable seek bar, and mute all act in place and never navigate. Only the
// artwork/title and the explicit "Player" affordance open the full player view.

import { LockKeyhole, Maximize2, Pause, Play, Radio, Repeat1, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import type { CSSProperties } from 'react';
import { CoverImage } from './CoverImage';
import { AvatarStack } from './Presence';
import { playbackStatusLabel } from '../features/player/playbackStatus';
import { type PlaybackControls } from '../hooks/usePlayback';
import { playbackTrack, roomPlaybackPresentation } from '../features/player/playbackPresentation';
import { roomHostDisplayName, roomPresenceCount, roomPresencePreview } from '../features/rooms/roomState';
import type { CatalogTrack, ListenerRecord, Mode, SocketStatus, TrackInfo } from '../shared/types';

type PlayerDockProps = {
  track: CatalogTrack | undefined;
  trackInfo: TrackInfo | null;
  playback: PlaybackControls;
  mode: Mode;
  roomId: string;
  hostName: string;
  locked: boolean;
  listenerCount: number;
  listeners: ListenerRecord[];
  socketStatus: SocketStatus;
  audioStartupStatus?: string | null;
  onOpenPlayer: () => void;
  onStartRoom: () => void;
};

function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export function PlayerDock({
  track,
  trackInfo,
  playback,
  mode,
  roomId,
  hostName,
  locked,
  listenerCount,
  listeners,
  socketStatus,
  audioStartupStatus,
  onOpenPlayer,
  onStartRoom
}: PlayerDockProps) {
  const currentTrack = playbackTrack(mode, trackInfo, track);
  const title = currentTrack?.title || (roomId ? 'Waiting for the host’s track' : '');
  const artist = currentTrack?.artist;
  if (!title) return null;

  const { transport, status } = playback;
  const cover = currentTrack?.imageRef;
  const duration = transport.duration || currentTrack?.duration || 0;
  const currentTime = transport.currentTime;
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const startupDetail = mode === 'host' && (status === 'idle' || status === 'preparing') ? (audioStartupStatus ?? undefined) : undefined;
  const isBusy = status === 'preparing' || status === 'joining' || Boolean(startupDetail);

  const roomContext = roomPlaybackPresentation(mode, status, socketStatus);
  const presenceCount = roomPresenceCount(listenerCount, Boolean(roomId));
  const visibleHostName = roomHostDisplayName(hostName);
  const presence = roomPresencePreview(hostName, listeners, listenerCount);

  return (
    <div className='player-dock' data-source={roomId ? mode : 'solo'}>
      <div className='player-dock-inner'>
        <div className='player-dock-track'>
          <button className='player-dock-art' type='button' onClick={onOpenPlayer} aria-label={`Open ${title} in the player`}>
            <CoverImage src={cover} alt='' fallbackLabel={title} loading='eager' sizes='64px' />
          </button>
          <button
            className='player-dock-meta'
            type='button'
            onClick={onOpenPlayer}
            aria-label={
              roomId
                ? `Return to room · ${roomContext.label}${socketStatus === 'online' ? ` · ${presenceCount} people including you` : ''}`
                : `Open ${title} in the player`
            }
            title={roomId ? 'Return to room' : `Open ${title}`}
          >
            {roomId && (
              <span className='player-dock-room'>
                <span className='live-dot' data-online={roomContext.live} aria-hidden='true' />
                <span className='player-dock-room-label'>{roomContext.label}</span>
                {socketStatus === 'online' && (
                  <span className='player-dock-presence'>
                    <AvatarStack {...presence} max={2} size={20} />
                    <span className='player-dock-count'>{presenceCount} here</span>
                  </span>
                )}
              </span>
            )}
            <span className='player-dock-title'>{title}</span>
            {roomId ? (
              <span className='player-dock-artist'>{mode === 'host' ? 'Your room' : visibleHostName ? `With ${visibleHostName}` : 'Listening together'}</span>
            ) : (
              artist && <span className='player-dock-artist'>{artist}</span>
            )}
          </button>
        </div>

        <div className='player-dock-center'>
          <div className='player-dock-controls'>
            {mode === 'host' && (
              <button
                className='player-dock-iconbtn player-dock-skipbtn'
                type='button'
                onClick={() => playback.skip('previous')}
                onPointerEnter={() => playback.prefetchSkip('previous')}
                onPointerDown={() => playback.prefetchSkip('previous')}
                onFocus={() => playback.prefetchSkip('previous')}
                disabled={!playback.canSkip}
                aria-label='Previous track'
                title={playback.canSkip ? 'Previous track' : 'Add more tracks to skip'}
              >
                <SkipBack size={16} />
              </button>
            )}
            <button
              className='player-dock-play'
              type='button'
              onClick={() => void playback.togglePlay()}
              disabled={!playback.canUseTransport}
              data-busy={isBusy}
              aria-label={mode === 'listener' && roomId ? (transport.playing ? 'Pause for me' : 'Resume room audio') : transport.playing ? 'Pause' : 'Play'}
            >
              {isBusy ? (
                <span className='player-dock-dots' aria-hidden='true'>
                  <i />
                  <i />
                  <i />
                </span>
              ) : transport.playing ? (
                <Pause size={18} fill='currentColor' />
              ) : (
                <Play size={18} fill='currentColor' />
              )}
            </button>
            {mode === 'host' && (
              <button
                className='player-dock-iconbtn player-dock-skipbtn'
                type='button'
                onClick={() => playback.skip('next')}
                onPointerEnter={() => playback.prefetchSkip('next')}
                onPointerDown={() => playback.prefetchSkip('next')}
                onFocus={() => playback.prefetchSkip('next')}
                disabled={!playback.canSkip}
                aria-label='Next track'
                title={playback.canSkip ? (playback.shuffleEnabled ? 'Shuffle next track' : 'Next track') : 'Add more tracks to skip'}
              >
                <SkipForward size={16} />
              </button>
            )}
            <button
              className='player-dock-iconbtn player-dock-mutebtn'
              type='button'
              onClick={playback.toggleMute}
              aria-pressed={playback.muted}
              aria-label={playback.muted ? 'Unmute' : 'Mute'}
              title={playback.muted ? 'Unmute' : 'Mute'}
            >
              {playback.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            {mode === 'host' && (
              <button
                className='player-dock-iconbtn player-dock-modebtn'
                type='button'
                onClick={playback.toggleShuffle}
                disabled={!playback.canShuffle}
                aria-pressed={playback.shuffleEnabled}
                aria-label='Shuffle'
                title={playback.canShuffle ? 'Shuffle' : 'Add more tracks to shuffle'}
              >
                <Shuffle size={15} />
              </button>
            )}
            {mode === 'host' && (
              <button
                className='player-dock-iconbtn player-dock-modebtn'
                type='button'
                onClick={playback.toggleRepeat}
                disabled={!playback.canRepeat || !playback.canUseTransport}
                aria-pressed={playback.repeatEnabled}
                aria-label='Repeat this track'
                title='Repeat this track'
              >
                <Repeat1 size={15} />
              </button>
            )}
          </div>
          <div className='player-dock-scrub'>
            <small>{formatClock(currentTime)}</small>
            <input
              className='player-dock-range'
              type='range'
              min={0}
              max={100}
              step={0.1}
              value={progress}
              style={{ '--dock-progress': `${progress}%` } as CSSProperties}
              onChange={event => playback.seekToProgress(Number(event.target.value))}
              disabled={!playback.canSeek}
              aria-label={mode === 'host' ? 'Seek' : 'Room progress'}
              title={mode === 'host' ? 'Seek' : 'The host controls seeking'}
            />
            <small>{formatClock(duration)}</small>
          </div>
        </div>

        <div className='player-dock-right'>
          {locked ? (
            <>
              <span className='player-dock-chip'>Listening closed</span>
              <button className='player-dock-cta' type='button' onClick={onOpenPlayer}>
                <LockKeyhole size={15} />
                Get access
              </button>
            </>
          ) : mode === 'listener' ? (
            <button className='player-dock-cta' type='button' onClick={onOpenPlayer}>
              <Maximize2 size={15} />
              Open room
            </button>
          ) : roomId ? (
            // Already hosting a live room: open it rather than offering to
            // start a second one.
            <button className='player-dock-cta' type='button' onClick={onOpenPlayer}>
              <Radio size={15} />
              Room live
            </button>
          ) : (
            <>
              <button className='player-dock-chip' type='button' onClick={onOpenPlayer} aria-label='Open player'>
                <Maximize2 size={15} />
                Player
              </button>
              <button className='player-dock-cta' type='button' onClick={onStartRoom}>
                <Radio size={15} />
                Listen together
              </button>
            </>
          )}
        </div>
      </div>
      {isBusy && <span className='player-dock-status'>{playbackStatusLabel(status, mode, startupDetail)}</span>}
    </div>
  );
}
