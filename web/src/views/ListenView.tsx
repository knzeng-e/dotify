import { ArrowRight, Radio } from 'lucide-react';
import type { MutableRefObject } from 'react';

import { CoverImage } from '../components/CoverImage';
import { CatalogBrowser, type CatalogJourney } from '../components/CatalogBrowser';
import { RecentListening } from '../components/RecentListening';
import { hasReleaseChronology, recentListeningTracks } from '../features/catalog/discoveryShelves';
import { AvatarStack, roomPresenceNames } from '../components/Presence';
import { roomHostDisplayName, roomPresenceCount } from '../features/rooms/roomState';
import type { CatalogTrack, OpenRoom } from '../shared/types';

type ListenViewProps = {
  catalogTracks: CatalogTrack[];
  recentTrackIds: string[];
  onClearRecent: () => void;
  catalogStatus: string;
  openRooms: OpenRoom[];
  journey: MutableRefObject<CatalogJourney>;
  selectedTrackId: string;
  catalogAccessByTrackId: Record<string, boolean>;
  nativePaymentSymbol: string;
  onOpenTrack: (track: CatalogTrack) => void;
  onPlayTrack: (track: CatalogTrack) => void;
  onTrackIntent: (track: CatalogTrack) => void;
  roomGuest: boolean;
  onOpenArtist: (artistName: string) => void;
  onJoinRoom: (roomId: string) => void;
  onStartRoom: (track?: CatalogTrack) => void;
};

export function ListenView({
  catalogTracks,
  recentTrackIds,
  onClearRecent,
  catalogStatus,
  openRooms,
  journey,
  selectedTrackId,
  catalogAccessByTrackId,
  nativePaymentSymbol,
  onOpenTrack,
  onPlayTrack,
  onTrackIntent,
  roomGuest,
  onOpenArtist,
  onJoinRoom,
  onStartRoom
}: ListenViewProps) {
  const totalListening = openRooms.reduce((total, room) => total + roomPresenceCount(room.listenerCount, true), 0);

  const liveSection = (
    <section className='live-section' aria-labelledby='live-section-title'>
      <div className='section-heading presence-section-heading'>
        <div>
          <h2 id='live-section-title'>{openRooms.length ? 'Live now' : 'Rooms'}</h2>
        </div>
        {openRooms.length > 0 && (
          <span className='presence-summary'>
            {totalListening} listening in {openRooms.length} {openRooms.length === 1 ? 'room' : 'rooms'}
          </span>
        )}
      </div>

      {openRooms.length > 0 ? (
        <div className='home-room-strip'>
          {openRooms.slice(0, 6).map(room => {
            const hostDisplayName = roomHostDisplayName(room.hostName);
            return (
              <button
                className='home-room-card'
                type='button'
                key={room.roomId}
                onClick={() => {
                  if (!room.isFull) onJoinRoom(room.roomId);
                }}
                disabled={room.isFull}
                aria-label={
                  room.isFull
                    ? hostDisplayName
                      ? `${hostDisplayName}'s room is full`
                      : 'This listening room is full'
                    : hostDisplayName
                      ? `Join ${hostDisplayName}'s room`
                      : 'Join this listening room'
                }
              >
                <span className='home-room-art' aria-hidden='true'>
                  {room.track?.imageRef && <CoverImage src={room.track.imageRef} alt='' fallbackLabel={room.track.title} />}
                </span>
                <span className='home-room-copy'>
                  <span className='home-room-host'>{hostDisplayName ? `${hostDisplayName} hosts` : 'Live listening room'}</span>
                  <strong>{room.track?.title ?? 'Audio session'}</strong>
                  <span>{room.track?.artist ?? 'Live on Dotify'}</span>
                  <span className='home-room-presence'>
                    <AvatarStack names={roomPresenceNames(room.hostName, room.listenerCount, room.roomId)} max={4} size={25} />
                    <small>{roomPresenceCount(room.listenerCount, true)} here</small>
                  </span>
                </span>
                <span className='home-room-join'>
                  {room.isFull ? 'Full' : 'Join'}
                  <ArrowRight size={15} />
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className='live-empty'>
          <span className='live-empty-mark' aria-hidden='true' />
          <div>
            <strong>No room is open yet.</strong>
            <span>Be the first: open a room and send the link to someone.</span>
          </div>
        </div>
      )}
    </section>
  );

  return (
    <section className='listen-home listen-home-focused' data-live={openRooms.length > 0} aria-labelledby='now-title'>
      <header className='now-intro'>
        <div>
          <h1 id='now-title'>Listen together.</h1>
          <p className='now-intro-copy'>Open a room, share the link, and your people hear what you hear. Joining never needs an account.</p>
        </div>
        <button className='primary-action' type='button' onClick={() => onStartRoom()}>
          <Radio size={17} />
          Open a room
        </button>
      </header>

      {/* Live rooms lead in the document, not only visually, when people are listening. */}
      {openRooms.length > 0 && liveSection}

      <section className='catalogue-section' aria-labelledby='tracks-title'>
        <div className='section-heading'>
          <div>
            <h2 id='tracks-title'>{hasReleaseChronology(catalogTracks) ? 'New from artists' : 'Start with the music'}</h2>
          </div>
        </div>

        <CatalogBrowser
          journey={journey}
          catalogTracks={catalogTracks}
          catalogStatus={catalogStatus}
          selectedTrackId={selectedTrackId}
          catalogAccessByTrackId={catalogAccessByTrackId}
          nativePaymentSymbol={nativePaymentSymbol}
          onOpenTrack={onOpenTrack}
          onPlayTrack={onPlayTrack}
          onTrackIntent={onTrackIntent}
          roomGuest={roomGuest}
          onOpenArtist={onOpenArtist}
        />
      </section>

      {openRooms.length === 0 && liveSection}
      <RecentListening
        tracks={recentListeningTracks(catalogTracks, recentTrackIds)}
        access={catalogAccessByTrackId}
        roomGuest={roomGuest}
        onPlay={onPlayTrack}
        onOpen={onOpenTrack}
        onClear={onClearRecent}
      />
    </section>
  );
}
