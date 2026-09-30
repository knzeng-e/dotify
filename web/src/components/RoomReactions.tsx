import { Smile, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSessionContext } from '../app/providers';
import { appendVisibleReactions, type VisibleReaction } from '../features/rooms/reactionPresentation';
import { ROOM_REACTIONS } from '../shared/social';

const REACTION_LABELS = ['heart', 'fire', 'leaf', 'sparkle', 'raise', 'tear'];

export function RoomReactions({ selfId }: { selfId: string | undefined }) {
  const { reactionFeed, sendRoomReaction, socketStatus } = useSessionContext();
  const [visible, setVisible] = useState<VisibleReaction[]>([]);
  const [open, setOpen] = useState(false);
  const [animate, setAnimate] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  // Returning to the player must not replay the session's retained reaction feed.
  const seenRef = useRef(new Set(reactionFeed.map(reaction => reaction.id)));
  const connected = socketStatus === 'online';

  useEffect(() => {
    const fresh = reactionFeed.filter(reaction => !seenRef.current.has(reaction.id));
    for (const reaction of fresh) seenRef.current.add(reaction.id);
    if (seenRef.current.size > 200) seenRef.current = new Set(reactionFeed.map(reaction => reaction.id));
    if (fresh.length) setVisible(current => appendVisibleReactions(current, fresh, Date.now()));
  }, [reactionFeed]);

  useEffect(() => {
    if (!visible.length) return;
    const nextExpiry = Math.min(...visible.map(reaction => reaction.expiresAt));
    const timer = window.setTimeout(
      () => setVisible(current => current.filter(reaction => reaction.expiresAt > Date.now())),
      Math.max(0, nextExpiry - Date.now())
    );
    return () => window.clearTimeout(timer);
  }, [visible]);

  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector<HTMLButtonElement>('.room-reaction-picker button')?.focus();
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  const latest = visible[visible.length - 1];
  const latestName = latest?.senderId === selfId ? 'You' : latest?.senderName;

  return (
    <div
      className='room-reaction-dock'
      ref={rootRef}
      data-animate={animate}
      onKeyDown={event => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation();
          setOpen(false);
          toggleRef.current?.focus();
        }
      }}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <div className='room-reaction-activity' role='status' aria-atomic='true'>
        {latest ? (
          <>
            <span aria-hidden='true'>{latest.emoji}</span>
            <span>
              <strong>{latestName}</strong>
              <span className='sr-only'> reacted {REACTION_LABELS[ROOM_REACTIONS.indexOf(latest.emoji as (typeof ROOM_REACTIONS)[number])]}</span>
            </span>
          </>
        ) : (
          <span className='room-reaction-quiet'>{connected ? 'Feel this track?' : 'Reconnecting'}</span>
        )}
      </div>
      <div className='room-reaction-trail' aria-hidden='true'>
        {visible.map((reaction, index) => (
          <span key={reaction.id} style={{ right: `${16 + (index % 3) * 38}px` }}>
            {reaction.emoji}
          </span>
        ))}
      </div>
      <div className='room-reaction-shortcuts' role='group' aria-label='Send a reaction to the room'>
        {ROOM_REACTIONS.slice(0, 2).map((emoji, index) => (
          <button
            type='button'
            className='room-react-btn'
            key={emoji}
            disabled={!connected}
            aria-label={`React ${REACTION_LABELS[index]}`}
            title={`React ${REACTION_LABELS[index]}`}
            onClick={() => sendRoomReaction(emoji)}
          >
            {emoji}
          </button>
        ))}
        <button
          type='button'
          className='room-react-btn'
          ref={toggleRef}
          aria-expanded={open}
          aria-controls='room-reaction-picker'
          aria-label={open ? 'Close reactions' : 'More reactions'}
          title={open ? 'Close reactions' : 'More reactions'}
          onClick={() => setOpen(current => !current)}
        >
          {open ? <X size={20} /> : <Smile size={20} />}
        </button>
      </div>
      {open && (
        <div className='room-reaction-picker' id='room-reaction-picker' role='group' aria-label='All reactions'>
          <div className='room-reaction-options'>
            {ROOM_REACTIONS.map((emoji, index) => (
              <button
                type='button'
                className='room-react-btn'
                key={emoji}
                disabled={!connected}
                aria-label={`React ${REACTION_LABELS[index]}`}
                title={`React ${REACTION_LABELS[index]}`}
                onClick={() => {
                  sendRoomReaction(emoji);
                  setOpen(false);
                  toggleRef.current?.focus();
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
          <label className='room-reaction-motion'>
            <input type='checkbox' checked={animate} onChange={event => setAnimate(event.target.checked)} /> Animate reactions
          </label>
        </div>
      )}
    </div>
  );
}
