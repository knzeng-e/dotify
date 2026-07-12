import { ArrowRight, CircleCheckBig, Headphones, KeyRound, Library, Radio, ShieldCheck, Users, Wallet } from 'lucide-react';
import type { CSSProperties } from 'react';

import { CoverImage } from '../components/CoverImage';
import { DotBirth } from '../components/DotBirth';
import { AvatarStack, roomPresenceNames } from '../components/Presence';
import { roomPresenceCount } from '../features/rooms/roomState';
import { catalogAccessAriaLabel, catalogAccessLabel } from '../shared/utils/format';
import type { CatalogTrack, OpenRoom } from '../shared/types';

type ListenViewProps = {
  catalogTracks: CatalogTrack[];
  catalogStatus: string;
  openRooms: OpenRoom[];
  selectedTrackId: string;
  catalogAccessByTrackId: Record<string, boolean>;
  onOpenTrack: (track: CatalogTrack) => void;
  onOpenArtist: (artistName: string) => void;
  onJoinRoom: (roomId: string) => void;
  onStartRoom: () => void;
};

export function ListenView({
  catalogTracks,
  catalogStatus,
  openRooms,
  selectedTrackId,
  catalogAccessByTrackId,
  onOpenTrack,
  onOpenArtist,
  onJoinRoom,
  onStartRoom
}: ListenViewProps) {
  const featured = catalogTracks[0];
  const totalListening = openRooms.reduce((total, room) => total + roomPresenceCount(room.listenerCount, true), 0);
  const leadRoom = openRooms.find(room => room.track) ?? null;
  const heroTrack = leadRoom?.track ?? featured ?? null;
  const presenceMarks = Math.min(totalListening, 7);

  return (
    <section className='listen-home' aria-labelledby='now-title'>
      <header className='now-intro'>
        <div>
          <p className='eyebrow'>Shared listening, happening now</p>
          <h1 id='now-title'>Music is better when someone brings you in.</h1>
        </div>
        <p>Enter a live room, or begin with a work and open the same moment to someone else. A room guest can listen before a wallet is ever useful.</p>
      </header>

      <div className='now-hero-grid'>
        {heroTrack ? (
          <article className='moment-feature' data-live={Boolean(leadRoom)}>
            <div className='moment-art'>
              <CoverImage src={heroTrack.imageRef} alt='' />
              <span className='moment-status'>
                <span className='live-dot' />
                {leadRoom ? 'Room open' : 'Ready to listen'}
              </span>
            </div>
            <div className='moment-copy'>
              <span className='moment-kicker'>{leadRoom ? `${leadRoom.hostName} welcomes you` : 'Begin with a work'}</span>
              <h2>{heroTrack.title}</h2>
              <p>{heroTrack.artist}</p>

              <div
                className='shared-score'
                aria-label={leadRoom ? `${roomPresenceCount(leadRoom.listenerCount, true)} people in this room` : 'Solo listening ready'}
              >
                <span className='shared-score-line' aria-hidden='true'>
                  {Array.from({ length: leadRoom ? Math.min(roomPresenceCount(leadRoom.listenerCount, true), 7) : 1 }, (_, index) => (
                    <i key={index} style={{ '--mark-index': index } as CSSProperties} />
                  ))}
                </span>
                <span>{leadRoom ? `${roomPresenceCount(leadRoom.listenerCount, true)} listening on one timeline` : 'Your listening can become a room'}</span>
              </div>

              <button
                className='primary-action moment-primary'
                type='button'
                onClick={() => {
                  if (leadRoom) {
                    onJoinRoom(leadRoom.roomId);
                    return;
                  }
                  if (featured) onOpenTrack(featured);
                }}
              >
                {leadRoom ? <Headphones size={18} /> : <ArrowRight size={18} />}
                {leadRoom ? 'Enter and listen' : 'Open this work'}
              </button>
            </div>
          </article>
        ) : (
          <section className='moment-feature moment-feature-empty' aria-labelledby='quiet-title'>
            <div className='quiet-signal' aria-hidden='true'>
              <span />
              <i />
              <i />
              <i />
            </div>
            <div className='moment-copy'>
              <span className='moment-kicker'>The commons is quiet</span>
              <h2 id='quiet-title'>Open the first listening room.</h2>
              <p>Choose a work when the catalog is available, then share one simple link.</p>
              <button className='primary-action moment-primary' type='button' onClick={onStartRoom}>
                <Radio size={18} />
                Open the first room
              </button>
            </div>
          </section>
        )}

        <aside className='now-side' aria-label='How Dotify rooms work'>
          <div className='now-side-copy'>
            <span className='section-index'>01 / A shared moment</span>
            <h2>One timeline. Real people. No audience machinery.</h2>
            <p>The host carries the music. Everyone else joins the moment through an ephemeral room stream.</p>
          </div>

          <div className='now-presence' aria-label={`${totalListening} people listening across ${openRooms.length} rooms`}>
            <div className='now-presence-score' aria-hidden='true'>
              <span />
              {Array.from({ length: presenceMarks }, (_, index) => (
                <i key={index} style={{ '--presence-index': index } as CSSProperties} />
              ))}
            </div>
            <dl className='now-facts'>
              <div>
                <dt>Open rooms</dt>
                <dd>{openRooms.length}</dd>
              </div>
              <div>
                <dt>Listening now</dt>
                <dd>{totalListening}</dd>
              </div>
            </dl>
          </div>

          <div className='now-actions'>
            <button className='primary-action' type='button' onClick={onStartRoom}>
              <Radio size={17} />
              Open a room
            </button>
            {featured && (
              <button className='secondary-action' type='button' onClick={() => onOpenTrack(featured)}>
                <Headphones size={17} />
                Listen on my own
              </button>
            )}
          </div>
          <p className='now-wallet-note'>Listen first. Confirm an identity only when an action truly needs it.</p>
        </aside>
      </div>

      <section className='live-section' aria-labelledby='live-section-title'>
        <div className='section-heading'>
          <div>
            <span className='section-index'>02 / Presence</span>
            <h2 id='live-section-title'>Open rooms</h2>
          </div>
          <span>{openRooms.length > 0 ? `${totalListening} listening together` : 'Nothing live right now'}</span>
        </div>

        {openRooms.length > 0 ? (
          <div className='home-room-strip'>
            {openRooms.slice(0, 6).map(room => (
              <button className='home-room-card' type='button' key={room.roomId} onClick={() => onJoinRoom(room.roomId)}>
                <span className='home-room-art' aria-hidden='true'>
                  {room.track?.imageRef && <CoverImage src={room.track.imageRef} alt='' />}
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
                  Enter
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
              <span>Choose a work and welcome the first shared moment.</span>
            </div>
            <button className='secondary-action' type='button' onClick={onStartRoom}>
              Open the first room
            </button>
          </div>
        )}
      </section>

      <section className='catalogue-section' aria-labelledby='works-title'>
        <div className='section-heading'>
          <div>
            <span className='section-index'>03 / Works</span>
            <h2 id='works-title'>Start with the music</h2>
          </div>
          <span>{catalogTracks.length} available</span>
        </div>

        <p className='catalogue-intro'>Open works play without ceremony. Protected works explain the artist's terms before asking you to confirm anything.</p>

        <div className='catalogue-grid'>
          {catalogTracks.length > 0 ? (
            catalogTracks.map(track => {
              const hasCatalogAccess = catalogAccessByTrackId[track.id] === true;
              const accessGranted = track.accessMode === 'free' || hasCatalogAccess;

              return (
                <article className='catalogue-card' data-selected={selectedTrackId === track.id} data-testid='track-card' key={track.id}>
                  <span className='catalogue-cover-frame'>
                    <CoverImage className='catalogue-cover' src={track.imageRef} alt='' />
                    <span className='catalogue-card-action' aria-hidden='true'>
                      <Headphones size={18} />
                    </span>
                  </span>
                  <div className='catalogue-card-copy'>
                    <button
                      className='catalogue-card-open'
                      type='button'
                      data-testid='track-card-open'
                      aria-label={`Open ${track.title} by ${track.artist}`}
                      onClick={() => void onOpenTrack(track)}
                    >
                      {track.title}
                    </button>
                    <button className='artist-text-button' type='button' onClick={() => onOpenArtist(track.artist)}>
                      {track.artist}
                    </button>
                    <p className='catalogue-card-description'>{track.description || 'A work ready for listening, rooms, and direct artist support.'}</p>
                  </div>
                  <div
                    className='catalogue-access-line'
                    data-access={accessGranted ? 'granted' : 'locked'}
                    aria-label={catalogAccessAriaLabel(track, hasCatalogAccess)}
                  >
                    <span>
                      {accessGranted ? <CircleCheckBig size={15} /> : track.accessMode === 'classic' ? <Wallet size={15} /> : <KeyRound size={15} />}
                      {catalogAccessLabel(track)}
                    </span>
                    <ArrowRight size={15} aria-hidden='true' />
                  </div>
                </article>
              );
            })
          ) : catalogStatus === 'Loading registry catalog' ? (
            <DotBirth size='panel' label={catalogStatus} />
          ) : (
            <div className='catalogue-empty'>
              <Library size={20} />
              <span>{catalogStatus}</span>
            </div>
          )}
        </div>
      </section>

      <section className='trust-line' aria-label='Dotify principles'>
        <div>
          <Users size={20} />
          <span>
            <strong>Presence before profile</strong>
            Enter a room without a wallet wall.
          </span>
        </div>
        <div>
          <ShieldCheck size={20} />
          <span>
            <strong>Artist terms stay visible</strong>
            Each work names how it opens.
          </span>
        </div>
        <div>
          <KeyRound size={20} />
          <span>
            <strong>Trust stays underneath</strong>
            The infrastructure protects without taking over.
          </span>
        </div>
      </section>
    </section>
  );
}
