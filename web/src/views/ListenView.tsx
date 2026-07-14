import { ArrowRight, CircleCheckBig, Headphones, KeyRound, Library, Radio, ShieldCheck, Users, Wallet } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { CoverImage } from '../components/CoverImage';
import { DotBirth } from '../components/DotBirth';
import { AvatarStack, roomPresenceNames } from '../components/Presence';
import { roomPresenceCount } from '../features/rooms/roomState';
import { auraStyleForTrack } from '../shared/utils/aura';
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
  const latestTracks = useMemo(() => catalogTracks.slice(0, 5), [catalogTracks]);
  const latestTrackIds = latestTracks.map(track => track.id).join('|');
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const totalListening = openRooms.reduce((total, room) => total + roomPresenceCount(room.listenerCount, true), 0);
  const leadRoom = openRooms.find(room => room.track) ?? null;
  const isShowingLiveRoom = Boolean(leadRoom);
  const featured = latestTracks[featuredIndex] ?? latestTracks[0] ?? null;
  const heroTrack = leadRoom?.track ?? featured ?? null;
  const presenceMarks = Math.min(totalListening, 7);

  useEffect(() => {
    setFeaturedIndex(0);
  }, [latestTrackIds]);

  useEffect(() => {
    if (isShowingLiveRoom || latestTracks.length <= 1) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const intervalId = window.setInterval(() => {
      setFeaturedIndex(currentIndex => (currentIndex + 1) % latestTracks.length);
    }, 4600);

    return () => window.clearInterval(intervalId);
  }, [isShowingLiveRoom, latestTrackIds, latestTracks.length]);

  return (
    <section className='listen-home' aria-labelledby='now-title'>
      <header className='now-intro'>
        <div>
          <p className='eyebrow'>Shared listening, happening now</p>
          <h1 id='now-title'>Let the Music connect the Dots.</h1>
        </div>
        <p>Enter a live room, or start one from a track.</p>
      </header>

      <div className='now-hero-grid'>
        {heroTrack ? (
          <article className='moment-feature' data-live={isShowingLiveRoom} style={auraStyleForTrack(heroTrack) as CSSProperties}>
            <div className='moment-art'>
              {leadRoom ? (
                <CoverImage src={heroTrack.imageRef} alt='' />
              ) : (
                <div className='moment-carousel' aria-label='Latest tracks'>
                  <button className='moment-carousel-main' type='button' onClick={() => featured && onOpenTrack(featured)} aria-label={`Open ${featured?.title ?? 'selected track'}`}>
                    {featured && <CoverImage src={featured.imageRef} alt='' />}
                  </button>
                  {latestTracks.length > 1 && (
                    <div className='moment-carousel-rail' style={{ '--featured-index': featuredIndex } as CSSProperties}>
                      <div className='moment-carousel-strip'>
                        {latestTracks.map((track, index) => (
                          <button
                            className='moment-carousel-card'
                            type='button'
                            data-active={index === featuredIndex}
                            key={track.id}
                            onClick={() => setFeaturedIndex(index)}
                            aria-label={`Feature ${track.title} by ${track.artist}`}
                          >
                            <CoverImage src={track.imageRef} alt='' />
                            <span>{track.title}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <span className='moment-status'>
                <span className='live-dot' />
                {leadRoom ? 'Room open' : 'Latest tracks'}
              </span>
            </div>
            <div className='moment-copy'>
              <span className='moment-kicker'>{leadRoom ? `${leadRoom.hostName} welcomes you` : 'Fresh from the catalog'}</span>
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
                <span>{leadRoom ? `${roomPresenceCount(leadRoom.listenerCount, true)} listening on one timeline` : 'Choose a track, then make it a room'}</span>
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
                {leadRoom ? 'Enter and listen' : 'Open selected track'}
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
              <p>Choose a track, then share the link.</p>
              <button className='primary-action moment-primary' type='button' onClick={onStartRoom}>
                <Radio size={18} />
                Open the first room
              </button>
            </div>
          </section>
        )}

        <aside className='now-side' aria-label='Rooms'>
          <div className='now-side-copy'>
            <span className='section-index'>01 / Rooms</span>
            <h2>Live rooms and tracks.</h2>
            <p>Open a room, or listen solo and invite people later.</p>
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
          <p className='now-wallet-note'>Start listening. Share when ready.</p>
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
              <span>Choose a track and open a room.</span>
            </div>
            <button className='secondary-action' type='button' onClick={onStartRoom}>
              Open the first room
            </button>
          </div>
        )}
      </section>

      <section className='catalogue-section' aria-labelledby='tracks-title'>
        <div className='section-heading'>
          <div>
            <span className='section-index'>03 / Tracks</span>
            <h2 id='tracks-title'>Start with the music</h2>
          </div>
          <span>{catalogTracks.length} available</span>
        </div>

        <p className='catalogue-intro'>Open tracks play immediately. Protected tracks show the artist's terms first.</p>

        <div className='catalogue-grid'>
          {catalogTracks.length > 0 ? (
            catalogTracks.map(track => {
              const hasCatalogAccess = catalogAccessByTrackId[track.id] === true;
              const accessGranted = track.accessMode === 'free' || hasCatalogAccess;

              return (
                <article
                  className='catalogue-card'
                  data-selected={selectedTrackId === track.id}
                  data-testid='track-card'
                  key={track.id}
                  style={auraStyleForTrack(track) as CSSProperties}
                >
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
                    <p className='catalogue-card-description'>{track.description || 'A track ready for listening, rooms, and direct artist support.'}</p>
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
            <strong>Rooms are easy</strong>
            Enter, listen, stay present.
          </span>
        </div>
        <div>
          <ShieldCheck size={20} />
          <span>
            <strong>Terms stay visible</strong>
            Price, access, and split stay clear.
          </span>
        </div>
        <div>
          <KeyRound size={20} />
          <span>
            <strong>Proof stays behind</strong>
            Runtime and IPFS details stay available when needed.
          </span>
        </div>
      </section>
    </section>
  );
}
