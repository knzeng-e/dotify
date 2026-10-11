import { useEffect, useId, useRef, useState } from 'react';
import { BadgeCheck, HeartHandshake, MoreHorizontal, Pin, Reply } from 'lucide-react';
import type { RoomChatMessage as Message } from '../shared/types';
import { formatClockTime } from '../shared/utils/format';
import { Avatar } from './Presence';
import { useSwipeReply } from '../features/rooms/useSwipeReply';

export function RoomChatMessage({
  message,
  selfId,
  hostId,
  canPin,
  onReply,
  onPin
}: {
  message: Message;
  selfId?: string;
  hostId?: string;
  canPin: boolean;
  onReply: (message: Message) => void;
  onPin: (id: string) => void;
}) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsId = useId();
  const rowRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const reply = () => {
    setActionsOpen(false);
    onReply(message);
  };
  const { offset, ...swipe } = useSwipeReply(reply);
  useEffect(() => {
    if (!actionsOpen) return;
    function outside(event: globalThis.PointerEvent) {
      if (!rowRef.current?.contains(event.target as Node)) setActionsOpen(false);
    }
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [actionsOpen]);
  if (message.senderId === 'dotify-confirmed-tip')
    return (
      <div className='room-chat-activity' data-contribution='true'>
        <HeartHandshake size={15} aria-hidden='true' />
        <span>{message.text}</span>
      </div>
    );
  return (
    <div
      ref={rowRef}
      className='room-chat-row room-chat-interactive'
      data-message-id={message.id}
      data-self={message.senderId === selfId || undefined}
      data-artist={Boolean(message.artist) || undefined}
      data-actions-open={actionsOpen || undefined}
      data-swiping={offset > 0 || undefined}
      style={{ transform: offset ? `translateX(${offset}px)` : undefined }}
      {...swipe}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setActionsOpen(false);
      }}
      onKeyDown={event => {
        if (event.key === 'Escape' && actionsOpen) {
          event.stopPropagation();
          setActionsOpen(false);
          actionRef.current?.focus();
        }
      }}
    >
      {offset > 0 && <Reply className='room-chat-swipe-cue' size={18} aria-hidden='true' data-ready={offset >= 52} />}
      <Avatar name={message.artist?.name ?? message.senderName} size={24} you={message.senderId === selfId} />
      <div className='room-chat-body'>
        <span className='room-chat-name'>{message.artist?.name ?? message.senderName}</span>
        {message.artist && (
          <span className='room-chat-artist' title={`Verified artist of ${message.artist.title} on room entry`}>
            <BadgeCheck size={13} aria-hidden='true' />
            Artist
          </span>
        )}
        {message.senderId === hostId && <span className='room-chat-role'>Host</span>}
        {message.senderId === selfId && <span className='room-chat-you'>You</span>}
        {message.replyTo && (
          <blockquote className='room-chat-quote'>
            <strong>{message.replyTo.senderName}</strong> {message.replyTo.text}
          </blockquote>
        )}
        <span className='room-chat-text'>{message.text}</span>
        <button
          ref={actionRef}
          type='button'
          className='room-chat-action-trigger'
          aria-label={`Message actions for ${message.senderName}`}
          aria-expanded={actionsOpen}
          aria-controls={actionsId}
          title='Message actions'
          onClick={() => setActionsOpen(open => !open)}
        >
          <MoreHorizontal size={16} aria-hidden='true' />
        </button>
        <div id={actionsId} className='room-chat-message-actions' hidden={!actionsOpen} role='group' aria-label='Message actions'>
          <button type='button' onClick={reply} aria-label={`Reply to ${message.senderName}`}>
            <Reply size={14} aria-hidden='true' /> Reply
          </button>
          {canPin && (
            <button
              type='button'
              onClick={() => {
                setActionsOpen(false);
                actionRef.current?.focus();
                onPin(message.id);
              }}
              aria-label={`Pin message from ${message.senderName}`}
            >
              <Pin size={14} aria-hidden='true' /> Pin for 10 min
            </button>
          )}
        </div>
      </div>
      <time className='room-chat-time' dateTime={new Date(message.ts).toISOString()}>
        {formatClockTime(message.ts)}
      </time>
    </div>
  );
}
