import { ArrowUp, ListMusic, X } from 'lucide-react';
import { useState } from 'react';
import { useCatalogContext, usePlaybackContext } from '../app/providers';

// A local host planning scaffold, deliberately distinct from shared Requests.
// Existing openTrack remains the only authority for access and playback.
export function HostLineup() {
  const catalog = useCatalogContext();
  const { openTrack } = usePlaybackContext();
  const [ids, setIds] = useState<string[]>([]);
  const [picked, setPicked] = useState('');
  const tracks = ids.flatMap(id => {
    const track = catalog.catalogTracks.find(item => item.id === id && item.active !== false);
    return track ? [track] : [];
  });
  const available = catalog.catalogTracks.filter(track => track.active !== false && !ids.includes(track.id));
  return (
    <details className='host-lineup'>
      <summary>
        <ListMusic size={16} /> Up next
      </summary>
      <p>Keep a few tracks close, then choose when the room moves to the next one.</p>
      <form
        onSubmit={event => {
          event.preventDefault();
          if (!available.some(track => track.id === picked) || tracks.length >= 12) return;
          setIds(current => [...current.filter(id => catalog.catalogTracks.some(track => track.id === id && track.active !== false)), picked].slice(0, 12));
          setPicked('');
        }}
      >
        <label htmlFor='host-plan-track'>Choose a track</label>
        <select id='host-plan-track' className='field' value={picked} onChange={event => setPicked(event.target.value)}>
          <option value=''>Choose a track</option>
          {available.map(track => (
            <option value={track.id} key={track.id}>
              {track.title} — {track.artist}
            </option>
          ))}
        </select>
        <button type='submit' className='secondary-action' disabled={!picked || tracks.length >= 12}>
          Add
        </button>
      </form>
      {tracks.length ? (
        <ol>
          {tracks.map((track, index) => (
            <li key={track.id}>
              <span>
                <small>{index === 0 ? 'Planned next' : `Then ${index + 1}`}</small>
                {track.title}
              </span>
              <button
                type='button'
                disabled={index === 0}
                aria-label={`Move ${track.title} earlier`}
                onClick={() =>
                  setIds(current => {
                    const next = current.filter(id => catalog.catalogTracks.some(item => item.id === id && item.active !== false));
                    [next[index - 1], next[index]] = [next[index], next[index - 1]];
                    return next;
                  })
                }
              >
                <ArrowUp size={16} />
              </button>
              <button type='button' aria-label={`Remove ${track.title} from plan`} onClick={() => setIds(current => current.filter(id => id !== track.id))}>
                <X size={16} />
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p>Add tracks you may want to play next.</p>
      )}
      {tracks[0] && (
        <button
          type='button'
          className='secondary-action'
          onClick={() => {
            openTrack(tracks[0]);
            setIds(current => current.filter(id => id !== tracks[0].id));
          }}
        >
          Play next
        </button>
      )}
    </details>
  );
}
