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
import { roomPresenceCount } from '../features/rooms/roomState';
import { PanelTitle } from '../shared/ui/PanelTitle';
import { CHAT_TEXT_MAX_LENGTH, ROOM_REACTIONS } from '../shared/social';
import { formatClockTime } from '../shared/utils/format';
import { Avatar } from './Presence';

const REACTION_LABELS = ['heart', 'fire', 'leaf', 'sparkle', 'raise', 'tear'];

export function RoomChat({ active = true }: { active?: boolean }) {
  const session = useSessionContext();
  const { roomId, chatMessages, sendChatMessage, sendRoomReaction } = session;
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [unread, setUnread] = useState(false);
  const followingRef = useRef(true);
  const lastMessageIdRef = useRef<string>();
  const connected = session.socketStatus === 'online';
  const listRef = useRef<HTMLDivElement | null>(null);
  const selfId = session.socketRef.current?.id;

  // Follow the conversation unless the reader has scrolled up into history.
  useEffect(() => {
    const list = listRef.current;
    const latestId = chatMessages[chatMessages.length - 1]?.id;
    const changed = latestId !== lastMessageIdRef.current;
    lastMessageIdRef.current = latestId;
    if (!list) return;
    if (active && followingRef.current) {
      list.scrollTop = list.scrollHeight;
      setUnread(false);
    } else if (changed) setUnread(true);
  }, [chatMessages, active]);

  if (!roomId) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending || !connected) return;
    setSending(true);
    setSendError('');
    followingRef.current = true;
    const result = await sendChatMessage(text);
    setSending(false);
    if (result.ok) setDraft(current => (current.trim() === text ? '' : current));
    else setSendError(result.message || 'Message not sent. Your draft is still here.');
  }

  return (
    <div className='doc-panel room-chat-panel'>
      <PanelTitle icon={MessageCircle} title='Room chat' meta={connected ? `${roomPresenceCount(session.listenerCount, true)} here` : 'Reconnecting'} />

      <div
        className='room-chat-list'
        ref={listRef}
        onScroll={event => {
          const list = event.currentTarget;
          followingRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 90;
          if (followingRef.current) setUnread(false);
        }}
        role='log'
        aria-live='polite'
        aria-relevant='additions'
        aria-label='Room chat messages'
      >
        {chatMessages.length === 0 ? (
          <p className='room-chat-empty'>Say hello. Everyone in the room reads this, and it disappears when the room closes.</p>
        ) : (
          chatMessages.map(message => (
            <div className='room-chat-row' key={message.id} data-self={message.senderId === selfId || undefined}>
              <Avatar name={message.senderName} size={26} you={message.senderId === selfId} />
              <div className='room-chat-body'>
                <span className='room-chat-meta'>
                  <span className='room-chat-name'>{message.senderName}</span>
                  <span className='room-chat-time'>{formatClockTime(message.ts)}</span>
                </span>
                <span className='room-chat-text'>{message.text}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {unread && (
        <button
          type='button'
          className='room-chat-latest'
          onClick={() => {
            followingRef.current = true;
            setUnread(false);
            if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
          }}
        >
          New messages ↓
        </button>
      )}
      <div className='room-chat-reactions' aria-label='Send a reaction to the room'>
        {ROOM_REACTIONS.map((emoji, index) => (
          <button
            className='room-react-btn'
            type='button'
            key={REACTION_LABELS[index]}
            disabled={!connected}
            onClick={() => sendRoomReaction(emoji)}
            aria-label={`React ${REACTION_LABELS[index]}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {(!connected || sendError) && (
        <p className='room-chat-connection' role='status'>
          {!connected ? 'Reconnecting. Your draft stays here.' : sendError}
        </p>
      )}
      <form className='room-chat-form' onSubmit={event => void handleSubmit(event)} aria-busy={sending}>
        <input
          className='field'
          value={draft}
          onChange={event => setDraft(event.target.value)}
          placeholder='Message the room'
          maxLength={CHAT_TEXT_MAX_LENGTH}
          aria-label='Message the room'
          autoComplete='off'
        />
        <button className='room-chat-send' type='submit' disabled={!draft.trim() || sending || !connected} aria-label='Send message'>
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
