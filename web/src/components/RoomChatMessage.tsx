import { BadgeCheck, HeartHandshake, Pin, Reply } from 'lucide-react';
import type { RoomChatMessage as Message } from '../shared/types';
import { formatClockTime } from '../shared/utils/format';
import { Avatar } from './Presence';

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
  if (message.senderId === 'dotify-confirmed-tip')
    return (
      <div className='room-chat-activity' data-contribution='true'>
        <HeartHandshake size={15} aria-hidden='true' />
        <span>{message.text}</span>
      </div>
    );
  return (
    <div
      className='room-chat-row'
      data-message-id={message.id}
      data-self={message.senderId === selfId || undefined}
      data-artist={Boolean(message.artist) || undefined}
    >
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
        <div className='room-chat-message-actions'>
          <button type='button' className='text-action' onClick={() => onReply(message)} aria-label={`Reply to ${message.senderName}`}>
            <Reply size={14} />
          </button>
          {canPin && (
            <button type='button' className='text-action' onClick={() => onPin(message.id)} aria-label={`Pin message from ${message.senderName}`}>
              <Pin size={14} />
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
