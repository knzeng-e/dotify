// Collaborative request queue (the "village square" queue named by the
// improvement plan's room-social item).
//
// Everything here is real. Requests come back from the signaling server,
// which sanitizes, rate-limits, caps, and rebroadcasts the whole list on
// every change -- so the client only ever renders what the room actually
// holds, never an optimistic guess. Names are the display names people
// joined with. This is a shared wishlist the host curates: it is intent,
// not playback, and the UI never claims a request plays itself.

import { ListMusic, Send, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useSessionContext } from '../app/providers';
import { PanelTitle } from '../shared/ui/PanelTitle';
import { REQUEST_TEXT_MAX_LENGTH } from '../shared/social';
import { formatClockTime } from '../shared/utils/format';
import { Avatar } from './Presence';

export function RoomRequests() {
  const session = useSessionContext();
  const { roomId, requestQueue, sendRoomRequest, removeRoomRequest, clearRoomRequests, mode } = session;
  const [draft, setDraft] = useState('');
  const selfId = session.socketRef.current?.id;
  const isHost = mode === 'host';

  if (!roomId) return null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    sendRoomRequest(text);
    setDraft('');
  }

  return (
    <div className='doc-panel room-chat-panel room-requests-panel'>
      <PanelTitle
        icon={ListMusic}
        title='Requests'
        meta='the host picks'
        action={
          isHost && requestQueue.length > 0 ? (
            <button className='room-req-clear' type='button' onClick={() => clearRoomRequests()}>
              Clear
            </button>
          ) : undefined
        }
      />

      <div className='room-chat-list' aria-live='polite' aria-label='Track requests'>
        {requestQueue.length === 0 ? (
          <p className='room-chat-empty'>No requests yet. Anyone here can suggest what to play next; the host decides what actually plays.</p>
        ) : (
          requestQueue.map(request => (
            <div className='room-chat-row room-req-row' key={request.id} data-self={request.senderId === selfId || undefined}>
              <Avatar name={request.senderName} size={26} you={request.senderId === selfId} />
              <div className='room-chat-body'>
                <span className='room-chat-meta'>
                  <span className='room-chat-name'>{request.senderName}</span>
                  <span className='room-chat-time'>{formatClockTime(request.ts)}</span>
                </span>
                <span className='room-chat-text'>{request.text}</span>
              </div>
              {isHost && (
                <button
                  className='room-req-veto'
                  type='button'
                  onClick={() => removeRoomRequest(request.id)}
                  aria-label={`Remove request from ${request.senderName}`}
                  title='Remove'
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <form className='room-chat-form' onSubmit={handleSubmit}>
        <input
          className='field'
          value={draft}
          onChange={event => setDraft(event.target.value)}
          placeholder='Request a track'
          maxLength={REQUEST_TEXT_MAX_LENGTH}
          aria-label='Request a track'
          autoComplete='off'
        />
        <button className='room-chat-send' type='submit' disabled={!draft.trim()} aria-label='Send request'>
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
