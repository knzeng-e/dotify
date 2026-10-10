// Collaborative request queue (the "village square" queue named by the
// improvement plan's room-social item).
//
// Everything here is real. Requests come back from the signaling server,
// which sanitizes, rate-limits, caps, and rebroadcasts the whole list on
// every change -- so the client only ever renders what the room actually
// holds, never an optimistic guess. Names are the display names people
// joined with. This is a shared wishlist the host curates: it is intent,
// not playback, and the UI never claims a request plays itself.

import { ListMusic, Plus, Send, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useCatalogContext, usePlaybackContext, useSessionContext } from '../app/providers';
import { PanelTitle } from '../shared/ui/PanelTitle';
import { ROOM_LINEUP_LIMIT } from '../features/player/playbackQueue';
import { resolveRequestedTrack, roomTrackRequestText } from '../features/rooms/roomCatalogSearch';
import { RoomTrackSearch } from './RoomTrackSearch';
import { formatClockTime } from '../shared/utils/format';
import { Avatar } from './Presence';

export function RoomRequests() {
  const session = useSessionContext();
  const catalog = useCatalogContext();
  const { playback } = usePlaybackContext();
  const { roomId, requestQueue, sendRoomRequest, removeRoomRequest, clearRoomRequests, mode } = session;
  const [draft, setDraft] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const connected = session.socketStatus === 'online';
  const selfId = session.socketRef.current?.id;
  const isHost = mode === 'host';
  const selected = catalog.catalogTracks.find(track => track.id === selectedId && track.active !== false);

  if (!roomId) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || sending || !connected) return;
    const text = roomTrackRequestText(selected);
    setSending(true);
    setSendError('');
    const result = await sendRoomRequest(text);
    setSending(false);
    if (result.ok) {
      setDraft('');
      setSelectedId(null);
    } else setSendError(result.message || 'Request not sent. Your draft is still here.');
  }

  return (
    <div className='doc-panel room-chat-panel room-requests-panel'>
      <PanelTitle
        icon={ListMusic}
        title='Track suggestions'
        meta='the host chooses what plays'
        action={
          isHost && requestQueue.length > 0 ? (
            <button className='room-req-clear' type='button' disabled={!connected} onClick={() => clearRoomRequests()}>
              Clear suggestions
            </button>
          ) : undefined
        }
      />

      <div className='room-chat-list' role='group' aria-live='polite' aria-label='Track requests'>
        {requestQueue.length === 0 ? (
          <p className='room-chat-empty'>What should we hear next? Find a track below and suggest it to the host.</p>
        ) : (
          requestQueue.map(request => {
            const track = resolveRequestedTrack(catalog.catalogTracks, request.text);
            const queued = track && session.roomLineup.some(item => item.trackId === track.id);
            return (
              <div className='room-chat-row room-req-row' key={request.id} data-self={request.senderId === selfId || undefined}>
                <Avatar name={request.senderName} size={26} you={request.senderId === selfId} />
                <div className='room-chat-body'>
                  <span className='room-chat-meta'>
                    <span className='room-chat-name'>{request.senderName}</span>
                    <span className='room-chat-time'>{formatClockTime(request.ts)}</span>
                  </span>
                  <span className='room-chat-text'>{request.text}</span>
                  {isHost && (
                    <small className='room-track-search-hint'>
                      {queued ? 'Added to Up next' : !track ? 'Not matched to an available track' : `Suggested by ${request.senderName}`}
                    </small>
                  )}
                </div>
                {isHost && (
                  <>
                    {track && (
                      <button
                        type='button'
                        className='room-req-add'
                        aria-label={`Add ${track.title} to Up next`}
                        title='Add to Up next'
                        disabled={!connected || !!queued || track.id === catalog.selectedTrackId || session.roomLineup.length >= ROOM_LINEUP_LIMIT}
                        onClick={() => playback.addToLineup(track)}
                      >
                        <Plus size={18} />
                      </button>
                    )}
                    <button
                      className='room-req-veto'
                      type='button'
                      disabled={!connected}
                      onClick={() => removeRoomRequest(request.id)}
                      aria-label={`Remove request from ${request.senderName}`}
                      title='Remove'
                    >
                      <X size={14} />
                    </button>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {(!connected || sendError) && (
        <p className='room-chat-connection' role='status'>
          {!connected ? 'Reconnecting. Your draft stays here.' : sendError}
        </p>
      )}
      <form className='room-request-search-form' onSubmit={event => void handleSubmit(event)} aria-busy={sending}>
        <RoomTrackSearch
          tracks={catalog.catalogTracks}
          query={draft}
          label='Request a track'
          action='Suggest'
          disabled={sending || !connected}
          selected={!!selected}
          onQueryChange={value => {
            setDraft(value);
            setSelectedId(null);
            setSendError('');
          }}
          onPick={track => {
            setSelectedId(track.id);
            setDraft(roomTrackRequestText(track));
          }}
        />
        <button className='primary-action' type='submit' disabled={!selected || sending || !connected} aria-label='Send request'>
          <Send size={16} /> {sending ? 'Sending…' : 'Suggest this track'}
        </button>
      </form>
    </div>
  );
}
