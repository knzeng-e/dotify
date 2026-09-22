import { ArrowDown, ArrowUp, ListMusic, Play, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useCatalogContext, usePlaybackContext, useSessionContext } from '../app/providers';
import { ROOM_LINEUP_LIMIT } from '../features/player/playbackQueue';

// The host curates one ephemeral playback order and the signaling server mirrors
// its public metadata to everyone in the room. Access checks and source loading
// still happen only when the existing player opens a track.
export function HostLineup() {
  const catalog = useCatalogContext();
  const session = useSessionContext();
  const { playback } = usePlaybackContext();
  const [picked, setPicked] = useState('');
  const isHost = session.mode === 'host';
  const lineup = session.roomLineup;
  const queuedIds = new Set(lineup.map(item => item.trackId));
  const available = catalog.catalogTracks.filter(track => track.active !== false && track.id !== catalog.selectedTrackId && !queuedIds.has(track.id));

  return (
    <details className='host-lineup'>
      <summary>
        <ListMusic size={16} /> Up next
        <span>{lineup[0] ? lineup[0].title : 'Nothing queued'}</span>
      </summary>

      {isHost && (
        <form
          onSubmit={event => {
            event.preventDefault();
            const track = available.find(item => item.id === picked);
            if (!track) return;
            playback.addToLineup(track);
            setPicked('');
          }}
        >
          <label htmlFor='host-plan-track'>Add from the catalog</label>
          <select id='host-plan-track' className='field' value={picked} onChange={event => setPicked(event.target.value)}>
            <option value=''>Choose a track</option>
            {available.map(track => (
              <option value={track.id} key={track.id}>
                {track.title} — {track.artist}
              </option>
            ))}
          </select>
          <button type='submit' className='secondary-action' disabled={!picked || lineup.length >= ROOM_LINEUP_LIMIT}>
            Add
          </button>
        </form>
      )}

      {lineup.length ? (
        <>
          <ol>
            {lineup.map((item, index) => (
              <li key={item.trackId}>
                <span>
                  <small>{index === 0 ? 'Next' : `${index + 1} in line`}</small>
                  <strong>{item.title}</strong>
                  <em>{item.artist}</em>
                </span>
                {isHost && (
                  <>
                    <button
                      type='button'
                      disabled={index === 0}
                      aria-label={`Move ${item.title} earlier`}
                      onClick={() => playback.moveLineupTrack(item.trackId, -1)}
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      type='button'
                      disabled={index === lineup.length - 1}
                      aria-label={`Move ${item.title} later`}
                      onClick={() => playback.moveLineupTrack(item.trackId, 1)}
                    >
                      <ArrowDown size={16} />
                    </button>
                    <button type='button' aria-label={`Remove ${item.title} from queue`} onClick={() => playback.removeFromLineup(item.trackId)}>
                      <X size={16} />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ol>
          {isHost && (
            <div className='host-lineup-actions'>
              <button type='button' className='secondary-action' onClick={() => playback.skip('next')}>
                <Play size={16} /> Play next
              </button>
              <button type='button' className='quiet-action' onClick={playback.clearLineup}>
                <Trash2 size={16} /> Clear
              </button>
            </div>
          )}
        </>
      ) : (
        <p>{isHost ? 'Choose what the room will hear after this track.' : 'The host has not chosen another track yet.'}</p>
      )}
    </details>
  );
}
