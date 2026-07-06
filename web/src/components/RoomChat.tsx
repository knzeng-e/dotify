// Room chat aside (the "presence/chatter aside" named by ticket 15).
//
// Everything shown here is real: messages come back from the signaling
// server (which sanitizes, rate-limits, and buffers the last 50 per room),
// names are the display names people joined with, and the reaction row
// broadcasts to everyone in the room. Nothing renders optimistically -- the
// server echo is the single render path, so what you see is what the room saw.

import { MessageCircle, Send } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSessionContext } from '../app/providers';
import { PanelTitle } from '../shared/ui/PanelTitle';
import { CHAT_TEXT_MAX_LENGTH, ROOM_REACTIONS } from '../shared/social';
import { Avatar } from './Presence';

const REACTION_LABELS = ['heart', 'fire', 'leaf', 'sparkle', 'raise', 'tear'];

function formatClock(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function RoomChat() {
  const session = useSessionContext();
  const { roomId, chatMessages, sendChatMessage, sendRoomReaction } = session;
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);
  const selfId = session.socketRef.current?.id;

  // Follow the conversation unless the reader has scrolled up into history.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 90;
    if (nearBottom) {
      list.scrollTop = list.scrollHeight;
    }
  }, [chatMessages]);

  if (!roomId) return null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    sendChatMessage(text);
    setDraft('');
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }

  return (
    <div className='doc-panel room-chat-panel'>
      <PanelTitle icon={MessageCircle} title='Room chat' meta='everyone here' />

      <div className='room-chat-list' ref={listRef} aria-live='polite' aria-label='Room chat messages'>
        {chatMessages.length === 0 ? (
          <p className='room-chat-empty'>Say hello. Everyone in the room reads this, and it disappears when the room closes.</p>
        ) : (
          chatMessages.map(message => (
            <div className='room-chat-row' key={message.id} data-self={message.senderId === selfId || undefined}>
              <Avatar name={message.senderName} size={26} you={message.senderId === selfId} />
              <div className='room-chat-body'>
                <span className='room-chat-meta'>
                  <span className='room-chat-name'>{message.senderName}</span>
                  <span className='room-chat-time'>{formatClock(message.ts)}</span>
                </span>
                <span className='room-chat-text'>{message.text}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className='room-chat-reactions' aria-label='Send a reaction to the room'>
        {ROOM_REACTIONS.map((emoji, index) => (
          <button
            className='room-react-btn'
            type='button'
            key={REACTION_LABELS[index]}
            onClick={() => sendRoomReaction(emoji)}
            aria-label={`React ${REACTION_LABELS[index]}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      <form className='room-chat-form' onSubmit={handleSubmit}>
        <input
          className='field'
          value={draft}
          onChange={event => setDraft(event.target.value)}
          placeholder='Message the room'
          maxLength={CHAT_TEXT_MAX_LENGTH}
          aria-label='Message the room'
          autoComplete='off'
        />
        <button className='room-chat-send' type='submit' disabled={!draft.trim()} aria-label='Send message'>
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
