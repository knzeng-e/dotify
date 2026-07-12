import { BadgeCheck, CircleCheckBig, Disc3, Headphones, KeyRound, Library, Radio, Share2, ShieldCheck, Users, Wallet } from 'lucide-react';
import { PanelTitle } from '../shared/ui/PanelTitle';
import { CoverImage } from '../components/CoverImage';
import { StageRail } from '../components/StageRail';
import { DotBirth } from '../components/DotBirth';
import { AvatarStack, roomPresenceNames } from '../components/Presence';
import { catalogAccessAriaLabel, catalogAccessLabel } from '../shared/utils/format';
import { roomPresenceCount } from '../features/rooms/roomState';
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
  const artistCount = new Set(catalogTracks.map(track => track.artist)).size;
  const leadRoom = openRooms[0];
  const heroRoom = leadRoom?.track ? leadRoom : null;
  const heroTrack = heroRoom?.track ?? featured;

  return (
    <section className='listen-home'>
      <div className='listen-hero'>
        {heroTrack && (
          <button
            className='home-live-feature'
            type='button'
            onClick={() => {
              if (heroRoom) {
                onJoinRoom(heroRoom.roomId);
                return;
              }
              if (featured) onOpenTrack(featured);
            }}
            aria-label={heroRoom ? `Enter and listen in ${heroRoom.hostName}'s room` : `Enter the work ${heroTrack.title} by ${heroTrack.artist}`}
          >
            <span className='home-live-art' aria-hidden='true'>
              <CoverImage src={heroTrack.imageRef} alt='' />
            </span>
            <span className='home-live-shade' aria-hidden='true' />
            <span className='home-live-copy'>
              <span className='home-live-kicker'>
                <span className='live-dot' />
                {heroRoom ? 'An open room' : 'A work ready to open'}
              </span>
              <strong>{heroTrack.title}</strong>
              <span>{heroRoom ? `${heroRoom.hostName} hosts` : heroTrack.artist}</span>
              <span className='home-live-presence'>
                {heroRoom ? (
                  <>
                    <AvatarStack names={roomPresenceNames(heroRoom.hostName, heroRoom.listenerCount, heroRoom.roomId)} max={4} size={28} />
                    <small>{roomPresenceCount(heroRoom.listenerCount, true)} listening</small>
                  </>
                ) : featured ? (
                  <small>{catalogAccessLabel(featured)}</small>
                ) : (
                  <small>Free to discover</small>
                )}
              </span>
            </span>
            <span className='home-live-cta'>
              {heroRoom ? <Headphones size={17} /> : <Disc3 size={17} />}
              {heroRoom ? 'Enter and listen' : 'Enter the work'}
            </span>
          </button>
        )}

        <div className='home-listening-hero'>
          <div className='home-listening-copy'>
            <p className='eyebrow'>
              <span className='live-dot' />
              {totalListening} listening together now
            </p>
            <h2>Every work can open a space.</h2>
            <p>Listen on your own, then welcome people into the same musical moment with one link.</p>
            <div className='home-hero-trust-row' aria-label='Dotify trust model'>
              <span>
                <KeyRound size={14} /> The artist defines each door
              </span>
              <span>
                <ShieldCheck size={14} /> Rights stay understandable
              </span>
              <span>
                <Users size={14} /> Guests enter without a wallet
              </span>
            </div>
          </div>
          <div className='home-listening-actions'>
            <button className='primary-action compact-action' type='button' onClick={onStartRoom}>
              <Radio size={16} />
              Open a room
            </button>
            {featured && (
              <button className='secondary-action compact-action' type='button' onClick={() => onOpenTrack(featured)}>
                <Headphones size={16} />
                Listen on my own
              </button>
            )}
            <span>The link is the threshold. The music stays central.</span>
            <div className='home-hero-stats' aria-label='Live Dotify state'>
              <strong className='tnum'>
                {openRooms.length}
                <small>rooms</small>
              </strong>
              <strong className='tnum'>
                {totalListening}
                <small>listeners</small>
              </strong>
              <strong className='tnum'>
                {artistCount}
                <small>artists</small>
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Constellation phase A: the catalog on stage (aura lamp + unlocked glare).
          The dense catalogue grid below remains the library view and keeps the
          e2e-load-bearing track-card selectors. */}
      <StageRail tracks={catalogTracks} accessByTrackId={catalogAccessByTrackId} selectedTrackId={selectedTrackId} onOpenTrack={onOpenTrack} />

      <section className='commons-path' aria-label='Shared listening state'>
        <div className='commons-step'>
          <span>1</span>
          <div>
            <strong>Sound</strong>
            <small>Free to discover</small>
          </div>
        </div>
        <div className='commons-step'>
          <span>2</span>
          <div>
            <strong>Room</strong>
            <small>Host-led</small>
          </div>
        </div>
        <div className='commons-step'>
          <span>3</span>
          <div>
            <strong>Link</strong>
            <small>Join together</small>
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
        <PanelTitle icon={Radio} title='Open now' meta={`${openRooms.length} live`} />
        <div className='home-room-strip'>
          {openRooms.length > 0 ? (
            openRooms.slice(0, 4).map(room => (
              <button className='home-room-card' type='button' key={room.roomId} onClick={() => onJoinRoom(room.roomId)}>
                <span className='home-room-art' aria-hidden='true'>
                  {room.track?.imageRef && <CoverImage src={room.track.imageRef} alt='' />}
                </span>
                <span>
                  <strong>{room.track?.title ?? 'Audio session'}</strong>
                  <small>{room.hostName} hosts</small>
                  <span className='home-room-presence'>
                    <AvatarStack names={roomPresenceNames(room.hostName, room.listenerCount, room.roomId)} max={4} size={24} />
                    <small>{roomPresenceCount(room.listenerCount, true)} listening</small>
                  </span>
                </span>
                <span className='home-room-join'>
                  <Headphones size={14} />
                  Enter
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
          <PanelTitle icon={Library} title='Works ready to open' meta={`${catalogTracks.length} tracks`} />
          <p className='catalogue-intro'>
            Begin with the work. Open listening stays immediate; protected listening names the real action before asking for a wallet.
          </p>
          <div className='catalogue-grid'>
            {catalogTracks.length > 0 ? (
              catalogTracks.map(track => {
                const hasCatalogAccess = catalogAccessByTrackId[track.id] === true;

                return (
                  // Plain container: the primary "open track" action is a real
                  // button whose ::after stretches over the whole card, so the
                  // artist button can sit beside it without nesting interactives.
                  <div className='catalogue-card' data-selected={selectedTrackId === track.id} data-testid='track-card' key={track.id}>
                    <span className='catalogue-cover-frame'>
                      <CoverImage className='catalogue-cover' src={track.imageRef} alt='' />
                    </span>
                    <span className='catalogue-card-copy'>
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
                      <span className='catalogue-card-description'>{track.description || 'A release you can play, share, and support on Dotify.'}</span>
                    </span>
                    <span
                      className='catalogue-access-line'
                      data-access={hasCatalogAccess ? 'granted' : 'locked'}
                      aria-label={catalogAccessAriaLabel(track, hasCatalogAccess)}
                    >
                      {hasCatalogAccess ? <CircleCheckBig size={15} /> : <Wallet size={15} />}
                      <span>{catalogAccessLabel(track)}</span>
                    </span>
                  </div>
                );
              })
            ) : /* Dot birth only while the registry load is genuinely in flight;
                 terminal states (empty registry, failures) stay plain text. */
            catalogStatus === 'Loading registry catalog' ? (
              <DotBirth size='panel' label={catalogStatus} />
            ) : (
              <div className='empty-state'>{catalogStatus}</div>
            )}
          </div>
        </div>

        <div className='doc-panel home-principles-panel'>
          <PanelTitle icon={BadgeCheck} title='Listening doors' meta='simple entry' />
          <div className='principle-list'>
            <div>
              <strong>Free to discover</strong>
              <span>Free works and live rooms let you hear the music before any confirmation.</span>
            </div>
            <div>
              <strong>Support artists directly</strong>
              <span>When a release has a price, its terms are shown before you support and open it.</span>
            </div>
            <div>
              <strong>No profile wall</strong>
              <span>Some doors can open without turning listeners into ad profiles.</span>
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}
