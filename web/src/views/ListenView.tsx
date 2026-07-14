import { ArrowRight, CircleCheckBig, Headphones, KeyRound, Library, Radio, ShieldCheck, Users, Wallet } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { CoverImage } from '../components/CoverImage';
import { DotBirth } from '../components/DotBirth';
import { AvatarStack, roomPresenceNames } from '../components/Presence';
import { roomPresenceCount } from '../features/rooms/roomState';
import { auraStyleForTrack } from '../shared/utils/aura';
import { catalogAccessAriaLabel, catalogAccessLabel } from '../shared/utils/format';
import type { CatalogTrack, OpenRoom, SoloListeningByTrackHash } from '../shared/types';

type ListenViewProps = {
  catalogTracks: CatalogTrack[];
  catalogStatus: string;
  openRooms: OpenRoom[];
  soloListeningByTrackHash: SoloListeningByTrackHash;
  selectedTrackId: string;
  catalogAccessByTrackId: Record<string, boolean>;
  onOpenTrack: (track: CatalogTrack) => void;
  onOpenArtist: (artistName: string) => void;
  onJoinRoom: (roomId: string) => void;
  onStartRoom: (track?: CatalogTrack) => void;
};

function roomPlaysTrack(room: OpenRoom, track: CatalogTrack): boolean {
  if (!room.track) return false;
  if (room.track.hash && track.hash) return room.track.hash.toLowerCase() === track.hash.toLowerCase();
  return room.track.title === track.title && room.track.artist === track.artist;
}

export function ListenView({
  catalogTracks,
  catalogStatus,
  openRooms,
  soloListeningByTrackHash,
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
  const [carouselPaused, setCarouselPaused] = useState(false);
  const totalListening = openRooms.reduce((total, room) => total + roomPresenceCount(room.listenerCount, true), 0);
  const featured = latestTracks[featuredIndex] ?? latestTracks[0] ?? null;
  const featuredRooms = useMemo(() => (featured ? openRooms.filter(room => roomPlaysTrack(room, featured)) : []), [featured, openRooms]);
  const featuredRoomListening = featuredRooms.reduce((total, room) => total + roomPresenceCount(room.listenerCount, true), 0);
  const featuredSoloListening = featured ? (soloListeningByTrackHash[featured.hash.toLowerCase()] ?? 0) : 0;
  const featuredListening = featuredRoomListening + featuredSoloListening;
  const featuredRoom = featuredRooms[0] ?? null;

  useEffect(() => {
    setFeaturedIndex(0);
  }, [latestTrackIds]);

  useEffect(() => {
    if (latestTracks.length <= 1 || carouselPaused) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const intervalId = window.setInterval(() => {
      setFeaturedIndex(currentIndex => (currentIndex + 1) % latestTracks.length);
    }, 4600);

    return () => window.clearInterval(intervalId);
  }, [carouselPaused, latestTrackIds, latestTracks.length]);

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
        {featured ? (
          <article className='moment-feature' style={auraStyleForTrack(featured) as CSSProperties}>
            <div className='moment-art'>
              <div
                className='moment-carousel'
                aria-label='Latest tracks'
                onMouseEnter={() => setCarouselPaused(true)}
                onMouseLeave={() => setCarouselPaused(false)}
                onFocus={() => setCarouselPaused(true)}
                onBlur={event => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setCarouselPaused(false);
                }}
              >
                <button
                  className='moment-carousel-main'
                  type='button'
                  onClick={() => onOpenTrack(featured)}
                  aria-label={`Listen to ${featured.title} by ${featured.artist}`}
                >
                  <CoverImage key={featured.id} src={featured.imageRef} alt='' />
                </button>
                {latestTracks.length > 1 && (
                  <div className='moment-pagination' aria-label='Choose a featured track'>
                    {latestTracks.map((track, index) => (
                      <button
                        className='moment-carousel-dot'
                        type='button'
                        data-active={index === featuredIndex}
                        aria-current={index === featuredIndex ? 'true' : undefined}
                        key={track.id}
                        onClick={() => setFeaturedIndex(index)}
                        aria-label={`Show ${track.title} by ${track.artist}`}
                      >
                        <span aria-hidden='true' />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span className='moment-status'>
                <span className='moment-status-light' aria-hidden='true' />
                Latest tracks
              </span>
            </div>
            <div className='moment-copy'>
              <span className='moment-kicker'>Fresh from the catalog</span>
              <h2>{featured.title}</h2>
              <button className='moment-artist' type='button' onClick={() => onOpenArtist(featured.artist)}>
                {featured.artist}
              </button>

              <div className='track-life-panel' aria-label={`Live activity for ${featured.title}`}>
                <div className='track-life-summary'>
                  <span className='track-life-light' aria-hidden='true' />
                  <div>
                    <span>Track presence</span>
                    <strong>{featuredRooms.length > 0 ? 'Playing live now' : featuredSoloListening > 0 ? 'Heard solo right now' : 'Ready for a room'}</strong>
                  </div>
                  <dl>
                    <div>
                      <dt>Solo now</dt>
                      <dd>{featuredSoloListening}</dd>
                    </div>
                    <div>
                      <dt>Rooms playing this track</dt>
                      <dd>{featuredRooms.length}</dd>
                    </div>
                    <div>
                      <dt>Listening now</dt>
                      <dd>{featuredListening}</dd>
                    </div>
                  </dl>
                </div>

                <div className='track-life-actions'>
                  <button className='track-action track-action-primary' type='button' onClick={() => onOpenTrack(featured)}>
                    <Headphones size={17} />
                    Listen solo
                  </button>
                  <button className='track-action' type='button' onClick={() => onStartRoom(featured)}>
                    <Radio size={17} />
                    Play in a room
                  </button>
                </div>

                {featuredRoom && (
                  <button className='track-live-room' type='button' onClick={() => onJoinRoom(featuredRoom.roomId)}>
                    <span>
                      <AvatarStack names={roomPresenceNames(featuredRoom.hostName, featuredRoom.listenerCount, featuredRoom.roomId)} max={3} size={24} />
                      <span>
                        <strong>Join {featuredRoom.hostName}'s room</strong>
                        <small>{roomPresenceCount(featuredRoom.listenerCount, true)} listening together</small>
                      </span>
                    </span>
                    <ArrowRight size={16} aria-hidden='true' />
                  </button>
                )}
              </div>
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
              <button className='primary-action moment-primary' type='button' onClick={() => onStartRoom()}>
                <Radio size={18} />
                Open the first room
              </button>
            </div>
          </section>
        )}
      </div>

      <section className='live-section' aria-labelledby='live-section-title'>
        <div className='section-heading presence-section-heading'>
          <div>
            <span className='section-index'>01 / Presence</span>
            <h2 id='live-section-title'>Open rooms</h2>
          </div>
          <div className='presence-command' aria-label={`${openRooms.length} open rooms, ${totalListening} people listening`}>
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
            <button className='primary-action' type='button' onClick={() => onStartRoom()}>
              <Radio size={17} />
              Open a room
            </button>
          </div>
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
              <span>Choose a track above, or open a room from the catalog.</span>
            </div>
          </div>
        )}
      </section>

      <section className='catalogue-section' aria-labelledby='tracks-title'>
        <div className='section-heading'>
          <div>
            <span className='section-index'>02 / Tracks</span>
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
