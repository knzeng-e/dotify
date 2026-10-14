import { useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, EyeOff, Flag, MapPin, Radio, Search, X } from 'lucide-react';
import { NEARBY_RADII } from '../../shared/nearby-v2.mjs';
import { nearbyManualAreas, canUseNearbyDeviceLocation } from '../features/rooms/nearbyLocation';
import { requiresExplicitProductRoomEntry } from '../features/productHost/productHost';
import type { useNearby } from '../features/rooms/useNearby';

type Props = { nearby: ReturnType<typeof useNearby>; host?: boolean; onJoin?: (roomId: string) => void; joining?: boolean };

export function NearbyControls({ nearby, host = false, onJoin, joining }: Props) {
  const id = useId();
  const selection = nearby.session?.selection();
  const [radius, setRadius] = useState(selection?.radius ?? 5);
  const [manual, setManual] = useState(nearbyManualAreas.find(area => selection?.source?.kind === 'manual' && area.cell === selection.source.cell)?.name ?? '');
  const [source, setSource] = useState<'device' | 'manual'>(selection?.source?.kind ?? 'device');
  const [reportId, setReportId] = useState<string | null>(null);
  const { session, state } = nearby;
  const busy = state.phase === 'locating' || state.phase === 'checking';
  const active = state.phase === 'active' || state.phase === 'empty';
  const statusRef = useRef<HTMLParagraphElement>(null);
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !busy) statusRef.current?.focus({ preventScroll: true });
    wasBusy.current = busy;
  }, [busy]);
  if (!session) return null;
  const deviceSupported = canUseNearbyDeviceLocation();
  const selected = nearbyManualAreas.find(area => area.name === manual);
  const start = (kind: 'device' | 'manual', value = radius) => {
    setSource(kind);
    if (kind === 'device') void session.start({ kind }, value);
    else if (selected) void session.start({ kind, cell: selected.cell }, value);
  };
  return (
    <section className='nearby-panel' aria-labelledby={`${id}-title`}>
      <header className='nearby-heading'>
        <MapPin size={21} aria-hidden='true' />
        <div>
          <h2 id={`${id}-title`}>{host ? 'Visible nearby' : 'Nearby'}</h2>
          <p>{host ? 'Open this listening moment to people around you.' : 'A shared listening moment, close to you.'}</p>
        </div>
        {(active || busy || state.phase === 'stale') && (
          <button type='button' className='text-action' onClick={() => session.stop()}>
            <X size={17} />
            {host ? 'Turn off' : 'Stop'}
          </button>
        )}
      </header>
      <p className='nearby-disclosure'>
        {host
          ? 'Share an approximate area so people nearby can find your room.'
          : 'Find live rooms using an approximate area. Exact coordinates stay on your device.'}
      </p>
      <details className='nearby-settings' open={!active}>
        <summary>
          {host ? 'Visibility area' : 'Search area'} · {source === 'manual' && selected ? `${selected.name} centre` : 'Your location'} · about {radius} km
        </summary>
        <fieldset className='nearby-radius'>
          <legend>{host ? 'Visibility radius' : 'Search radius'} · approximate</legend>
          {NEARBY_RADII.map(value => (
            <label key={value}>
              <input
                type='radio'
                name={`${id}-radius`}
                value={value}
                checked={value === radius}
                onChange={() => {
                  session.stop();
                  setRadius(value);
                }}
              />
              <span>{value} km</span>
            </label>
          ))}
        </fieldset>
        <p className='nearby-hint'>Areas are a few kilometres wide. Results near the edge may vary.</p>
        <div className='nearby-actions'>
          {deviceSupported ? (
            <button type='button' className='primary-action' disabled={busy || (active && source === 'device')} onClick={() => start('device')}>
              {host ? <Radio size={17} /> : <Search size={17} />}
              {host ? 'Enable nearby visibility' : 'Find rooms near me'}
            </button>
          ) : (
            <p>Location is unavailable in this app environment. Use an invite link or QR code, or explore a city separately.</p>
          )}
        </div>
        {deviceSupported && requiresExplicitProductRoomEntry() && (
          <p className='nearby-hint'>
            Your Polkadot app uses your current position for up to 90 seconds. Update your location to refresh it; your movements are not followed.
          </p>
        )}
        <details className='nearby-manual'>
          <summary>Explore a city</summary>
          <label htmlFor={`${id}-area`}>City centre · starter areas</label>
          <div className='nearby-manual-row'>
            <select
              className='field'
              id={`${id}-area`}
              value={manual}
              onChange={event => {
                session.stop();
                setManual(event.target.value);
              }}
            >
              <option value=''>Choose a city</option>
              {nearbyManualAreas.map(area => (
                <option key={area.name}>{area.name}</option>
              ))}
            </select>
            <button type='button' className='secondary-action' disabled={!selected || busy} onClick={() => start('manual')}>
              {host ? 'Enable around this city centre' : 'Explore this city'}
            </button>
          </div>
          <p className='nearby-hint'>
            This separate search starts at the selected city centre, not your current location. It only includes the chosen radius. If your city is not listed,
            use a room link or QR code.
          </p>
        </details>
        <details className='nearby-manual'>
          <summary>How your area is shared</summary>
          <p className='nearby-hint'>
            The room service receives an approximate area, never your exact coordinates. People searching may infer your broad area. Nearby does not prove where
            someone is. Room links work from anywhere. Visibility stops when you leave the app; a lost connection may take up to 90 seconds to expire.
          </p>
        </details>
      </details>
      {active && source === 'device' && requiresExplicitProductRoomEntry() && (
        <div className='nearby-actions'>
          <p className='nearby-hint'>Current position · valid for up to 90 seconds.</p>
          <button type='button' className='secondary-action' onClick={() => start('device')}>
            <MapPin size={17} /> Update my location
          </button>
        </div>
      )}
      <p ref={statusRef} tabIndex={-1} role='status' className='nearby-status' data-phase={state.phase}>
        {state.message || (host ? 'Off · your room stays accessible by link.' : 'Search is off. Your location has not been requested.')}
      </p>
      {!host && state.phase === 'empty' && radius < 25 && (
        <button
          className='secondary-action'
          type='button'
          onClick={() => {
            const next = NEARBY_RADII[NEARBY_RADII.indexOf(radius) + 1];
            setRadius(next);
            start(source, next);
          }}
        >
          Widen search to {NEARBY_RADII[NEARBY_RADII.indexOf(radius) + 1]} km
        </button>
      )}
      {!host && (
        <ul className='nearby-results'>
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
                <ArrowRight size={17} />
              </button>
              <div className='nearby-room-actions'>
                <button type='button' className='text-action' onClick={() => session.hide(room.roomId)}>
                  <EyeOff size={15} />
                  Hide
                </button>
                <button
                  type='button'
                  className='text-action'
                  aria-expanded={reportId === room.discoveryId}
                  onClick={() => setReportId(reportId === room.discoveryId ? null : room.discoveryId)}
                >
                  <Flag size={15} />
                  Report
                </button>
              </div>
              {reportId === room.discoveryId && (
                <div className='nearby-report'>
                  <p>Hide this room and send an aggregate safety signal. There is no moderation case or response.</p>
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
