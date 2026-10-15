import { useEffect, useId, useState } from 'react';
import { Headphones, Radar, Radio, Search, ShieldCheck, X } from 'lucide-react';
import { nearbyManualAreas, canUseNearbyDeviceLocation } from '../features/rooms/nearbyLocation';
import { requiresExplicitProductRoomEntry } from '../features/productHost/productHost';
import type { useNearby } from '../features/rooms/useNearby';
import { DiscoveryChoice, NEARBY_MAX_RADIUS_KM, NearbyRadius, type DiscoveryMode } from './NearbyVisibility';
import { DiscoveryRoomList } from './DiscoveryRoomList';

type Props = {
  nearby: ReturnType<typeof useNearby>;
  host?: boolean;
  onJoin?: (roomId: string) => void;
  joining?: boolean;
  onOpenRoom?: () => void;
};

export function NearbyControls({ nearby, host = false, onJoin, joining, onOpenRoom }: Props) {
  const id = useId();
  const selection = nearby.session?.selection();
  const [radius, setRadius] = useState(selection?.radius ?? 5);
  const [manual, setManual] = useState(nearbyManualAreas.find(area => selection?.source?.kind === 'manual' && area.cell === selection.source.cell)?.name ?? '');
  useEffect(() => {
    if (selection?.radius !== undefined) setRadius(selection.radius);
  }, [selection?.radius]);
  const { session, state } = nearby;
  if (!session) return null;
  const busy = state.phase === 'locating' || state.phase === 'checking';
  const worldwide = selection?.source?.kind === 'worldwide';
  const active = (state.phase === 'active' || state.phase === 'empty') && !worldwide;
  const worldActive = worldwide && (state.phase === 'active' || state.phase === 'checking');
  const cooldown = (state.retryInSeconds ?? 0) > 0;
  const nextRadius = Math.min(NEARBY_MAX_RADIUS_KM, radius + 5);
  const deviceSupported = canUseNearbyDeviceLocation();
  const snapshotOnly = requiresExplicitProductRoomEntry();
  const selected = nearbyManualAreas.find(area => area.name === manual);
  const activeArea = nearbyManualAreas.find(area => selection?.source?.kind === 'manual' && area.cell === selection.source.cell);
  const source = selection?.source?.kind ?? 'device';
  const changedRange = active && selection?.radius !== radius;
  const start = (kind: 'device' | 'manual', value = radius) => {
    if (kind === 'device') void session.start({ kind }, value);
    else if (selected) void session.start({ kind, cell: selected.cell }, value);
  };
  const restart = (value = radius) => {
    if (selection?.source) void session.start(selection.source, value);
  };
  const hostMode: DiscoveryMode = worldwide && (worldActive || busy) ? 'everyone' : (active || busy) && !worldwide ? 'nearby' : 'link';
  const chooseMode = (mode: DiscoveryMode) => {
    if (mode === 'link') session.stop();
    else if (mode === 'nearby') start('device');
    else void session.start({ kind: 'worldwide' }, radius);
  };
  return (
    <section className={`nearby-panel${host ? ' nearby-panel-host' : ''}`} aria-labelledby={`${id}-title`} data-active={active}>
      <div className='nearby-main'>
        {!host && (
          <div className='nearby-radar' aria-hidden='true' data-searching={busy}>
            <span className='nearby-orbit nearby-orbit-outer' />
            <span className='nearby-orbit nearby-orbit-inner' />
            <span className='nearby-radar-centre'>
              <Headphones size={29} strokeWidth={1.5} />
            </span>
          </div>
        )}
        <div className='nearby-main-copy'>
          <header className='nearby-heading'>
            <Radar className={host ? undefined : 'nearby-mobile-mark'} size={24} aria-hidden='true' />
            <div>
              <h2 id={`${id}-title`}>{host ? 'Who can find this room?' : 'Nearby'}</h2>
              <p id={`${id}-description`}>
                {host
                  ? active
                    ? source === 'manual' && activeArea
                      ? `Visible around ${activeArea.name} centre.`
                      : 'People around you can find this room.'
                    : busy && !worldwide
                      ? 'Making your room visible…'
                      : hostMode === 'everyone'
                        ? 'Anyone on Dotify can find and join this room.'
                        : 'Only people with your link or room code can join.'
                  : 'Find your people. Share a listening moment.'}
              </p>
            </div>
            {!host && (active || busy) && (
              <button type='button' className='nearby-stop' onClick={() => session.pause()} aria-label='Stop' title='Stop searching'>
                <X size={19} aria-hidden='true' />
              </button>
            )}
          </header>
          {host && (
            <DiscoveryChoice value={hostMode} labelledBy={`${id}-title`} disabled={busy} unavailable={{ nearby: !deviceSupported }} onChange={chooseMode} />
          )}
          {(!host || active || (busy && !worldwide)) && (
            <NearbyRadius value={radius} onChange={setRadius} label={host ? 'Visibility range' : 'Search range'} disabled={busy} />
          )}
          {!host && deviceSupported && (
            <button
              type='button'
              className='primary-action nearby-search'
              disabled={busy || cooldown}
              onClick={() => (changedRange ? restart() : start('device'))}
            >
              <Search size={18} aria-hidden='true' />
              {busy
                ? state.phase === 'locating'
                  ? 'Finding your location…'
                  : 'Scanning rooms…'
                : changedRange
                  ? 'Apply range'
                  : active && source === 'device'
                    ? snapshotOnly
                      ? 'Update my location'
                      : 'Search again'
                    : 'Find rooms near me'}
            </button>
          )}
          {!host && cooldown && <p className='nearby-hint'>Ready for another scan in {state.retryInSeconds}s.</p>}
          {host && active && changedRange && (
            <button type='button' className='secondary-action nearby-search' onClick={() => restart()}>
              Apply range
            </button>
          )}
          {host && active && !changedRange && source === 'device' && snapshotOnly && (
            <button type='button' className='text-action nearby-renew' onClick={() => start('device')}>
              Update my location
            </button>
          )}
          {!deviceSupported && (
            <p className='nearby-hint'>
              {host
                ? 'Location is unavailable here. Choose an area or share your room link.'
                : 'Location is unavailable here. You can still join by link or explore a city.'}
            </p>
          )}
          {active && source === 'device' && snapshotOnly && <p className='nearby-hint'>This location lasts up to 90 seconds.</p>}
          {(state.message || !host) && (
            <p role='status' className='nearby-status' data-phase={state.phase}>
              {state.message || 'Search is off. Start when you’re ready.'}
              {active && source === 'manual' && activeArea && <span className='nearby-area-label'> {activeArea.name} centre</span>}
            </p>
          )}
          {!host && state.phase === 'empty' && onOpenRoom && (
            <button className='text-action nearby-open' type='button' onClick={onOpenRoom}>
              <Radio size={16} aria-hidden='true' /> Open a room here
            </button>
          )}
          {!host && state.phase === 'empty' && radius < NEARBY_MAX_RADIUS_KM && (
            <button
              className='text-action nearby-widen'
              disabled={cooldown}
              type='button'
              onClick={() => {
                const next = nextRadius;
                setRadius(next);
                restart(next);
              }}
            >
              Widen search to {nextRadius} km
            </button>
          )}
        </div>
      </div>
      <div className='nearby-secondary'>
        <details className='nearby-privacy'>
          <summary>
            <ShieldCheck size={15} aria-hidden='true' /> Your location & privacy
          </summary>
          <p className='nearby-hint'>
            Only an approximate area is shared with the room service. People may infer your broad area, but never see your exact position. Distances are
            approximate; room links work from anywhere.
          </p>
          <p className='nearby-hint'>
            {snapshotOnly
              ? 'In the Polkadot app, a location expires after 90 seconds. Use Update my location to continue. Your movements are not followed.'
              : 'Nearby stops when you leave the app. Return and start again to continue.'}{' '}
            A lost connection may take up to 90 seconds to remove your room.
          </p>
        </details>
        <details className='nearby-manual'>
          <summary>{host ? 'Choose an area' : 'Explore a city'}</summary>
          <div className='nearby-manual-body'>
            {host && !active && !busy && <NearbyRadius value={radius} onChange={setRadius} label='Visibility range' />}
            <label htmlFor={`${id}-area`}>City centre · starter areas</label>
            <div className='nearby-manual-row'>
              <select className='field' id={`${id}-area`} name='nearby-city' value={manual} onChange={event => setManual(event.target.value)}>
                <option value=''>Choose a city</option>
                {nearbyManualAreas.map(area => (
                  <option key={area.name}>{area.name}</option>
                ))}
              </select>
              <button type='button' className='secondary-action' disabled={!selected || busy || cooldown} onClick={() => start('manual')}>
                {host ? 'Show around this city' : 'Explore this city'}
              </button>
            </div>
            <p className='nearby-hint'>
              {host ? 'Your room will appear around the city centre, not your current location.' : 'Search around the city centre, not your current location.'}
            </p>
          </div>
        </details>
      </div>
      {!host && (
        <DiscoveryRoomList
          session={session}
          results={state.results}
          label='Rooms nearby'
          joining={joining}
          onJoin={room => {
            session.stop();
            onJoin?.(room.roomId);
          }}
        />
      )}
    </section>
  );
}
