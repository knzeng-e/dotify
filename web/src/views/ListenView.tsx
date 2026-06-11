import { BadgeCheck, CircleCheckBig, Headphones, KeyRound, Library, Play, Radio, Share2, ShieldCheck, Users, Wallet } from 'lucide-react';
import { PanelTitle } from '../components/ui/PanelTitle';
import { AvatarStack, roomPresenceNames } from '../components/Presence';
import { catalogAccessAriaLabel, catalogAccessLabel } from '../utils/format';
import type { CatalogTrack, OpenRoom } from '../types';
import type { KeyboardEvent } from 'react';

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
  function handleCardKeyDown(event: KeyboardEvent<HTMLElement>, track: CatalogTrack) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpenTrack(track);
    }
  }

  const featured = catalogTracks[0];
  const totalListening = openRooms.reduce((total, room) => total + room.listenerCount + 1, 0);
  const artistCount = new Set(catalogTracks.map(track => track.artist)).size;
  const leadRoom = openRooms[0];

  return (
    <section className='listen-home'>
      <div className='listen-hero'>
        <div className='home-listening-hero'>
          <div className='home-listening-copy'>
            <p className='eyebrow'><span className='live-dot' />{totalListening} listening together now</p>
            <h2>Make the track a place.</h2>
            <p>
              Shared presence on the surface. Artist-held access, protected audio, and policy beneath it.
            </p>
            <div className='home-hero-trust-row' aria-label='Dotify trust model'>
              <span><KeyRound size={14} /> Artists keep keys</span>
              <span><ShieldCheck size={14} /> Access fails closed</span>
              <span><Users size={14} /> Guests just listen</span>
            </div>
          </div>
          <div className='home-listening-actions'>
            <button className='primary-action compact-action' type='button' onClick={onStartRoom}>
              <Radio size={16} />
              Start a room
            </button>
            {featured && (
              <button className='secondary-action compact-action' type='button' onClick={() => onOpenTrack(featured)}>
                <Headphones size={16} />
                Listen solo
              </button>
            )}
            <span>Guest-ready room links.</span>
            <div className='home-hero-stats' aria-label='Live Dotify state'>
              <strong className='tnum'>{openRooms.length}<small>rooms</small></strong>
              <strong className='tnum'>{totalListening}<small>listeners</small></strong>
              <strong className='tnum'>{artistCount}<small>artists</small></strong>
            </div>
          </div>
        </div>

        {featured && (
          <article
            className='home-featured'
            role='button'
            tabIndex={0}
            aria-label={`Open ${featured.title} by ${featured.artist}`}
            onClick={() => onOpenTrack(featured)}
            onKeyDown={event => handleCardKeyDown(event, featured)}
          >
            <img className='home-featured-cover' src={featured.imageRef} alt='' crossOrigin='anonymous' />
            <span className='home-featured-veil' aria-hidden='true' />
            <button
              className='home-featured-play'
              type='button'
              onClick={event => {
                event.stopPropagation();
                onOpenTrack(featured);
              }}
              aria-label={`Play ${featured.title}`}
            >
              <Play size={20} fill='currentColor' />
            </button>
            <span className='home-featured-body'>
              <span className='eyebrow'>Featured today</span>
              <strong>{featured.title}</strong>
              <button
                className='home-featured-artist'
                type='button'
                onClick={event => {
                  event.stopPropagation();
                  onOpenArtist(featured.artist);
                }}
              >
                {featured.artist}
              </button>
              <span className='home-featured-chips'>
                <span className='home-featured-access'>{catalogAccessLabel(featured)}</span>
                <span className='home-featured-access'>Preview first</span>
              </span>
            </span>
          </article>
        )}
      </div>

      <section className='commons-path' aria-label='Shared listening state'>
        <div className='commons-step'>
          <span>1</span>
          <div>
            <strong>Sound</strong>
            <small>Preview-ready</small>
          </div>
        </div>
        <div className='commons-step'>
          <span>2</span>
          <div>
            <strong>Room</strong>
            <small>Host access</small>
          </div>
        </div>
        <div className='commons-step'>
          <span>3</span>
          <div>
            <strong>Link</strong>
            <small>Guest stream</small>
          </div>
        </div>
        {leadRoom ? (
          <button className='commons-live-join' type='button' onClick={() => onJoinRoom(leadRoom.roomId)}>
            <Headphones size={16} />
            Join {leadRoom.hostName}
          </button>
        ) : (
          <button className='commons-live-join' type='button' onClick={onStartRoom}>
            <Share2 size={16} />
            Create room
          </button>
        )}
      </section>

      <section className='doc-panel happening-panel'>
        <PanelTitle icon={Radio} title='Happening now' meta={`${openRooms.length} live`} />
        <div className='home-room-strip'>
          {openRooms.length > 0 ? (
            openRooms.slice(0, 4).map(room => (
              <button className='home-room-card' type='button' key={room.roomId} onClick={() => onJoinRoom(room.roomId)}>
                <span className='home-room-art' aria-hidden='true'>
                  {room.track?.imageRef && <img src={room.track.imageRef} alt='' crossOrigin='anonymous' />}
                </span>
                <span>
                  <strong>{room.track?.title ?? 'Audio session'}</strong>
                  <small>{room.hostName} hosts</small>
                  <span className='home-room-presence'>
                    <AvatarStack names={roomPresenceNames(room.hostName, room.listenerCount, room.roomId)} max={4} size={24} />
                    <small>{room.listenerCount + 1} listening</small>
                  </span>
                </span>
                <span className='home-room-join'>
                  <Headphones size={14} />
                  Join
                </span>
              </button>
            ))
          ) : (
            <div className='empty-state'>No open rooms yet.</div>
          )}
        </div>
      </section>

      <section className='content-grid catalog-home-grid'>
      <div className='doc-panel catalogue-panel catalogue-home-panel'>
        <PanelTitle icon={Library} title='Browse catalog' meta={`${catalogTracks.length} tracks`} />
        <p className='catalogue-intro'>Previewable releases with explicit access terms and artist-owned metadata.</p>
        <div className='catalogue-grid'>
          {catalogTracks.length > 0 ? (
            catalogTracks.map(track => {
              const hasCatalogAccess = catalogAccessByTrackId[track.id] === true;

              return (
                <article
                  className='catalogue-card'
                  data-selected={selectedTrackId === track.id}
                  key={track.id}
                  role='button'
                  tabIndex={0}
                  aria-label={`Open ${track.title} by ${track.artist}`}
                  onClick={() => {
                    void onOpenTrack(track);
                  }}
                  onKeyDown={event => handleCardKeyDown(event, track)}
                >
                  <span className='catalogue-cover-frame'>
                    <img className='catalogue-cover' src={track.imageRef} alt='' crossOrigin='anonymous' />
                  </span>
                  <span className='catalogue-card-copy'>
                    <strong>{track.title}</strong>
                    <button
                      className='artist-text-button'
                      type='button'
                      onClick={event => {
                        event.stopPropagation();
                        onOpenArtist(track.artist);
                      }}
                    >
                      {track.artist}
                    </button>
                    <span className='catalogue-card-description'>{track.description || 'Artist-owned release on Dotify.'}</span>
                  </span>
                  <span
                    className='catalogue-access-line'
                    data-access={hasCatalogAccess ? 'granted' : 'locked'}
                    aria-label={catalogAccessAriaLabel(track, hasCatalogAccess)}
                  >
                    {hasCatalogAccess ? <CircleCheckBig size={15} /> : <Wallet size={15} />}
                    <span>{catalogAccessLabel(track)}</span>
                  </span>
                </article>
              );
            })
          ) : (
            <div className='empty-state'>{catalogStatus}</div>
          )}
        </div>
      </div>

      <div className='doc-panel home-principles-panel'>
        <PanelTitle icon={BadgeCheck} title='Access culture' meta='proof, not profiles' />
        <div className='principle-list'>
          <div>
            <strong>Preview first</strong>
            <span>Every listener can discover before deciding how to unlock.</span>
          </div>
          <div>
            <strong>Pay artists directly</strong>
            <span>Classic access shows the DOT price before payment.</span>
          </div>
          <div>
            <strong>Human free</strong>
            <span>Personhood can unlock culture without turning people into ad profiles.</span>
          </div>
        </div>
      </div>
    </section>
    </section>
  );
}
