import { Heart, Info, ListMusic, MoreHorizontal, Pause, Play, Repeat1, Shuffle, SkipBack, SkipForward, Volume2, VolumeX, X } from 'lucide-react';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { Dialog } from './Dialog';
import type { PlaybackControls } from '../hooks/usePlayback';
import { transportProgressPercent } from '../features/player/playbackStatus';
import { formatTime } from '../shared/utils/format';

// Presentation only: the shared playback controller still owns transport and
// host authority. Room guests see the host clock without a local seek action.
export function PlayerTransport({
  playback,
  duration,
  listener,
  onOpenQueue,
  onOpenArtist,
  onOpenDetails,
  supportAction
}: {
  playback: PlaybackControls;
  duration: number;
  listener: boolean;
  onOpenQueue?: () => void;
  onOpenArtist?: () => void;
  onOpenDetails?: () => void;
  supportAction?: ReactNode;
}) {
  const { transport } = playback;
  const [optionsOpen, setOptionsOpen] = useState(false);
  const immersive = Boolean(onOpenQueue);
  const shuffle = (
    <button
      className='transport-secondary'
      type='button'
      onClick={playback.toggleShuffle}
      disabled={!playback.canShuffle}
      aria-label='Shuffle'
      aria-pressed={playback.canShuffle && playback.shuffleEnabled}
      data-active={playback.canShuffle && playback.shuffleEnabled}
      title={playback.canShuffle ? 'Shuffle' : 'Add more tracks to shuffle'}
    >
      <Shuffle size={18} />
    </button>
  );
  const repeat = (
    <button
      className='transport-secondary'
      type='button'
      onClick={playback.toggleRepeat}
      disabled={!playback.canRepeat || !playback.canUseTransport}
      aria-label='Repeat this track'
      aria-pressed={playback.canRepeat && playback.repeatEnabled}
      data-active={playback.canRepeat && playback.repeatEnabled}
      title='Repeat this track'
    >
      <Repeat1 size={18} />
    </button>
  );
  const progress = transportProgressPercent(transport.currentTime, duration);
  return (
    <div className='player-transport' data-playing={transport.playing} data-immersive={immersive || undefined} role='group' aria-label='Playback controls'>
      <div className='transport-progress'>
        <span>{formatTime(transport.currentTime)}</span>
        <input
          type='range'
          min={0}
          max={100}
          step={0.1}
          value={progress}
          style={{ '--progress': `${progress}%` } as CSSProperties}
          onChange={event => playback.seekToProgress(Number(event.target.value))}
          disabled={!playback.canSeek}
          aria-label={listener ? 'Room progress' : 'Seek'}
          aria-valuetext={`${formatTime(transport.currentTime)} of ${formatTime(duration)}`}
          title={listener ? 'The host controls seeking' : 'Seek'}
        />
        <span>{formatTime(duration)}</span>
      </div>
      <div className='transport-cluster' role='group' aria-label={listener ? 'Your listening' : 'Track navigation'} data-listener={listener || undefined}>
        {!listener && (
          <>
            <button
              className='transport-skip'
              type='button'
              onClick={() => playback.skip('previous')}
              onPointerEnter={() => playback.prefetchSkip('previous')}
              onPointerDown={() => playback.prefetchSkip('previous')}
              onFocus={() => playback.prefetchSkip('previous')}
              disabled={!playback.canSkip}
              aria-label='Previous track'
              title='Previous track'
            >
              <SkipBack size={20} />
            </button>
          </>
        )}
        <button
          className='transport-play'
          type='button'
          onClick={() => void playback.togglePlay()}
          disabled={!playback.canUseTransport}
          aria-label={listener ? (transport.playing ? 'Pause for me' : 'Resume room audio') : transport.playing ? 'Pause' : 'Play'}
          title={listener ? (transport.playing ? 'Pause for me' : 'Resume room audio') : transport.playing ? 'Pause' : 'Play'}
        >
          {transport.playing ? <Pause size={24} /> : <Play size={24} fill='currentColor' />}
        </button>
        {!listener && (
          <>
            <button
              className='transport-skip'
              type='button'
              onClick={() => playback.skip('next')}
              onPointerEnter={() => playback.prefetchSkip('next')}
              onPointerDown={() => playback.prefetchSkip('next')}
              onFocus={() => playback.prefetchSkip('next')}
              disabled={!playback.canSkip}
              aria-label='Next track'
              title={playback.shuffleEnabled ? 'Shuffle next track' : 'Next track'}
            >
              <SkipForward size={20} />
            </button>
          </>
        )}
      </div>
      <div className='transport-actions' role='group' aria-label='Secondary playback controls'>
        {onOpenDetails && (
          <button type='button' onClick={onOpenDetails} aria-label='About this release' title='About this release'>
            <Info size={18} />
          </button>
        )}
        {!listener && shuffle}
        {!listener && repeat}
        {onOpenQueue && (
          <button type='button' onClick={onOpenQueue} aria-label='Queue' title='Queue'>
            <ListMusic size={18} />
          </button>
        )}
        {supportAction ||
          (onOpenArtist && (
            <button type='button' onClick={onOpenArtist} aria-label='Artist and support' title='Artist and support'>
              <Heart size={18} />
            </button>
          ))}
        <button type='button' onClick={() => setOptionsOpen(true)} aria-label='Listening options' title='Listening options' data-active={playback.muted}>
          <MoreHorizontal size={18} />
        </button>
      </div>
      {optionsOpen && (
        <Dialog historyDismiss labelledBy='playback-options-title' size='compact' onClose={() => setOptionsOpen(false)}>
          <div className='modal-header'>
            <h2 id='playback-options-title'>Listening options</h2>
            <button className='modal-close' type='button' onClick={() => setOptionsOpen(false)} aria-label='Close listening options'>
              <X size={18} />
            </button>
          </div>
          <button className='secondary-action' type='button' onClick={playback.toggleMute} aria-pressed={playback.muted}>
            {playback.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            {playback.muted ? 'Unmute' : 'Mute'}
          </button>
        </Dialog>
      )}
    </div>
  );
}
