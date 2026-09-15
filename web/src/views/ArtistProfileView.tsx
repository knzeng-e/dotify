import { ArrowRight, Play, Radio } from 'lucide-react';
import { useMemo, type CSSProperties } from 'react';
import { CoverImage } from '../components/CoverImage';
import { TrackArtworkButton } from '../components/TrackArtworkButton';
import { catalogAccessAriaLabel, catalogAccessLabel } from '../shared/utils/format';
import { AvatarStack, roomPresenceNames } from '../components/Presence';
import { roomPresenceCount } from '../features/rooms/roomState';
import type { CatalogTrack, OpenRoom, SocketStatus } from '../shared/types';

type ArtistProfileViewProps = {
  artistName: string;
  catalogTracks: CatalogTrack[];
  openRooms: OpenRoom[];
  catalogAccessByTrackId: Record<string, boolean>;
  nativePaymentSymbol: string;
  onBack: () => void;
  onOpenTrack: (track: CatalogTrack) => void;
  onPlayTrack: (track: CatalogTrack) => void;
  roomGuest: boolean;
  socketStatus: SocketStatus;
  onOpenArtistRoom: (track: CatalogTrack) => void;
  onJoinRoom: (roomId: string) => void;
};

function hashHue(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 360;
  }
  return hash;
}

function profileVars(artistName: string): CSSProperties {
  const hue = hashHue(artistName);
  return {
    '--artist-hue': hue,
    '--artist-aura-a': `hsl(${hue} 86% 64%)`,
    '--artist-aura-b': `hsl(${(hue + 54) % 360} 78% 54%)`
  } as CSSProperties;
}

export function ArtistProfileView({
  artistName,
  catalogTracks,
  openRooms,
  catalogAccessByTrackId,
  nativePaymentSymbol,
  onBack,
  onOpenTrack,
  onPlayTrack,
  roomGuest,
  socketStatus,
  onOpenArtistRoom,
  onJoinRoom
}: ArtistProfileViewProps) {
  const artistTracks = useMemo(() => catalogTracks.filter(track => track.artist === artistName), [artistName, catalogTracks]);
  const liveRooms = useMemo(() => openRooms.filter(room => room.track?.artist === artistName), [artistName, openRooms]);
  const leadTrack = artistTracks[0];
  // Honesty rule: only show stats backed by real data. Track count comes from
  // the on-chain registry; there is no follower system yet, so none is shown.
  const activeListeners = liveRooms.reduce((total, room) => total + roomPresenceCount(room.listenerCount, true), 0);
  const canPlay = (track: CatalogTrack) => !roomGuest && track.active !== false && (track.accessMode === 'free' || catalogAccessByTrackId[track.id] === true);
  const activateTrack = (track: CatalogTrack) => (canPlay(track) ? onPlayTrack(track) : onOpenTrack(track));

  return (
    <section className='artist-profile-view' style={profileVars(artistName)}>
      <button className='secondary-action compact-action artist-profile-back' type='button' onClick={onBack}>
        Back to discovery
      </button>

      <header className='artist-profile-hero'>
        <div className='artist-profile-art' aria-hidden='true'>
          {leadTrack ? <CoverImage src={leadTrack.imageRef} alt='' fallbackLabel={artistName} /> : artistName.slice(0, 2).toUpperCase()}
        </div>
        <div className='artist-profile-copy'>
          <p className='eyebrow'>Artist</p>
          <h1>{artistName}</h1>
          <div className='artist-profile-meta'>
            <span>
              {artistTracks.length} release{artistTracks.length === 1 ? '' : 's'}
            </span>
            {activeListeners > 0 && <span>{activeListeners} listening now</span>}
          </div>
          <div className='artist-profile-actions'>
            <button className='primary-action' type='button' onClick={() => leadTrack && activateTrack(leadTrack)} disabled={!leadTrack}>
              {leadTrack && canPlay(leadTrack) ? <Play size={18} fill='currentColor' /> : <ArrowRight size={18} />}
              {leadTrack && canPlay(leadTrack) ? 'Listen' : 'View release'}
            </button>
            <button className='secondary-action' type='button' onClick={() => leadTrack && onOpenArtistRoom(leadTrack)} disabled={!leadTrack}>
              <Radio size={18} /> Open a room
            </button>
          </div>
        </div>
      </header>

      <div className='artist-music-layout' data-live={liveRooms.length > 0}>
        <section className='artist-profile-section artist-releases' aria-labelledby='artist-releases-title'>
          <h2 id='artist-releases-title'>Releases</h2>
          <div className='artist-release-grid'>
            {artistTracks.length > 0 ? (
              artistTracks.map(track => (
                <article className='artist-release-card' key={track.id}>
                  <TrackArtworkButton track={track} canPlay={canPlay(track)} onActivate={() => activateTrack(track)} />
                  <div className='artist-release-copy'>
                    <button
                      type='button'
                      className='artist-release-title'
                      onClick={() => onOpenTrack(track)}
                      aria-label={`Open ${track.title} by ${track.artist}`}
                    >
                      {track.title}
                    </button>
                    <small aria-label={catalogAccessAriaLabel(track, catalogAccessByTrackId[track.id] === true, nativePaymentSymbol)}>
                      {catalogAccessLabel(track, nativePaymentSymbol)}
                    </small>
                    {track.description && (
                      <details className='release-description'>
                        <summary>About this release</summary>
                        <p>{track.description}</p>
                      </details>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <p className='empty-state'>No releases yet.</p>
            )}
          </div>
        </section>

        {liveRooms.length > 0 && (
          <section className='artist-profile-section artist-live-section' aria-labelledby='artist-live-title'>
            <h2 id='artist-live-title'>Listening now</h2>
            <div className='artist-live-list'>
              {liveRooms.map(room => (
                <button className='artist-live-room' type='button' key={room.roomId} onClick={() => onJoinRoom(room.roomId)} disabled={room.isFull}>
                  <span>
                    <strong>{room.track?.title ?? 'Audio session'}</strong>
                    <small>
                      <span className='live-dot' data-online={socketStatus === 'online'} aria-hidden='true' /> {room.hostName} hosts
                    </small>
                    <span className='home-room-presence'>
                      <AvatarStack names={roomPresenceNames(room.hostName, room.listenerCount, room.roomId)} max={4} size={24} />
                      <small>{roomPresenceCount(room.listenerCount, true)} listening</small>
                    </span>
                  </span>
                  <span className='artist-live-pill'>{room.isFull ? 'Full' : 'Join'}</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </section>
  );
}
