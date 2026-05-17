import { Disc3, Headphones, Radio, RefreshCw } from 'lucide-react';
import { PanelTitle } from '../components/ui/PanelTitle';
import type { OpenRoom, SessionAction } from '../types';
import type { FormEvent } from 'react';

type RoomsViewProps = {
  openRooms: OpenRoom[];
  joinCode: string;
  sessionAction: SessionAction;
  isRefreshingRooms: boolean;
  onSetJoinCode: (code: string) => void;
  onJoinRoom: (roomId: string) => void;
  onJoinSession: (event: FormEvent<HTMLFormElement>) => void;
  onRefreshRooms: () => void;
};

export function RoomsView({ openRooms, joinCode, sessionAction, isRefreshingRooms, onSetJoinCode, onJoinRoom, onJoinSession, onRefreshRooms }: RoomsViewProps) {
  return (
    <section className='content-grid rooms-grid'>
      <div className='doc-panel wide-panel'>
        <PanelTitle icon={Radio} title='Live rooms' meta={`${openRooms.length} open`} />
        <div className='room-list'>
          {openRooms.length > 0 ? (
            openRooms.map(room => (
              <div className='room-row' key={room.roomId}>
                <div>
                  <strong>{room.track?.title ?? 'Audio session'}</strong>
                  <span>
                    {room.hostName} / {room.listenerCount} listener{room.listenerCount > 1 ? 's' : ''}
                  </span>
                </div>
                <code>{room.roomId}</code>
                <button type='button' onClick={() => onJoinRoom(room.roomId)} disabled={sessionAction !== 'idle'}>
                  {sessionAction === 'joining' ? <Disc3 size={16} className='spin' /> : <Headphones size={16} />}
                  {sessionAction === 'joining' ? 'Joining…' : 'Join'}
                </button>
              </div>
            ))
          ) : (
            <div className='empty-state'>No open rooms</div>
          )}
        </div>
      </div>

      <div className='doc-panel'>
        <PanelTitle icon={Headphones} title='Room code' meta='manual' />
        <form className='session-form' onSubmit={onJoinSession}>
          <input
            className='field code-field'
            value={joinCode}
            onChange={event => onSetJoinCode(event.target.value.toUpperCase())}
            placeholder='ABC123'
            maxLength={12}
          />
          <button className='primary-action' type='submit' disabled={sessionAction !== 'idle'}>
            {sessionAction === 'joining' ? <Disc3 size={16} className='spin' /> : <Headphones size={16} />}
            {sessionAction === 'joining' ? 'Joining…' : 'Join'}
          </button>
        </form>
        <button className='secondary-action' type='button' onClick={onRefreshRooms} disabled={isRefreshingRooms}>
          {isRefreshingRooms ? <Disc3 size={16} className='spin' /> : <RefreshCw size={16} />}
          {isRefreshingRooms ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
    </section>
  );
}
