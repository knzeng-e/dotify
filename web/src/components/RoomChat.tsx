import { ArrowDown, LoaderCircle, MessageCircle, Send, Bell, BellOff, BadgeCheck, Pin, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSessionContext } from '../app/providers';
import { roomPresenceCount } from '../features/rooms/roomState';
import { PanelTitle } from '../shared/ui/PanelTitle';
import { CHAT_TEXT_MAX_LENGTH } from '../shared/social';
import type { RoomChatMessage as Message } from '../shared/types';
import { RoomChatMessage } from './RoomChatMessage';
import { chatTimeline, typingLabel } from '../features/rooms/chatTimeline';
import { updateChatUnread, type ChatReadState } from '../features/rooms/chatUnread';

export function RoomChat({
  active = true,
  onUnreadChange,
  onMentionChange
}: {
  active?: boolean;
  onUnreadChange?: (unread: number) => void;
  onMentionChange?: (count: number) => void;
}) {
  const session = useSessionContext();
  const { roomId, chatMessages, sendChatMessage } = session;
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [unread, setUnread] = useState(0);
  const [mentions, setMentions] = useState(0);
  const [firstUnread, setFirstUnread] = useState<string>();
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [showActivity, setShowActivity] = useState(true);
  const [clock, setClock] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const lastTypingRef = useRef(0);
  const followingRef = useRef(true);
  const readStateRef = useRef<ChatReadState | null>(null);
  const connected = session.socketStatus === 'online';
  const listRef = useRef<HTMLDivElement | null>(null);
  const selfId = session.socketRef.current?.id;
  const hostId = session.mode === 'host' ? selfId : session.hostIdRef.current;

  useEffect(() => onUnreadChange?.(unread), [unread, onUnreadChange]);
  useEffect(() => onMentionChange?.(mentions), [mentions, onMentionChange]);
  const socket = session.socketRef.current;
  useEffect(() => {
    if (!active || !draft.trim() || !connected) {
      socket?.emitVolatile('room:typing', { active: false });
      lastTypingRef.current = 0;
    }
  }, [active, draft, connected, socket]);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    const hidden = () => {
      if (document.hidden) socket?.emitVolatile('room:typing', { active: false });
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', hidden);
      socket?.emitVolatile('room:typing', { active: false });
    };
  }, [socket]);

  // Follow the conversation unless the reader has scrolled up into history.
  useEffect(() => {
    const list = listRef.current;
    readStateRef.current = updateChatUnread(readStateRef.current, chatMessages, selfId, active && followingRef.current);
    setUnread(readStateRef.current.unread);
    setMentions(readStateRef.current.mentions);
    setFirstUnread(readStateRef.current.firstUnread);
    if (!list) return;
    if (active && followingRef.current) {
      list.scrollTop = list.scrollHeight;
    }
  }, [chatMessages, active, selfId]);

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
    const result = await sendChatMessage(text, { replyTo: replyTo?.id, mentions: mentionIds });
    setSending(false);
    if (result.ok) {
      setDraft(current => (current.trim() === text ? '' : current));
      setReplyTo(null);
      setMentionIds([]);
    } else setSendError(result.message || 'Message not sent. Your draft is still here.');
  }
  function markRead() {
    if (readStateRef.current) {
      readStateRef.current.unread = 0;
      readStateRef.current.mentions = 0;
      readStateRef.current.firstUnread = undefined;
    }
    setUnread(0);
    setMentions(0);
    setFirstUnread(undefined);
  }
  function pin(id: string | null) {
    socket?.request('room:pin', { id }, { timeoutMs: 5000, volatile: true }, (error, result) => {
      if (error || !result?.ok) setSendError('Could not update the pinned message. Try again.');
    });
  }
  const timeline = chatTimeline(chatMessages, session.roomActivity, showActivity);
  const typing = typingLabel(session.roomTyping.filter(entry => entry.id !== selfId && entry.expiresAt > clock).map(entry => entry.name));
  const mentionQuery = /(?:^|\s)@([^@]*)$/.exec(draft)?.[1];
  const participants = [...session.listeners, { id: hostId ?? '', displayName: session.hostName }].filter(person => person.id && person.id !== selfId);
  const suggestions =
    mentionQuery === undefined ? [] : participants.filter(person => person.displayName.toLowerCase().startsWith(mentionQuery.toLowerCase())).slice(0, 5);

  return (
    <div className='doc-panel room-chat-panel'>
      <PanelTitle icon={MessageCircle} title='Room chat' meta={connected ? `${roomPresenceCount(session.listenerCount, true)} here` : 'Reconnecting'} />
      <button
        type='button'
        className='text-action room-chat-activity-toggle'
        aria-label={showActivity ? 'Hide room activity' : 'Show room activity'}
        aria-pressed={!showActivity}
        onClick={() => setShowActivity(value => !value)}
      >
        {showActivity ? <Bell size={16} /> : <BellOff size={16} />}
      </button>
      {session.pinnedMessage && (
        <div className='room-chat-pinned'>
          <Pin size={15} aria-hidden='true' />
          <p>
            <strong>{session.pinnedMessage.senderName}</strong> {session.pinnedMessage.text}
          </p>
          {session.mode === 'host' && (
            <button type='button' className='text-action' aria-label='Unpin message' onClick={() => pin(null)}>
              <X size={16} />
            </button>
          )}
        </div>
      )}

      <div className='room-chat-stream'>
        <div
          className='room-chat-list'
          ref={listRef}
          onScroll={event => {
            if (!active) return;
            const list = event.currentTarget;
            followingRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 90;
            if (followingRef.current) {
              markRead();
            }
          }}
          role='log'
          aria-live={active ? 'polite' : 'off'}
          aria-relevant='additions'
          aria-label='Room chat messages'
        >
          <div className='room-chat-messages'>
            {timeline.length === 0 ? (
              <div className='room-chat-empty'>
                <MessageCircle size={24} aria-hidden='true' />
                <p>Same track. Your people.</p>
                <span>Say hello to the room.</span>
              </div>
            ) : (
              timeline.map(entry => (
                <div key={entry.id}>
                  {firstUnread === entry.id && <div className='room-chat-unread-divider'>New messages</div>}
                  {entry.message ? (
                    <RoomChatMessage
                      message={entry.message}
                      selfId={selfId}
                      hostId={hostId}
                      canPin={session.mode === 'host' && connected}
                      onPin={pin}
                      onReply={message => {
                        setReplyTo(message);
                        inputRef.current?.focus();
                      }}
                    />
                  ) : (
                    <div className='room-chat-activity' data-artist={Boolean(entry.activity?.artist) || undefined}>
                      {entry.activity?.artist && <BadgeCheck size={16} aria-hidden='true' />}
                      <span>{entry.text}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {unread > 0 && (
          <button
            type='button'
            className='room-chat-latest'
            onClick={() => {
              followingRef.current = true;
              const first = readStateRef.current?.firstUnread;
              const target = first
                ? Array.from(listRef.current?.querySelectorAll<HTMLElement>('[data-message-id]') ?? []).find(row => row.dataset.messageId === first)
                : null;
              if (target && listRef.current) {
                followingRef.current = false;
                listRef.current.scrollTop += target.getBoundingClientRect().top - listRef.current.getBoundingClientRect().top;
              } else if (listRef.current) {
                listRef.current.scrollTop = listRef.current.scrollHeight;
                markRead();
              }
            }}
          >
            <ArrowDown size={14} aria-hidden='true' /> {unread} new {unread === 1 ? 'message' : 'messages'}
          </button>
        )}
      </div>
      <div className='room-chat-typing' role='status' aria-live={active ? 'polite' : 'off'}>
        {typing && (
          <>
            <span aria-hidden='true'>•••</span> {typing}
          </>
        )}
      </div>
      {replyTo && (
        <div className='room-chat-reply-draft'>
          <span>
            Replying to <strong>{replyTo.artist?.name ?? replyTo.senderName}</strong>
          </span>
          <button type='button' className='text-action' aria-label='Cancel reply' onClick={() => setReplyTo(null)}>
            <X size={16} />
          </button>
        </div>
      )}
      {suggestions.length > 0 && (
        <div className='room-chat-mention-picker' aria-label='Mention someone'>
          {suggestions.map(person => (
            <button
              type='button'
              key={person.id}
              onClick={() => {
                setDraft(value => value.slice(0, value.lastIndexOf('@')) + `@${person.displayName} `);
                setMentionIds(ids => [...new Set([...ids, person.id])].slice(0, 5));
                inputRef.current?.focus();
              }}
            >
              @{person.displayName}
            </button>
          ))}
        </div>
      )}

      {(!connected || sendError) && (
        <p className='room-chat-connection' role='status'>
          {!connected ? 'Reconnecting. Your draft stays here.' : sendError}
        </p>
      )}
      <form className='room-chat-form' onSubmit={event => void handleSubmit(event)} aria-busy={sending}>
        <input
          className='field'
          ref={inputRef}
          value={draft}
          onChange={event => {
            const value = event.target.value;
            setDraft(value);
            setMentionIds(ids => ids.filter(id => participants.some(person => person.id === id && value.includes(`@${person.displayName}`))));
            if (value.trim() && connected && Date.now() - lastTypingRef.current > 1500) {
              socket?.emitVolatile('room:typing', { active: true });
              lastTypingRef.current = Date.now();
            }
          }}
          onBlur={() => socket?.emitVolatile('room:typing', { active: false })}
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
