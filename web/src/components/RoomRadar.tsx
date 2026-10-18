import { useEffect, useId, useState, type CSSProperties } from 'react';
import { ArrowRight, Eye, List, Pause, Play, Radar, RefreshCw, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { Dialog } from './Dialog';
import { ArtistPresenceBadge } from './ArtistPresenceBadge';
import { CoverImage } from './CoverImage';
import { DotifyMark } from './DotifyMark';
import { RoomScopeIcon } from './RoomScopeIcon';
import { ProductNearbyFallback } from './ProductNearbyFallback';
import { auraForTrack, hashHue } from '../shared/utils/aura';
import { discoveryPresenceCount, discoveryPresenceLabel } from '../features/rooms/roomDiscoveryPresentation';
import { NearbyRadius } from './NearbyVisibility';
import { DiscoveryRoomList } from './DiscoveryRoomList';
import type { DiscoveredRoom, useRoomDiscovery } from '../features/rooms/useRoomDiscovery';
import '../styles/room-radar.css';

export function roomDistanceLabel(room: Pick<DiscoveredRoom, 'scope' | 'distanceBand'>) {
  return room.scope === 'worldwide' ? 'Worldwide' : room.distanceBand ? `≈ ${room.distanceBand.replace(/\u2013/g, '-')}` : 'Nearby';
}

const MAX_ORBIT_POINTS = 128;

const positions = [
  [25, 25],
  [75, 25],
  [25, 75],
  [75, 75],
  [50, 12],
  [88, 50],
  [50, 88],
  [12, 50]
];

export function RoomRadar({
  discovery,
  onJoin,
  joining,
  ownRoomId,
  onOpenOwnRoom
}: {
  discovery: ReturnType<typeof useRoomDiscovery>;
  onJoin: (id: string) => void;
  joining: boolean;
  ownRoomId?: string;
  onOpenOwnRoom?: () => void;
}) {
  const id = useId();
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const [draftRadius, setDraftRadius] = useState(discovery.radius);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [dismissedDetailsId, setDismissedDetailsId] = useState<string | null>(null);
  const detailsId = hoveredId ?? focusedId;
  useEffect(() => {
    if (!detailsId || detailsId === dismissedDetailsId) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDismissedDetailsId(detailsId);
    };
    document.addEventListener('keydown', dismiss);
    return () => document.removeEventListener('keydown', dismiss);
  }, [detailsId, dismissedDetailsId]);
  const [listOnly, setListOnly] = useState(false);
  const { nearby, worldwide, rooms, paused, radius } = discovery;
  const [foreground, setForeground] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible');
  useEffect(() => {
    const update = () => setForeground(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  const [layout, setLayout] = useState({ ids: '', slots: new Map<string, number>() });
  const ids = `${ownRoomId ?? ''}:${rooms.map(room => room.roomId).join(',')}`;
  let slots = layout.slots;
  if (ids !== layout.ids) {
    slots = new Map([...slots].filter(([roomId]) => rooms.some(room => room.roomId === roomId)));
    for (const room of rooms)
      if (!slots.has(room.roomId) && slots.size < positions.length) {
        slots.set(
          room.roomId,
          positions.findIndex((_, index) => ![...slots.values()].includes(index))
        );
      }
    if (ownRoomId && rooms.some(room => room.roomId === ownRoomId) && !slots.has(ownRoomId)) {
      // Keep the host's own invitation visible even when the radar is full.
      const replaced = [...slots].find(([, slot]) => slot === positions.length - 1);
      if (replaced) slots.delete(replaced[0]);
      slots.set(ownRoomId, positions.length - 1);
    }
    setLayout({ ids, slots });
  }
  const selected = rooms.find(room => room.roomId === selectedId);
  if (!nearby.session) return null;
  const locating = nearby.state.phase === 'locating';
  const scanning = locating || nearby.state.phase === 'checking' || worldwide.state.phase === 'checking';
  // A live discovery subscription remains active between replies. Do not bind
  // the sweep to a fast HTTP/socket acknowledgement that users may never see.
  const livePhases = ['locating', 'checking', 'active', 'empty'];
  const sweeping = foreground && ((!paused && livePhases.includes(nearby.state.phase)) || livePhases.includes(worldwide.state.phase));
  const failed = discovery.locationDenied || ['denied', 'stale', 'disconnected'].includes(nearby.state.phase);
  const status = paused
    ? 'Nearby paused · worldwide rooms stay open'
    : discovery.rangePending
      ? `Updating search range to ${radius} km…`
      : locating
        ? nearby.state.message
        : nearby.state.phase === 'checking'
          ? `Location found · scanning ${radius} km around you…`
          : failed
            ? nearby.state.message || 'Location access was not granted. Worldwide rooms are still available.'
            : nearby.state.phase === 'active' || nearby.state.phase === 'empty'
              ? `Around you · about ${radius} km · updating live`
              : 'Connecting to the radar…';
  const join = (room: DiscoveredRoom) => {
    setSelectedId(null);
    if (room.roomId === ownRoomId && onOpenOwnRoom) onOpenOwnRoom();
    else onJoin(room.roomId);
  };
  return (
    <section className='room-radar' aria-labelledby={`${id}-title`}>
      <header className='radar-toolbar'>
        <div>
          <span className='discovery-eyebrow'>FIND YOUR PEOPLE</span>
          <h2 id={`${id}-title`}>
            Room galaxy{' '}
            <span className='radar-room-count' aria-hidden='true'>
              {rooms.length}
            </span>
          </h2>
        </div>
        <div className='radar-tools'>
          <button
            className='radar-tool'
            type='button'
            aria-label='Search settings'
            aria-haspopup='dialog'
            onClick={() => {
              setDraftRadius(radius);
              setSettings(true);
            }}
          >
            <SlidersHorizontal size={18} />
            <span>{radius} km</span>
          </button>
          <button
            className='radar-tool'
            type='button'
            aria-label={listOnly ? 'Show galaxy' : 'Show room list'}
            aria-pressed={listOnly}
            onClick={() => setListOnly(!listOnly)}
          >
            {listOnly ? <Radar size={19} /> : <List size={19} />}
          </button>
        </div>
      </header>
      <div className='radar-status' role='status'>
        <span className='radar-status-dot' data-scanning={scanning} />
        <span>{status}</span>
      </div>
      {!!discovery.hiddenRooms?.length && (
        <button className='text-action radar-hidden-control' type='button' onClick={() => setHiddenOpen(true)}>
          <Eye size={16} aria-hidden='true' /> Hidden rooms ({discovery.hiddenRooms.length})
        </button>
      )}
      {failed && (
        <button className='text-action radar-retry' type='button' disabled={!!nearby.state.retryInSeconds} onClick={discovery.retry}>
          <RefreshCw size={15} />
          {nearby.state.retryInSeconds ? `Retry in ${nearby.state.retryInSeconds}s` : 'Try location again'}
        </button>
      )}
      {nearby.state.locationIssue === 'host-unavailable' && <ProductNearbyFallback />}
      <div className='radar-body' data-list-only={listOnly}>
        {!listOnly && (
          <div className='radar-stage'>
            <div
              className='radar-sky'
              role='group'
              aria-label='Room galaxy. Positions are illustrative, not a map.'
              data-scanning={scanning}
              data-live={sweeping}
              data-crowded={slots.size > 4}
              data-testid='room-galaxy'
            >
              <div className='radar-grid' aria-hidden='true' />
              <div className='radar-sweep' aria-hidden='true' />
              <span className='radar-ring radar-ring-one' aria-hidden='true' />
              <span className='radar-ring radar-ring-two' aria-hidden='true' />
              <span className='radar-ring radar-ring-three' aria-hidden='true' />
              <div className='radar-logo' aria-hidden='true'>
                <DotifyMark />
              </div>
              {rooms
                .filter(room => slots.has(room.roomId))
                .map(room => {
                  const presence = discoveryPresenceCount(room);
                  // Grow with real connected presence (host included), up to
                  // the normal 25-person room. Keep unknown legacy counts neutral.
                  const intensity = Math.min(Math.max((presence ?? 1) - 1, 0) / 24, 1);
                  const own = room.roomId === ownRoomId;
                  const aura = auraForTrack(room);
                  const [x, y] = positions[slots.get(room.roomId)!];
                  const showDetails = detailsId === room.roomId && dismissedDetailsId !== room.roomId;
                  const tooltipId = `${id}-details-${room.roomId}`;
                  // One point per person at normal room capacity (24 listeners).
                  // Bound decorative DOM if an operator raises that capacity; the
                  // exact count remains available in the details and room list.
                  const points = Math.min(presence ?? 0, MAX_ORBIT_POINTS);
                  return (
                    <button
                      key={room.roomId}
                      className='radar-room-dot'
                      data-worldwide={room.scope === 'worldwide'}
                      data-own={own}
                      data-artist-present={room.artistPresent}
                      data-reconnecting={room.connection === 'reconnecting'}
                      data-details-open={showDetails}
                      data-details-side={x < 30 ? 'left' : x > 70 ? 'right' : 'center'}
                      data-details-above={y > 50}
                      style={
                        {
                          left: `${x}%`,
                          top: `${y}%`,
                          '--dot-a': aura.a,
                          '--dot-b': aura.b,
                          '--dot-accent': aura.accent,
                          '--room-presence-scale': 1 + intensity * 0.6,
                          '--room-glow-opacity': 0.35 + intensity * 0.65,
                          '--room-glow-radius': `${4 + intensity * 16}px`,
                          '--room-orbit-clearance': points
                            ? `calc(var(--room-orbit-radius) + ${Math.floor((points - 1) / 12)} * var(--room-orbit-spacing))`
                            : '0px',
                          '--orbit-duration': `${16 + (hashHue(room.roomId) % 9)}s`
                        } as CSSProperties
                      }
                      type='button'
                      onPointerEnter={event => {
                        if (event.pointerType === 'touch') return;
                        setHoveredId(room.roomId);
                        setDismissedDetailsId(null);
                      }}
                      onPointerLeave={() => setHoveredId(null)}
                      onFocus={event => {
                        if (!event.currentTarget.matches(':focus-visible')) return;
                        setFocusedId(room.roomId);
                        setDismissedDetailsId(null);
                      }}
                      onBlur={() => setFocusedId(null)}
                      onClick={() => {
                        setHoveredId(null);
                        setFocusedId(null);
                        setSelectedId(room.roomId);
                      }}
                      aria-label={`Inspect ${own ? 'your room: ' : ''}${room.roomName || room.title}, ${room.artist}${room.artistPresent ? ', artist here' : ''}`}
                      aria-describedby={tooltipId}
                      aria-haspopup='dialog'
                    >
                      <span className='radar-room-sphere' aria-hidden='true'>
                        <span className='radar-room-halo' />
                        <span className='radar-room-core'>
                          <CoverImage src={room.imageRef ?? undefined} alt='' fallbackLabel={room.title} sizes='96px' />
                        </span>
                        <span className='radar-room-orbit'>
                          {Array.from({ length: points }, (_, index) => {
                            const ring = Math.floor(index / 12);
                            const count = Math.min(12, points - ring * 12);
                            return (
                              <i
                                key={index}
                                style={{
                                  transform: `rotate(${((index % 12) * 360) / count}deg) translateX(calc(var(--room-core-size) / 2 + var(--room-orbit-radius) + ${ring} * var(--room-orbit-spacing)))`
                                }}
                              />
                            );
                          })}
                        </span>
                        {own && <span className='radar-own-badge'>Your room</span>}
                        {room.artistPresent && <ArtistPresenceBadge compact />}
                      </span>
                      <strong>{room.roomName || room.title}</strong>
                      <span className='radar-room-artist'>{room.roomName ? `${room.title} · ${room.artist}` : room.artist}</span>
                      {room.connection === 'reconnecting' && <span className='room-reconnecting'>Reconnecting</span>}
                      <span className='radar-room-details' hidden={!showDetails}>
                        <strong aria-hidden='true'>{room.roomName || room.title}</strong>
                        <span className='radar-details-artist' aria-hidden='true'>
                          Now playing: {room.title} · {room.artist}
                        </span>
                        <span className='radar-room-metadata' id={tooltipId} role='tooltip'>
                          <span className='radar-room-host'>
                            <RoomScopeIcon worldwide={room.scope === 'worldwide'} />
                            Host: {room.hostName}
                          </span>
                          {room.introduction && <span className='radar-room-introduction'>{room.introduction}</span>}
                          {room.artistPresent && <ArtistPresenceBadge />}
                          <span className='radar-details-presence'>{discoveryPresenceLabel(room)}</span>
                          <span className='radar-room-distance'>{roomDistanceLabel(room)}</span>
                        </span>
                      </span>
                    </button>
                  );
                })}
            </div>
            <div className='radar-caption'>
              <span>
                <RoomScopeIcon worldwide={false} /> Nearby
              </span>
              <span>
                <RoomScopeIcon worldwide /> Worldwide
              </span>
              {rooms.some(room => room.artistPresent) && <ArtistPresenceBadge />}
              <small>Approximate distances · not a map</small>
            </div>
          </div>
        )}
        <div className='radar-invitations'>
          {!rooms.length && (
            <div className='radar-empty'>
              <Radar size={28} strokeWidth={1.3} />
              <p>{scanning ? 'Listening for a signal…' : 'A little quiet here.'}</p>
              <span>
                {scanning ? 'Rooms appear here as soon as they are found.' : 'Keep the radar open, widen your range, or invite someone into your own room.'}
              </span>
            </div>
          )}
          <DiscoveryRoomList
            session={room => (room as DiscoveredRoom).owner}
            results={rooms}
            label='Discovered rooms'
            joining={joining}
            onJoin={room => join(room as DiscoveredRoom)}
            onInspect={room => setSelectedId(room.roomId)}
            onHide={discovery.hide}
            ownRoomId={ownRoomId}
            onOpenOwnRoom={onOpenOwnRoom}
          />
          {worldwide.state.phase === 'stale' && (
            <p role='status' className='nearby-hint'>
              Worldwide rooms could not refresh.{' '}
              <button
                className='text-action'
                disabled={!!worldwide.state.retryInSeconds}
                onClick={() => void worldwide.session?.start({ kind: 'worldwide' }, 5)}
              >
                Try again
              </button>
            </p>
          )}
        </div>
      </div>
      {hiddenOpen && (
        <Dialog className='discovery-sheet' labelledBy={`${id}-hidden`} onClose={() => setHiddenOpen(false)} historyDismiss>
          <header className='discovery-sheet-heading'>
            <h2 id={`${id}-hidden`}>Hidden rooms</h2>
            <button className='icon-button' aria-label='Close hidden rooms' onClick={() => setHiddenOpen(false)}>
              <X size={21} />
            </button>
          </header>
          <p className='nearby-hint'>Hidden only for you during this visit. Restoring a room shows it again if it is still available in your search.</p>
          {!discovery.hiddenRooms?.length && <p>No hidden rooms.</p>}
          <ul className='radar-hidden-list'>
            {discovery.hiddenRooms?.map(room => (
              <li key={room.roomId}>
                <span>{room.title}</span>
                <button className='secondary-action' onClick={() => discovery.restore(room.roomId)}>
                  Show again
                </button>
              </li>
            ))}
          </ul>
        </Dialog>
      )}
      {settings && (
        <Dialog className='discovery-sheet' labelledBy={`${id}-settings`} onClose={() => setSettings(false)} historyDismiss>
          <header className='discovery-sheet-heading'>
            <div>
              <span className='discovery-eyebrow'>YOUR RADAR</span>
              <h2 id={`${id}-settings`}>A little closer. Or further.</h2>
            </div>
            <button type='button' className='icon-button' aria-label='Close search settings' onClick={() => setSettings(false)}>
              <X size={21} />
            </button>
          </header>
          <NearbyRadius value={draftRadius} onChange={setDraftRadius} label='Search range' />
          <p className='nearby-hint'>Worldwide rooms are always included. Your search never makes your own room public.</p>
          <button type='button' className='discovery-pause' onClick={() => discovery.setPaused(!paused)}>
            {paused ? <Play size={18} /> : <Pause size={18} />}
            {paused ? 'Resume nearby search' : 'Pause nearby search'}
          </button>
          <details className='discovery-privacy'>
            <summary>
              <ShieldCheck size={16} /> Your location
            </summary>
            <p>
              Only an approximate area reaches the room service. Location updates stop when you leave Dotify. Distances are estimates between broad areas, not
              directions to a person.
            </p>
          </details>
          <button
            className='primary-action discovery-done'
            type='button'
            onClick={() => {
              if (draftRadius !== radius) discovery.applyRadius(draftRadius);
              setSettings(false);
            }}
          >
            Done
          </button>
        </Dialog>
      )}
      {selectedId && (
        <Dialog className='discovery-sheet radar-room-preview' labelledBy={`${id}-room`} onClose={() => setSelectedId(null)} historyDismiss>
          <header className='discovery-sheet-heading'>
            <span className='discovery-eyebrow radar-preview-scope'>
              {selected && <RoomScopeIcon worldwide={selected.scope === 'worldwide'} size={17} />}
              {selected ? roomDistanceLabel(selected) : 'SIGNAL LOST'}
            </span>
            <button type='button' className='icon-button' aria-label='Close room preview' onClick={() => setSelectedId(null)}>
              <X size={21} />
            </button>
          </header>
          <div className='radar-preview-art' aria-hidden='true'>
            {selected ? (
              <CoverImage src={selected.imageRef ?? undefined} alt='' fallbackLabel={selected.title} sizes='120px' />
            ) : (
              <Radar size={55} strokeWidth={1} />
            )}
          </div>
          <h2 id={`${id}-room`}>{selected?.roomName || selected?.title || 'This room is no longer visible'}</h2>
          {selected ? (
            <>
              <p className='radar-preview-host'>{selected.roomId === ownRoomId ? `Hosted by you · ${selected.hostName}` : `Hosted by ${selected.hostName}`}</p>
              {selected.introduction && <p className='radar-preview-introduction'>{selected.introduction}</p>}
              <div className='radar-preview-playing'>
                <small>NOW PLAYING</small>
                <strong>{selected.title}</strong>
                <span>Artist: {selected.artist}</span>
              </div>
              <div className='radar-preview-presence'>
                <span>{discoveryPresenceLabel(selected)}</span>
                {selected.artistPresent && <ArtistPresenceBadge />}
              </div>
              {selected.connection === 'reconnecting' && <p className='room-reconnecting'>The host is reconnecting. You can join when they return.</p>}
              <button
                className='primary-action discovery-done'
                type='button'
                disabled={joining || selected.connection === 'reconnecting' || (selected.isFull && selected.roomId !== ownRoomId)}
                onClick={() => join(selected)}
              >
                {selected.roomId === ownRoomId ? 'Back to your room' : selected.isFull ? 'Room full' : 'Join'}
                <ArrowRight size={18} />
              </button>
            </>
          ) : (
            <p>Its host may have left or changed visibility. Other invitations are still on the radar.</p>
          )}
        </Dialog>
      )}
    </section>
  );
}
