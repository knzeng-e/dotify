import { useId, useState } from 'react';
import { ArrowRight, Globe2, List, LocateFixed, Pause, Play, Radar, RefreshCw, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { Dialog } from './Dialog';
import { NearbyRadius } from './NearbyVisibility';
import { DiscoveryRoomList } from './DiscoveryRoomList';
import type { DiscoveredRoom, useRoomDiscovery } from '../features/rooms/useRoomDiscovery';
import '../styles/room-radar.css';

export function roomDistanceLabel(room: Pick<DiscoveredRoom, 'scope' | 'distanceBand'>) {
  return room.scope === 'worldwide' ? 'Worldwide' : room.distanceBand ? `≈ ${room.distanceBand}` : 'Nearby';
}

const positions = [
  [25, 27],
  [73, 30],
  [24, 69],
  [73, 72],
  [49, 16],
  [84, 49],
  [49, 84],
  [14, 48]
];

export function RoomRadar({ discovery, onJoin, joining }: { discovery: ReturnType<typeof useRoomDiscovery>; onJoin: (id: string) => void; joining: boolean }) {
  const id = useId();
  const [settings, setSettings] = useState(false);
  const [draftRadius, setDraftRadius] = useState(discovery.radius);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listOnly, setListOnly] = useState(false);
  const { nearby, worldwide, rooms, paused, radius } = discovery;
  const [layout, setLayout] = useState({ ids: '', slots: new Map<string, number>() });
  const ids = rooms.map(room => room.roomId).join(',');
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
    setLayout({ ids, slots });
  }
  const selected = rooms.find(room => room.roomId === selectedId);
  if (!nearby.session) return null;
  const locating = nearby.state.phase === 'locating';
  const scanning = locating || nearby.state.phase === 'checking' || worldwide.state.phase === 'checking';
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
    onJoin(room.roomId);
  };
  return (
    <section className='room-radar' aria-labelledby={`${id}-title`}>
      <header className='radar-toolbar'>
        <div>
          <span className='discovery-eyebrow'>FIND YOUR PEOPLE</span>
          <h2 id={`${id}-title`}>Room galaxy</h2>
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
      {failed && (
        <button className='text-action radar-retry' type='button' disabled={!!nearby.state.retryInSeconds} onClick={discovery.retry}>
          <RefreshCw size={15} />
          {nearby.state.retryInSeconds ? `Retry in ${nearby.state.retryInSeconds}s` : 'Try location again'}
        </button>
      )}
      <div className='radar-body' data-list-only={listOnly}>
        {!listOnly && (
          <div className='radar-stage'>
            <div
              className='radar-sky'
              role='group'
              aria-label='Room galaxy. Positions are illustrative, not a map.'
              data-scanning={scanning}
              data-testid='room-galaxy'
            >
              <div className='radar-grid' aria-hidden='true' />
              <div className='radar-sweep' aria-hidden='true' />
              <span className='radar-ring radar-ring-one' aria-hidden='true' />
              <span className='radar-ring radar-ring-two' aria-hidden='true' />
              <span className='radar-ring radar-ring-three' aria-hidden='true' />
              <div className='radar-logo' aria-hidden='true'>
                <svg viewBox='0 0 100 100'>
                  <circle cx='50' cy='50' r='45' fill='none' stroke='currentColor' strokeWidth='.5' opacity='.3' />
                  {Array.from({ length: 6 }, (_, i) => (
                    <ellipse key={i} cx='50' cy='19' rx='6' ry='10' transform={`rotate(${i * 60} 50 50)`} />
                  ))}
                  <path
                    d='M45 62V38l17-4v20m-17 3c-10-4-15 10-4 10 4 0 4-5 4-10Zm17-8c-10-4-15 10-4 10 4 0 4-5 4-10Z'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='3'
                    strokeLinejoin='round'
                  />
                </svg>
              </div>
              {rooms
                .filter(room => slots.has(room.roomId))
                .map(room => (
                  <button
                    key={room.roomId}
                    className='radar-room-dot'
                    data-worldwide={room.scope === 'worldwide'}
                    style={{ left: `${positions[slots.get(room.roomId)!][0]}%`, top: `${positions[slots.get(room.roomId)!][1]}%` }}
                    type='button'
                    onClick={() => setSelectedId(room.roomId)}
                    aria-label={`Inspect ${room.title}, ${roomDistanceLabel(room)}, ${room.hostName}`}
                  >
                    <span className='radar-room-core' aria-hidden='true'>
                      {room.scope === 'worldwide' ? <Globe2 size={20} /> : <span className='radar-petal' />}
                    </span>
                    <strong>{room.title}</strong>
                    <small>{roomDistanceLabel(room)}</small>
                  </button>
                ))}
            </div>
            <div className='radar-caption'>
              <span>
                <LocateFixed size={14} /> Nearby
              </span>
              <span>
                <Globe2 size={14} /> Worldwide
              </span>
              <small>Approximate distances · not a map</small>
            </div>
          </div>
        )}
        <div className='radar-invitations'>
          <header>
            <h3>Open invitations</h3>
            <span>{rooms.length}</span>
          </header>
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
            <span className='discovery-eyebrow'>{selected ? roomDistanceLabel(selected) : 'SIGNAL LOST'}</span>
            <button type='button' className='icon-button' aria-label='Close room preview' onClick={() => setSelectedId(null)}>
              <X size={21} />
            </button>
          </header>
          <div className='radar-preview-art' aria-hidden='true'>
            <Radar size={55} strokeWidth={1} />
          </div>
          <h2 id={`${id}-room`}>{selected?.title ?? 'This room is no longer visible'}</h2>
          {selected ? (
            <>
              <p>{selected.artist}</p>
              <p className='nearby-hint'>
                {selected.hostName} hosts · {selected.presence} here
              </p>
              <button className='primary-action discovery-done' type='button' disabled={joining || selected.isFull} onClick={() => join(selected)}>
                {selected.isFull ? 'Room full' : 'Join'}
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
