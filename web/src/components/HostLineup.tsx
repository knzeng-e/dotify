import { ArrowUp, ListMusic, X } from 'lucide-react';
import { useState } from 'react';
import { useCatalogContext, usePlaybackContext, useSessionContext } from '../app/providers';
import type { RoomLineupTrack } from '../shared/types';

// Shared intent, not an autoplay authority. Opening never removes an entry:
// the host may still need access, or the track may no longer be available.
export function HostLineup() {
  const catalog = useCatalogContext();
  const { openTrack } = usePlaybackContext();
  const session = useSessionContext();
  const [picked, setPicked] = useState('');
  const [requestId, setRequestId] = useState('');
  // Requests can disappear while the host is choosing a track. Derive both
  // the visible selection and accepted ID from the current server snapshot.
  const acceptedRequestId = session.requestQueue.find(request => request.id === requestId)?.id;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const isHost = session.mode === 'host';
  const tracks = session.roomLineup?.tracks ?? [];
  const connected = session.socketStatus === 'online';
  const disabled = pending || !connected || !session.roomLineup;
  const available = catalog.catalogTracks.filter(track => track.active !== false && !tracks.some(item => item.id === track.id));

  async function update(next: RoomLineupTrack[], acceptedRequestId?: string) {
    if (disabled) return false;
    setPending(true);
    setError('');
    const result = await session.updateRoomLineup(next, acceptedRequestId);
    setPending(false);
    if (!result.ok) setError(result.message || 'The queue could not be updated.');
    return result.ok;
  }

  return (
    <details className='host-lineup' open>
      <summary>
        <ListMusic size={16} /> Up next <span>Preview · shared</span>
      </summary>
      <p>
        {session.roomLineup
          ? 'The host shapes the order and starts each track. The queue lasts for this room.'
          : 'The shared queue is unavailable on this room service.'}
      </p>
      {!connected && <p role='status'>Reconnecting. This order may have changed.</p>}
      {isHost && session.roomLineup && (
        <form
          onSubmit={event => {
            event.preventDefault();
            const track = available.find(item => item.id === picked);
            if (!track || tracks.length >= 12 || disabled) return;
            void update([...tracks, { id: track.id, title: track.title, artist: track.artist }], acceptedRequestId).then(ok => {
              if (ok) {
                setPicked('');
                setRequestId('');
              }
            });
          }}
          aria-busy={pending}
        >
          <label htmlFor='host-plan-track'>Track for room queue</label>
          <select id='host-plan-track' className='field' value={picked} disabled={disabled} onChange={event => setPicked(event.target.value)}>
            <option value=''>Choose a track</option>
            {available.map(track => (
              <option value={track.id} key={track.id}>
                {track.title} — {track.artist}
              </option>
            ))}
          </select>
          <button type='submit' className='secondary-action' disabled={!picked || tracks.length >= 12 || disabled}>
            Add
          </button>
          {session.requestQueue.length > 0 && (
            <label className='lineup-request'>
              For a request (optional)
              <select className='field' value={acceptedRequestId ?? ''} disabled={disabled} onChange={event => setRequestId(event.target.value)}>
                <option value=''>Host’s choice</option>
                {session.requestQueue.map(request => (
                  <option key={request.id} value={request.id}>
                    {request.senderName}: {request.text}
                  </option>
                ))}
              </select>
            </label>
          )}
        </form>
      )}
      {error && <p role='status'>{error}</p>}
      {tracks.length ? (
        <ol aria-label='Room queue'>
          {tracks.map((track, index) => {
            const playable = catalog.catalogTracks.find(item => item.id === track.id && item.active !== false);
            return (
              <li key={track.id}>
                <span>
                  <small>{index === 0 ? 'Planned next' : `Then ${index + 1}`}</small>
                  {track.title}
                  <small>{track.artist}</small>
                  {isHost && !playable && <small>Unavailable in your catalog. Remove or choose another track.</small>}
                </span>
                {isHost && (
                  <>
                    <button
                      type='button'
                      disabled={index === 0 || disabled}
                      aria-label={`Move ${track.title} earlier`}
                      onClick={() => {
                        const next = [...tracks];
                        [next[index - 1], next[index]] = [next[index], next[index - 1]];
                        void update(next);
                      }}
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      type='button'
                      disabled={disabled}
                      aria-label={`Remove ${track.title} from queue`}
                      onClick={() => void update(tracks.filter(item => item.id !== track.id))}
                    >
                      <X size={16} />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <p>{isHost ? 'Choose a few tracks for the room’s next moments.' : 'The host has not chosen the next track yet. You can send a request below.'}</p>
      )}
      {isHost && tracks[0] && (
        <button
          type='button'
          className='secondary-action'
          disabled={disabled || !catalog.catalogTracks.some(track => track.id === tracks[0].id && track.active !== false)}
          onClick={() => {
            const track = catalog.catalogTracks.find(item => item.id === tracks[0].id && item.active !== false);
            if (track) {
              openTrack(track);
              setError('Track selected. Start it when ready, then remove it from the queue. Listening terms still apply.');
            }
          }}
        >
          Open next track
        </button>
      )}
    </details>
  );
}
