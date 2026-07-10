// ── Player dock (persistent bottom bar) ─────────────────────────────────────
// Real transport controls over the shared persistent audio: play/pause, a
// draggable seek bar, and mute all act in place and never navigate. Only the
// artwork/title and the explicit "Player" affordance open the full player view.

import { LockKeyhole, Maximize2, Pause, Play, Radio, Repeat2, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import type { CSSProperties } from 'react';
import { CoverImage } from './CoverImage';
import { playbackStatusLabel } from '../features/player/playbackStatus';
import { type PlaybackControls } from '../hooks/usePlayback';
import type { CatalogTrack, Mode, TrackInfo } from '../shared/types';

type PlayerDockProps = {
  track: CatalogTrack | undefined;
  trackInfo: TrackInfo | null;
  playback: PlaybackControls;
  mode: Mode;
  roomId: string;
  locked: boolean;
  onOpenPlayer: () => void;
  onOpenArtist: (artistName: string) => void;
  onStartRoom: () => void;
};

function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export function PlayerDock({ track, trackInfo, playback, mode, roomId, locked, onOpenPlayer, onOpenArtist, onStartRoom }: PlayerDockProps) {
  const title = track?.title ?? trackInfo?.title;
  const artist = track?.artist ?? trackInfo?.artist;
  if (!title) return null;

  const { transport, status } = playback;
  const cover = track?.imageRef ?? trackInfo?.imageRef;
  const duration = transport.duration || track?.duration || trackInfo?.duration || 0;
  const currentTime = transport.currentTime;
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const isBusy = status === 'preparing' || status === 'joining';

  return (
    <div className='player-dock'>
      <div className='player-dock-inner'>
        <div className='player-dock-track'>
          <button className='player-dock-art' type='button' onClick={onOpenPlayer} aria-label={`Open ${title} in the player`}>
            {cover && <CoverImage src={cover} alt='' />}
          </button>
          <div className='player-dock-meta'>
            <button className='player-dock-title' type='button' onClick={onOpenPlayer} title={`Open ${title}`}>
              {title}
            </button>
            {artist && (
              <button type='button' onClick={() => onOpenArtist(artist)}>
                {artist}
              </button>
            )}
          </div>
        </div>

        <div className='player-dock-center'>
          <div className='player-dock-controls'>
            <button
              className='player-dock-iconbtn player-dock-skipbtn'
              type='button'
              onClick={() => playback.skip('previous')}
              disabled={!playback.canSkip}
              aria-label='Previous track'
              title={playback.canSkip ? 'Previous track' : 'Add more tracks to skip'}
            >
              <SkipBack size={16} />
            </button>
            <button
              className='player-dock-play'
              type='button'
              onClick={() => void playback.togglePlay()}
              disabled={!playback.canUseTransport}
              data-busy={isBusy}
              aria-label={transport.playing ? 'Pause' : 'Play'}
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
            <button
              className='player-dock-iconbtn player-dock-skipbtn'
              type='button'
              onClick={() => playback.skip('next')}
              disabled={!playback.canSkip}
              aria-label='Next track'
              title={playback.canSkip ? (playback.shuffleEnabled ? 'Shuffle next track' : 'Next track') : 'Add more tracks to skip'}
            >
              <SkipForward size={16} />
            </button>
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
            <button
              className='player-dock-iconbtn player-dock-modebtn'
              type='button'
              onClick={playback.toggleRepeat}
              disabled={!playback.canUseTransport}
              aria-pressed={playback.repeatEnabled}
              aria-label='Repeat this track'
              title='Repeat this track'
            >
              <Repeat2 size={15} />
            </button>
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
              disabled={!playback.canUseTransport || duration <= 0}
              aria-label='Seek'
            />
            <small>{formatClock(duration)}</small>
          </div>
        </div>

        <div className='player-dock-right'>
          {locked ? (
            <>
              <span className='player-dock-chip'>Preview - 42%</span>
              <button className='player-dock-cta' type='button' onClick={onOpenPlayer}>
                <LockKeyhole size={15} />
                Unlock
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
      {isBusy && <span className='player-dock-status'>{playbackStatusLabel(status, mode)}</span>}
    </div>
  );
}
