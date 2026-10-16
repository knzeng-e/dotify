import { ArrowRight, Link, Radio, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Dialog } from '../components/Dialog';
import { roomExperienceFlags } from '../features/rooms/roomExperienceFlags';
import { RoomRadar } from '../components/RoomRadar';
import type { useRoomDiscovery } from '../features/rooms/useRoomDiscovery';
import type { SessionAction } from '../shared/types';

type RoomsViewProps = {
  discovery: ReturnType<typeof useRoomDiscovery>;
  joinCode: string;
  sessionAction: SessionAction;
  onSetJoinCode: (code: string) => void;
  onJoinRoom: (roomId: string) => void;
  onJoinSession: (event: FormEvent<HTMLFormElement>) => void;
  onStartRoom: () => void;
};

export function RoomsView({ discovery, joinCode, sessionAction, onSetJoinCode, onJoinRoom, onJoinSession, onStartRoom }: RoomsViewProps) {
  const [joinLinkOpen, setJoinLinkOpen] = useState(false);
  const isJoining = sessionAction === 'joining';
  return (
    <section className='rooms-landing rooms-landing-focused' aria-labelledby='rooms-title'>
      <header className='rooms-intro'>
        <div>
          <h1 id='rooms-title'>Listening rooms.</h1>
          <p className='rooms-intro-copy'>Somewhere close. Somewhere across the world. Listen together.</p>
        </div>
      </header>
      <section className='room-arrival room-arrival-compact' aria-label='Join or host a room'>
        <button className='secondary-action' type='button' onClick={() => setJoinLinkOpen(true)} disabled={sessionAction !== 'idle'}>
          <Link size={18} aria-hidden='true' /> Join by link
        </button>
        <button className='secondary-action' type='button' onClick={onStartRoom} disabled={sessionAction !== 'idle'}>
          <Radio size={18} aria-hidden='true' /> Open a room
        </button>
      </section>
      {joinLinkOpen && (
        <Dialog className='discovery-sheet' labelledBy='join-link-title' historyDismiss onClose={() => setJoinLinkOpen(false)}>
          <header className='discovery-sheet-heading'>
            <h2 id='join-link-title'>An invitation for you.</h2>
            <button className='icon-button' type='button' aria-label='Close room link' onClick={() => setJoinLinkOpen(false)}>
              <X size={21} />
            </button>
          </header>
          <form
            className='session-form'
            onSubmit={event => {
              setJoinLinkOpen(false);
              onJoinSession(event);
            }}
          >
            <label htmlFor='room-code-input'>Room code or link</label>
            <input
              id='room-code-input'
              name='room-code'
              className='field code-field'
              value={joinCode}
              onChange={event => onSetJoinCode(event.target.value)}
              placeholder='ABC123 or a room link'
              maxLength={140}
              autoComplete='off'
              spellCheck={false}
            />
            <button className='primary-action discovery-done' type='submit' disabled={sessionAction !== 'idle'}>
              <ArrowRight size={17} aria-hidden='true' /> {isJoining ? 'Joining…' : 'Join'}
            </button>
          </form>
        </Dialog>
      )}
      {roomExperienceFlags.nearby && <RoomRadar discovery={discovery} onJoin={onJoinRoom} joining={isJoining} />}
    </section>
  );
}
