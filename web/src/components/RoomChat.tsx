import { ArrowDown, LoaderCircle, MessageCircle, Send } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSessionContext } from '../app/providers';
import { roomPresenceCount } from '../features/rooms/roomState';
import { PanelTitle } from '../shared/ui/PanelTitle';
import { CHAT_TEXT_MAX_LENGTH } from '../shared/social';
import { formatClockTime } from '../shared/utils/format';
import { Avatar } from './Presence';

export function RoomChat({ active = true, onUnreadChange }: { active?: boolean; onUnreadChange?: (unread: boolean) => void }) {
  const session = useSessionContext();
  const { roomId, chatMessages, sendChatMessage } = session;
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [unread, setUnread] = useState(false);
  const followingRef = useRef(true);
  const lastMessageIdRef = useRef<string>();
  const connected = session.socketStatus === 'online';
  const listRef = useRef<HTMLDivElement | null>(null);
  const selfId = session.socketRef.current?.id;
  const hostId = session.mode === 'host' ? selfId : session.hostIdRef.current;

  useEffect(() => onUnreadChange?.(unread), [unread, onUnreadChange]);

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

  // Keyboard/viewport changes should keep a live reader at the newest message,
  // without pulling somebody who is reading older messages back to the bottom.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const observer = new ResizeObserver(() => {
      if (active && followingRef.current) list.scrollTop = list.scrollHeight;
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, [active]);

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

      <div className='room-chat-stream'>
        <div
          className='room-chat-list'
          ref={listRef}
          onScroll={event => {
            if (!active) return;
            const list = event.currentTarget;
            followingRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 90;
            if (followingRef.current) setUnread(false);
          }}
          role='log'
          aria-live={active ? 'polite' : 'off'}
          aria-relevant='additions'
          aria-label='Room chat messages'
        >
          <div className='room-chat-messages'>
            {chatMessages.length === 0 ? (
              <div className='room-chat-empty'>
                <MessageCircle size={24} aria-hidden='true' />
                <p>Same track. Your people.</p>
                <span>Say hello to the room.</span>
              </div>
            ) : (
              chatMessages.map(message => (
                <div
                  className='room-chat-row'
                  key={message.id}
                  data-contribution={message.senderId === 'dotify-confirmed-tip' || undefined}
                  data-self={message.senderId === selfId || undefined}
                >
                  <Avatar name={message.senderName} size={24} you={message.senderId === selfId} />
                  <div className='room-chat-body'>
                    <span className='room-chat-name'>{message.senderName}</span>
                    {message.senderId === hostId && <span className='room-chat-role'>Host</span>}
                    {message.senderId === selfId && <span className='room-chat-you'>You</span>} <span className='room-chat-text'>{message.text}</span>
                  </div>
                  <time className='room-chat-time' dateTime={new Date(message.ts).toISOString()}>
                    {formatClockTime(message.ts)}
                  </time>
                </div>
              ))
            )}
          </div>
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
            <ArrowDown size={14} aria-hidden='true' /> New messages
          </button>
        )}
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
          onKeyDown={event => {
            if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault();
          }}
        />
        <button className='room-chat-send' type='submit' disabled={!draft.trim() || sending || !connected} aria-label='Send message'>
          {sending ? <LoaderCircle size={18} /> : <Send size={18} />}
        </button>
      </form>
      {draft.length >= CHAT_TEXT_MAX_LENGTH - 30 && (
        <span className='room-chat-limit' role='status'>
          {draft.length}/{CHAT_TEXT_MAX_LENGTH}
        </span>
      )}
    </div>
  );
}
