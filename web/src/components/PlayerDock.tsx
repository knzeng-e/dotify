// ── Player dock ─────────────────────────────────────────────────────────────
// Persistent bottom bar shown on discovery / rooms once a track has been opened.
// The actual <audio> element lives in the player view, so the dock is a "now
// playing / jump back in" affordance: its controls resume the track in the player
// rather than faking a second audio source. Progress reflects the last position.

import { Headphones, LockKeyhole, Play, Radio } from 'lucide-react';
import type { CatalogTrack, PlayerState, TrackInfo } from '../types';

type PlayerDockProps = {
  track: CatalogTrack | undefined;
  trackInfo: TrackInfo | null;
  playerState: PlayerState | null;
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

export function PlayerDock({ track, trackInfo, playerState, locked, onOpenPlayer, onOpenArtist, onStartRoom }: PlayerDockProps) {
  const title = track?.title ?? trackInfo?.title;
  const artist = track?.artist ?? trackInfo?.artist;
  if (!title) return null;

  const cover = track?.imageRef ?? trackInfo?.imageRef;
  const duration = playerState?.duration ?? track?.duration ?? trackInfo?.duration ?? 0;
  const currentTime = playerState?.currentTime ?? 0;
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  return (
    <div className='player-dock'>
      <div className='player-dock-inner'>
        <div className='player-dock-track'>
          <button className='player-dock-art' type='button' onClick={onOpenPlayer} aria-label={`Open ${title} in the player`}>
            {cover && <img src={cover} alt='' crossOrigin='anonymous' />}
          </button>
          <div className='player-dock-meta'>
            <strong>{title}</strong>
            {artist && (
              <button type='button' onClick={() => onOpenArtist(artist)}>
                {artist}
              </button>
            )}
          </div>
        </div>

        <div className='player-dock-center'>
          <div className='player-dock-controls'>
            <button className='player-dock-play' type='button' onClick={onOpenPlayer} aria-label='Open player'>
              <Play size={18} fill='currentColor' />
            </button>
          </div>
          <div className='player-dock-scrub'>
            <small>{formatClock(currentTime)}</small>
            <button className='player-dock-bar' type='button' onClick={onOpenPlayer} aria-label='Open player to scrub'>
              <i style={{ width: `${progress * 100}%` }} />
            </button>
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
          ) : (
            <>
              <button className='player-dock-chip' type='button' onClick={onOpenPlayer} aria-label='Open player'>
                <Headphones size={15} />
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
    </div>
  );
}
