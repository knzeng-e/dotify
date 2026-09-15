import { Pause, Play, Repeat1, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { PlaybackControls } from '../hooks/usePlayback';
import { transportProgressPercent } from '../features/player/playbackStatus';
import { formatTime } from '../shared/utils/format';

// Presentation only: the shared playback controller still owns transport and
// host authority. Room guests see the host clock without a local seek action.
export function PlayerTransport({ playback, duration, listener }: { playback: PlaybackControls; duration: number; listener: boolean }) {
  const { transport } = playback;
  const progress = transportProgressPercent(transport.currentTime, duration);
  return (
    <div className='player-transport' data-playing={transport.playing} role='group' aria-label='Playback controls'>
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
      <div className='transport-cluster' role='group' aria-label='Track navigation'>
        <button
          type='button'
          onClick={playback.toggleShuffle}
          disabled={!playback.canShuffle}
          aria-label='Shuffle'
          aria-pressed={playback.canShuffle && playback.shuffleEnabled}
          data-active={playback.canShuffle && playback.shuffleEnabled}
          title={listener ? 'The host chooses the track order' : playback.canShuffle ? 'Shuffle' : 'Add more tracks to shuffle'}
        >
          <Shuffle size={18} />
        </button>
        <button
          className='transport-skip'
          type='button'
          onClick={() => playback.skip('previous')}
          disabled={!playback.canSkip}
          aria-label='Previous track'
          title={listener ? 'The host chooses the tracks' : 'Previous track'}
        >
          <SkipBack size={20} />
        </button>
        <button
          className='transport-play'
          type='button'
          onClick={() => void playback.togglePlay()}
          disabled={!playback.canUseTransport}
          aria-label={transport.playing ? 'Pause' : 'Play'}
        >
          {transport.playing ? <Pause size={24} /> : <Play size={24} />}
        </button>
        <button
          className='transport-skip'
          type='button'
          onClick={() => playback.skip('next')}
          disabled={!playback.canSkip}
          aria-label='Next track'
          title={listener ? 'The host chooses the tracks' : playback.shuffleEnabled ? 'Shuffle next track' : 'Next track'}
        >
          <SkipForward size={20} />
        </button>
        <button
          type='button'
          onClick={playback.toggleRepeat}
          disabled={!playback.canRepeat || !playback.canUseTransport}
          aria-label='Repeat this track'
          aria-pressed={playback.canRepeat && playback.repeatEnabled}
          data-active={playback.canRepeat && playback.repeatEnabled}
          title={listener ? 'The host controls repetition' : 'Repeat this track'}
        >
          <Repeat1 size={18} />
        </button>
      </div>
      <div className='transport-actions' role='group' aria-label='Volume'>
        <button
          type='button'
          onClick={playback.toggleMute}
          aria-pressed={playback.muted}
          data-active={playback.muted}
          aria-label={playback.muted ? 'Unmute' : 'Mute'}
          title={playback.muted ? 'Unmute' : 'Mute'}
        >
          {playback.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>
    </div>
  );
}
