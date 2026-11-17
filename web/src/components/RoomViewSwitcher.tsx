import { ListMusic, MessageCircle, Users } from 'lucide-react';

/** Chat/People select in-place panels; Queue opens its own listening sheet. */
export function RoomViewSwitcher({
  active,
  onSelect,
  onOpenQueue,
  unread,
  mentions,
  requests,
  people,
  online
}: {
  active: 'chat' | 'people';
  onSelect: (panel: 'chat' | 'people') => void;
  onOpenQueue: () => void;
  unread: number;
  mentions: number;
  requests: number;
  people: number;
  online: boolean;
}) {
  return (
    <div className='room-panel-switch'>
      <div role='tablist' aria-label='Room views' className='room-view-tabs'>
        {(['chat', 'people'] as const).map(panel => (
          <button
            key={panel}
            type='button'
            role='tab'
            id={`room-tab-${panel}`}
            aria-controls={`room-panel-${panel}`}
            aria-selected={active === panel}
            tabIndex={active === panel ? 0 : -1}
            onClick={() => onSelect(panel)}
            onKeyDown={event => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const tabs = [...event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>('[role="tab"]')].filter(
                tab => tab.getClientRects().length > 0
              );
              const index = tabs.indexOf(event.currentTarget);
              const next =
                event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
              tabs[next]?.click();
              tabs[next]?.focus();
            }}
          >
            {panel === 'chat' ? (
              <>
                <MessageCircle size={21} aria-hidden='true' />
                <span className='sr-only'>Chat</span>
                {unread > 0 && (
                  <span className='room-request-count' aria-label={`${unread} unread messages`}>
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
                {mentions > 0 && (
                  <span className='room-mention-count' aria-label={`${mentions} unread mentions`}>
                    @{mentions}
                  </span>
                )}
              </>
            ) : (
              <>
                <Users size={18} aria-hidden='true' />
                <span className='sr-only'>{online ? 'People · ' : 'People'}</span>
                {online && <span className='room-people-count'>{people}</span>}
              </>
            )}
          </button>
        ))}
      </div>
      <button
        id='room-tab-queue'
        type='button'
        onClick={event => {
          event.currentTarget.focus({ preventScroll: true });
          onOpenQueue();
        }}
        aria-haspopup='dialog'
        title='Up next & suggestions'
      >
        <ListMusic size={21} aria-hidden='true' />
        <span className='sr-only'>Queue</span>
        {requests > 0 && (
          <span className='room-request-count' aria-label={`${requests} requests`}>
            {requests}
          </span>
        )}
      </button>
    </div>
  );
}
