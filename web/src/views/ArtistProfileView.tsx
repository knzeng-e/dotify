import { BadgeCheck, Headphones, Radio, UsersRound } from 'lucide-react';
import { useMemo, type CSSProperties, type KeyboardEvent } from 'react';
import { catalogAccessAriaLabel, catalogAccessLabel } from '../utils/format';
import { AvatarStack, roomPresenceNames } from '../components/Presence';
import type { CatalogTrack, OpenRoom } from '../types';

type ArtistProfileViewProps = {
  artistName: string;
  catalogTracks: CatalogTrack[];
  openRooms: OpenRoom[];
  catalogAccessByTrackId: Record<string, boolean>;
  onBack: () => void;
  onOpenTrack: (track: CatalogTrack) => void;
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

function artistBio(artistName: string, tracks: CatalogTrack[]) {
  const describedTrack = tracks.find(track => track.description.trim());
  if (!describedTrack) {
    return `${artistName} publishes on Dotify with an artist-owned runtime, protected access, and music that can move through shared listening rooms.`;
  }
  return `${describedTrack.description} On Dotify, this catalog lives in an artist-owned space where access and value flows stay attached to the work.`;
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
  onBack,
  onOpenTrack,
  onOpenArtistRoom,
  onJoinRoom
}: ArtistProfileViewProps) {
  const artistTracks = useMemo(() => catalogTracks.filter(track => track.artist === artistName), [artistName, catalogTracks]);
  const liveRooms = useMemo(() => openRooms.filter(room => room.track?.artist === artistName), [artistName, openRooms]);
  const leadTrack = artistTracks[0];
  // Honesty rule: only show stats backed by real data. Track count comes from
  // the on-chain registry; there is no follower system yet, so none is shown.
  const activeListeners = liveRooms.reduce((total, room) => total + room.listenerCount + 1, 0);
  const verified = artistTracks.some(track => track.source === 'artist' || track.artistAddress);

  function handleTrackKeyDown(event: KeyboardEvent<HTMLElement>, track: CatalogTrack) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpenTrack(track);
    }
  }

  return (
    <section className='artist-profile-view' style={profileVars(artistName)}>
      <button className='secondary-action compact-action artist-profile-back' type='button' onClick={onBack}>
        Back to discovery
      </button>

      <div className='artist-profile-hero'>
        <div className='artist-profile-avatar' aria-hidden='true'>
          {artistName.slice(0, 2).toUpperCase()}
        </div>
        <div className='artist-profile-copy'>
          <p className='eyebrow'>Artist-owned space</p>
          <h1>
            {artistName}
            {verified && <BadgeCheck size={23} aria-label='Verified artist' />}
          </h1>
          <div className='artist-profile-meta'>
            <span>@{artistName.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') || 'artist'}</span>
            <span>{artistTracks.length} registered track{artistTracks.length === 1 ? '' : 's'}</span>
            <span>{activeListeners > 0 ? `${activeListeners} listening now` : 'ready for the next room'}</span>
          </div>
          <p>{artistBio(artistName, artistTracks)}</p>
          <div className='artist-profile-actions'>
            <button className='primary-action compact-action' type='button' onClick={() => leadTrack && onOpenTrack(leadTrack)} disabled={!leadTrack}>
              <Headphones size={16} />
              Listen
            </button>
            <button className='secondary-action compact-action' type='button' onClick={() => leadTrack && onOpenArtistRoom(leadTrack)} disabled={!leadTrack}>
              <Radio size={16} />
              Open a room
            </button>
          </div>
        </div>
      </div>

      <div className='artist-profile-grid'>
        <section className='doc-panel artist-profile-section'>
          <div className='panel-title'>
            <span>
              <Radio size={16} />
              Live with {artistName.split(' ')[0]}
            </span>
            <small>{liveRooms.length} rooms</small>
          </div>
          <div className='artist-live-list'>
            {liveRooms.length > 0 ? (
              liveRooms.map(room => (
                <button className='artist-live-room' type='button' key={room.roomId} onClick={() => onJoinRoom(room.roomId)}>
                  <span>
                    <strong>{room.track?.title ?? 'Audio session'}</strong>
                    <small>{room.hostName} hosts</small>
                    <span className='home-room-presence'>
                      <AvatarStack names={roomPresenceNames(room.hostName, room.listenerCount, room.roomId)} max={4} size={24} />
                      <small>{room.listenerCount + 1} listening</small>
                    </span>
                  </span>
                  <span className='artist-live-pill'>Join</span>
                </button>
              ))
            ) : (
              <div className='empty-state'>No public room is playing this artist right now.</div>
            )}
          </div>
        </section>

        <section className='doc-panel artist-profile-section artist-profile-trust'>
          <div className='panel-title'>
            <span>
              <UsersRound size={16} />
              Trust marks
            </span>
            <small>quiet web3</small>
          </div>
          <div className='principle-list'>
            <div>
              <strong>Artist-owned runtime</strong>
              <span>The catalog keeps its access rules and rights context attached.</span>
            </div>
            <div>
              <strong>Rooms first</strong>
              <span>Discovery happens through people listening in the same moment.</span>
            </div>
            <div>
              <strong>Payments are explicit</strong>
              <span>Classic unlocks show price and access before the listener pays.</span>
            </div>
          </div>
        </section>
      </div>

      <section className='doc-panel artist-profile-section'>
        <div className='panel-title'>
          <span>
            <Headphones size={16} />
            Releases
          </span>
          <small>{artistTracks.length} tracks</small>
        </div>
        <div className='artist-release-grid'>
          {artistTracks.length > 0 ? (
            artistTracks.map(track => {
              const hasCatalogAccess = catalogAccessByTrackId[track.id] === true;
              return (
                <article
                  className='artist-release-card'
                  key={track.id}
                  role='button'
                  tabIndex={0}
                  onClick={() => onOpenTrack(track)}
                  onKeyDown={event => handleTrackKeyDown(event, track)}
                  aria-label={`Open ${track.title} by ${track.artist}`}
                >
                  <img src={track.imageRef} alt='' crossOrigin='anonymous' />
                  <div>
                    <strong>{track.title}</strong>
                    <span>{track.description || 'Artist-owned release on Dotify.'}</span>
                    <small aria-label={catalogAccessAriaLabel(track, hasCatalogAccess)}>{catalogAccessLabel(track)}</small>
                  </div>
                </article>
              );
            })
          ) : (
            <div className='empty-state'>This artist has no release in the loaded catalog yet.</div>
          )}
        </div>
      </section>
    </section>
  );
}
