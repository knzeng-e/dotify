import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { useNearbyPreview, type NearbyResult } from '../features/rooms/useNearbyPreview';

function AreaChoice({
  areas,
  value,
  onChange,
  disabled = false
}: {
  areas: { id: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className='nearby-area-choice'>
      Pilot area
      <select className='field' value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>
        <option value=''>Choose a broad area</option>
        {areas.map(area => (
          <option key={area.id} value={area.id}>
            {area.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function NearbyHostPreview() {
  const { areas, error, setError, request, loadAreas, socketRef, connected, generationRef } = useNearbyPreview();
  const [area, setArea] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [pending, setPending] = useState(false);
  const sharing = useRef(false);
  const [mayBeSharing, setMayBeSharing] = useState(false);
  useEffect(() => {
    function stop() {
      generationRef.current += 1;
      if (sharing.current) socketRef.current?.volatile.emit('nearby:revoke');
      sharing.current = false;
      setMayBeSharing(false);
      setExpiresAt(0);
      setPending(false);
    }
    function visibility() {
      if (document.hidden) stop();
    }
    const socket = socketRef.current;
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', stop);
    socket?.on('disconnect', stop);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', stop);
      socket?.off('disconnect', stop);
    };
  }, [socketRef, generationRef, connected]);
  useEffect(() => {
    if (!expiresAt) return;
    const timer = window.setTimeout(
      () => {
        sharing.current = false;
        setMayBeSharing(false);
        setExpiresAt(0);
        setError('Area sharing expired. Choose to share again if you want.');
      },
      Math.max(0, expiresAt - Date.now())
    );
    return () => clearTimeout(timer);
  }, [expiresAt, setError]);
  async function stopSharing() {
    generationRef.current += 1;
    sharing.current = false;
    setMayBeSharing(false);
    setExpiresAt(0);
    setPending(false);
    const result = await request('nearby:revoke');
    setError(result.ok ? 'Area sharing is off.' : 'Stopped here. The service has not confirmed removal; the listing expires within 90 seconds.');
  }
  return (
    <details className='nearby-preview'>
      <summary>
        <MapPin size={16} /> Invite around an area <span>Preview</span>
      </summary>
      <p>
        Choose a broad pilot area; we do not use your device’s location. The room service sees your chosen area and connection address. People may recognise you
        from the room.
      </p>
      <p>
        Sharing lasts 90 seconds and stops when you leave this view or hide the app. Previously loaded results may remain for 30 seconds. Room links keep
        working.
      </p>
      {!areas.length && (
        <button type='button' className='secondary-action' disabled={!connected} onClick={() => void loadAreas()}>
          Choose an area to share
        </button>
      )}
      {!!areas.length && (
        <form
          onSubmit={event => {
            event.preventDefault();
            if (!area || pending || !connected) return;
            const current = generationRef.current;
            sharing.current = true;
            setMayBeSharing(true);
            setPending(true);
            setError('');
            void request('nearby:publish', { areaId: area, consent: true }).then(result => {
              if (current !== generationRef.current) return;
              setPending(false);
              if (result.ok && result.expiresAt) setExpiresAt(result.expiresAt);
              else setError(result.message || 'Sharing was not confirmed. Use Stop sharing to cancel any pending listing.');
            });
          }}
        >
          <AreaChoice areas={areas} value={area} onChange={setArea} disabled={!!expiresAt || pending} />
          <button className='secondary-action' type='submit' disabled={!area || pending || !connected}>
            {expiresAt ? 'Share for 90 more seconds' : 'Share this room for 90 seconds'}
          </button>
        </form>
      )}
      {(mayBeSharing || expiresAt > 0 || pending) && (
        <button type='button' className='text-action' onClick={() => void stopSharing()}>
          Stop sharing this area
        </button>
      )}
      {expiresAt > 0 && (
        <p role='status'>
          Visible in {areas.find(item => item.id === area)?.label} until{' '}
          {new Date(expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.
        </p>
      )}
      {error && <p role='status'>{error}</p>}
    </details>
  );
}

export function NearbyListenerPreview({ onJoinRoom, disabled }: { onJoinRoom: (roomId: string) => void; disabled: boolean }) {
  const { areas, error, setError, request, loadAreas, socketRef, connected, generationRef } = useNearbyPreview();
  const [area, setArea] = useState('');
  const [results, setResults] = useState<NearbyResult[] | null>(null);
  const [expiresAt, setExpiresAt] = useState(0);
  const [pending, setPending] = useState(false);
  const [searchedArea, setSearchedArea] = useState('');
  const resultsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!results) return;
    const frame = requestAnimationFrame(() => {
      resultsRef.current?.focus({ preventScroll: true });
      resultsRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
    return () => cancelAnimationFrame(frame);
  }, [results]);
  useEffect(() => {
    function clear() {
      generationRef.current += 1;
      setResults(null);
      setExpiresAt(0);
      setPending(false);
    }
    function visibility() {
      if (document.hidden) clear();
    }
    const socket = socketRef.current;
    document.addEventListener('visibilitychange', visibility);
    socket?.on('disconnect', clear);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      socket?.off('disconnect', clear);
    };
  }, [generationRef, socketRef, connected]);
  useEffect(() => {
    if (!expiresAt) return;
    const timer = window.setTimeout(
      () => {
        setResults(null);
        setExpiresAt(0);
        setError('Results expired. Search again for rooms still sharing.');
      },
      Math.max(0, expiresAt - Date.now())
    );
    return () => clearTimeout(timer);
  }, [expiresAt, setError]);
  return (
    <details className='nearby-preview nearby-discovery'>
      <summary>
        <MapPin size={16} /> Around a chosen area <span>Preview</span>
      </summary>
      <p>
        Find hosts who chose the same broad area; proximity is not verified. No device location is used. Searching shares your area choice and connection
        address with the service, without making you visible.
      </p>
      {!areas.length && (
        <button type='button' className='secondary-action' disabled={!connected} onClick={() => void loadAreas()}>
          Choose an area to search
        </button>
      )}
      {!!areas.length && (
        <form
          onSubmit={event => {
            event.preventDefault();
            if (!area || pending || !connected) return;
            const current = generationRef.current;
            setPending(true);
            setError('');
            setResults(null);
            setExpiresAt(0);
            void request('nearby:search', { areaId: area, consent: true }).then(result => {
              if (current !== generationRef.current) return;
              setPending(false);
              if (result.ok && result.results && result.expiresAt) {
                setResults(result.results);
                setExpiresAt(result.expiresAt);
                setSearchedArea(area);
              } else setError(result.message || 'The search could not be completed.');
            });
          }}
        >
          <AreaChoice
            areas={areas}
            value={area}
            onChange={next => {
              generationRef.current += 1;
              setArea(next);
              setResults(null);
              setExpiresAt(0);
              setPending(false);
            }}
            disabled={pending}
          />
          <button className='secondary-action' type='submit' disabled={!area || pending || !connected}>
            Search this area
          </button>
        </form>
      )}
      {(results || pending) && (
        <button
          type='button'
          className='text-action'
          onClick={() => {
            generationRef.current += 1;
            setResults(null);
            setExpiresAt(0);
            setArea('');
            setPending(false);
            setError('Area search is off.');
          }}
        >
          Stop area search
        </button>
      )}
      {results && (
        <div ref={resultsRef} className='nearby-results' tabIndex={-1} aria-label='Rooms sharing this area'>
          <p>Hosts sharing in {areas.find(item => item.id === searchedArea)?.label}. Results expire within 30 seconds.</p>
          {results.length ? (
            results.map(room => (
              <button
                type='button'
                className='secondary-action'
                key={room.discoveryId}
                disabled={disabled || !connected}
                onClick={() => {
                  if (room.expiresAt > Date.now() && expiresAt > Date.now()) onJoinRoom(room.roomId);
                  else {
                    setResults(null);
                    setError('Results expired. Search again.');
                  }
                }}
              >
                <span>
                  <strong>{room.title}</strong>
                  <small>{room.artist}</small>
                </span>
                <span>Join room</span>
              </button>
            ))
          ) : (
            <p>No hosts are sharing here right now. Try the live room list or a room code below.</p>
          )}
        </div>
      )}
      {error && <p role='status'>{error}</p>}
    </details>
  );
}
