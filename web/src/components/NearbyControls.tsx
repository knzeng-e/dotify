import { useEffect, useId, useState } from 'react';
import { EyeOff, Flag, Headphones, MoreHorizontal, Radar, Radio, Search, ShieldCheck, X } from 'lucide-react';
import { NEARBY_RADII } from '../../shared/nearby-v2.mjs';
import { nearbyManualAreas, canUseNearbyDeviceLocation } from '../features/rooms/nearbyLocation';
import { requiresExplicitProductRoomEntry } from '../features/productHost/productHost';
import type { useNearby } from '../features/rooms/useNearby';
import { NearbyRadius, NearbySwitch } from './NearbyVisibility';

type Props = { nearby: ReturnType<typeof useNearby>; host?: boolean; onJoin?: (roomId: string) => void; joining?: boolean };

export function NearbyControls({ nearby, host = false, onJoin, joining }: Props) {
  const id = useId();
  const selection = nearby.session?.selection();
  const [radius, setRadius] = useState(selection?.radius ?? 5);
  const [manual, setManual] = useState(nearbyManualAreas.find(area => selection?.source?.kind === 'manual' && area.cell === selection.source.cell)?.name ?? '');
  const [reportId, setReportId] = useState<string | null>(null);
  useEffect(() => {
    if (selection?.radius !== undefined) setRadius(selection.radius);
  }, [selection?.radius]);
  const { session, state } = nearby;
  if (!session) return null;
  const busy = state.phase === 'locating' || state.phase === 'checking';
  const active = state.phase === 'active' || state.phase === 'empty';
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
              <h2 id={`${id}-title`}>{host ? 'Visible nearby' : 'Nearby'}</h2>
              <p id={`${id}-description`}>
                {host
                  ? active
                    ? source === 'manual' && activeArea
                      ? `Visible around ${activeArea.name} centre.`
                      : 'People around you can find this room.'
                    : busy
                      ? 'Making your room visible…'
                      : 'Off. Your room is available by link.'
                  : 'Find your people. Share a listening moment.'}
              </p>
            </div>
            {host ? (
              <NearbySwitch
                checked={active || busy}
                disabled={!deviceSupported && !active && !busy}
                describedBy={`${id}-description`}
                onChange={checked => (checked ? start('device') : session.stop())}
              />
            ) : (
              (active || busy) && (
                <button type='button' className='nearby-stop' onClick={() => session.stop()} aria-label='Stop' title='Stop searching'>
                  <X size={19} aria-hidden='true' />
                </button>
              )
            )}
          </header>
          {(!host || active || busy) && <NearbyRadius value={radius} onChange={setRadius} label={host ? 'Visibility range' : 'Search range'} disabled={busy} />}
          {!host && deviceSupported && (
            <button type='button' className='primary-action nearby-search' disabled={busy} onClick={() => (changedRange ? restart() : start('device'))}>
              <Search size={18} aria-hidden='true' />
              {busy
                ? 'Finding rooms…'
                : changedRange
                  ? 'Apply range'
                  : active && source === 'device'
                    ? snapshotOnly
                      ? 'Update my location'
                      : 'Search again'
                    : 'Find rooms near me'}
            </button>
          )}
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
          {!host && state.phase === 'empty' && radius < 25 && (
            <button
              className='text-action nearby-widen'
              type='button'
              onClick={() => {
                const next = NEARBY_RADII[NEARBY_RADII.indexOf(radius) + 1];
                setRadius(next);
                restart(next);
              }}
            >
              Widen search to {NEARBY_RADII[NEARBY_RADII.indexOf(radius) + 1]} km
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
              <button type='button' className='secondary-action' disabled={!selected || busy} onClick={() => start('manual')}>
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
        <ul className='nearby-results' aria-label='Rooms nearby'>
          {state.results.map(room => (
            <li key={room.discoveryId} className='nearby-room'>
              <span className='nearby-room-mark' aria-hidden='true'>
                <Radio size={23} />
              </span>
              <div className='nearby-room-copy'>
                <small>
                  {room.hostName} hosts · {room.presence} here
                </small>
                <h3>{room.title}</h3>
                <p>{room.artist}</p>
              </div>
              <button
                type='button'
                className='primary-action'
                disabled={joining || room.isFull}
                onClick={() => {
                  session.stop();
                  onJoin?.(room.roomId);
                }}
              >
                {room.isFull ? 'Full' : 'Join'}
              </button>
              <details className='nearby-room-actions'>
                <summary aria-label={`Options for ${room.title}`} title='Room options'>
                  <MoreHorizontal size={19} aria-hidden='true' />
                </summary>
                <div className='nearby-room-menu'>
                  <button type='button' className='text-action' onClick={() => session.hide(room.roomId)}>
                    <EyeOff size={15} aria-hidden='true' />
                    Hide
                  </button>
                  <button
                    type='button'
                    className='text-action'
                    aria-expanded={reportId === room.discoveryId}
                    onClick={() => setReportId(reportId === room.discoveryId ? null : room.discoveryId)}
                  >
                    <Flag size={15} aria-hidden='true' />
                    Report
                  </button>
                </div>
              </details>
              {reportId === room.discoveryId && (
                <div className='nearby-report'>
                  <p>Hide this room and send a safety count. Reports do not open a moderation case.</p>
                  {(['unwanted', 'misleading', 'offensive'] as const).map(reason => (
                    <button
                      className='secondary-action'
                      type='button'
                      key={reason}
                      onClick={() => {
                        setReportId(null);
                        void session.report(room, reason);
                      }}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
