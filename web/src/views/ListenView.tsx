import { ArrowRight, Radio } from 'lucide-react';
import type { MutableRefObject } from 'react';

import { CoverImage } from '../components/CoverImage';
import { CatalogBrowser, type CatalogJourney } from '../components/CatalogBrowser';
import { AvatarStack, roomPresenceNames } from '../components/Presence';
import { roomPresenceCount } from '../features/rooms/roomState';
import type { CatalogTrack, OpenRoom } from '../shared/types';

type ListenViewProps = {
  catalogTracks: CatalogTrack[];
  catalogStatus: string;
  openRooms: OpenRoom[];
  journey: MutableRefObject<CatalogJourney>;
  selectedTrackId: string;
  catalogAccessByTrackId: Record<string, boolean>;
  nativePaymentSymbol: string;
  onOpenTrack: (track: CatalogTrack) => void;
  onOpenArtist: (artistName: string) => void;
  onJoinRoom: (roomId: string) => void;
  onStartRoom: (track?: CatalogTrack) => void;
};

export function ListenView({
  catalogTracks,
  catalogStatus,
  openRooms,
  journey,
  selectedTrackId,
  catalogAccessByTrackId,
  nativePaymentSymbol,
  onOpenTrack,
  onOpenArtist,
  onJoinRoom,
  onStartRoom
}: ListenViewProps) {
  const totalListening = openRooms.reduce((total, room) => total + roomPresenceCount(room.listenerCount, true), 0);

  return (
    <section className='listen-home listen-home-focused' aria-labelledby='now-title'>
      <header className='now-intro'>
        <div>
          <p className='eyebrow'>A place to listen together</p>
          <h1 id='now-title'>Music brings us together.</h1>
        </div>
        <p>Enter a live room, or start one from a track.</p>
      </header>

      <section className='catalogue-section' aria-labelledby='tracks-title'>
        <div className='section-heading'>
          <div>
            <h2 id='tracks-title'>Start with the music</h2>
          </div>
          <span>{catalogTracks.length} available</span>
        </div>

        <p className='catalogue-intro'>Open tracks play immediately. Protected tracks show the artist's terms first.</p>

        <CatalogBrowser
          journey={journey}
          catalogTracks={catalogTracks}
          catalogStatus={catalogStatus}
          selectedTrackId={selectedTrackId}
          catalogAccessByTrackId={catalogAccessByTrackId}
          nativePaymentSymbol={nativePaymentSymbol}
          onOpenTrack={onOpenTrack}
          onOpenArtist={onOpenArtist}
        />
      </section>

      <section className='live-section' aria-labelledby='live-section-title'>
        <div className='section-heading presence-section-heading'>
          <div>
            <h2 id='live-section-title'>Open rooms</h2>
          </div>
          <div className='presence-command' aria-label={`${openRooms.length} open rooms, ${totalListening} people listening`}>
            {openRooms.length > 0 && (
              <dl className='presence-facts'>
                <div>
                  <dt>Rooms</dt>
                  <dd>{openRooms.length}</dd>
                </div>
                <div>
                  <dt>In rooms now</dt>
                  <dd>{totalListening}</dd>
                </div>
              </dl>
            )}
            <button className='primary-action' type='button' onClick={() => onStartRoom()}>
              <Radio size={17} />
              Open a room
            </button>
          </div>
        </div>

        {openRooms.length > 0 ? (
          <div className='home-room-strip'>
            {openRooms.slice(0, 6).map(room => (
              <button
                className='home-room-card'
                type='button'
                key={room.roomId}
                onClick={() => {
                  if (!room.isFull) onJoinRoom(room.roomId);
                }}
                disabled={room.isFull}
                aria-label={room.isFull ? `${room.hostName}'s room is full` : `Enter ${room.hostName}'s room`}
              >
                <span className='home-room-art' aria-hidden='true'>
                  {room.track?.imageRef && <CoverImage src={room.track.imageRef} alt='' fallbackLabel={room.track.title} />}
                </span>
                <span className='home-room-copy'>
                  <span className='home-room-host'>{room.hostName} hosts</span>
                  <strong>{room.track?.title ?? 'Audio session'}</strong>
                  <span>{room.track?.artist ?? 'Live on Dotify'}</span>
                  <span className='home-room-presence'>
                    <AvatarStack names={roomPresenceNames(room.hostName, room.listenerCount, room.roomId)} max={4} size={25} />
                    <small>{roomPresenceCount(room.listenerCount, true)} here</small>
                  </span>
                </span>
                <span className='home-room-join'>
                  {room.isFull ? 'Full' : 'Enter'}
                  <ArrowRight size={15} />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className='live-empty'>
            <span className='live-empty-mark' aria-hidden='true' />
            <div>
              <strong>No room is open yet.</strong>
              <span>Choose a track above, or open a room from the catalog.</span>
            </div>
          </div>
        )}
      </section>
    </section>
  );
}
