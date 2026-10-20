import { useEffect, useId, useRef, useState } from 'react';
import { ChevronRight, Globe, Link2, Radar, X } from 'lucide-react';
import type { useNearby } from '../features/rooms/useNearby';
import { DiscoveryChoice, NearbyRadius, type DiscoveryMode } from './NearbyVisibility';
import { Dialog } from './Dialog';
import { RoomProfileFields, type RoomProfile } from './RoomProfileFields';
import type { RoomRealtimePort } from '../features/rooms/roomRealtimePort';
import { ProductNearbyFallback } from './ProductNearbyFallback';

/** Host publication is always an explicit choice, independently of scanning. */
export function NearbyControls({ nearby, port }: { nearby: ReturnType<typeof useNearby>; host?: boolean; port?: RoomRealtimePort | null }) {
  const id = useId();
  const operation = useRef(0);
  useEffect(
    () => () => {
      operation.current++;
    },
    []
  );
  const dismiss = () => {
    operation.current++;
    setSaving(false);
    setOpen(false);
  };
  const [profile, setProfile] = useState<RoomProfile>();
  const [profileError, setProfileError] = useState('');
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<DiscoveryMode>('link');
  const [radius, setRadius] = useState(5);
  const { session, state } = nearby;
  if (!session) return null;
  const selection = session.selection();
  const activeMode: DiscoveryMode = selection.source?.kind === 'worldwide' ? 'everyone' : selection.source ? 'nearby' : 'link';
  const busy = state.phase === 'locating' || state.phase === 'checking';
  const unavailable = ['stale', 'denied', 'disconnected'].includes(state.phase);
  const label = activeMode === 'everyone' ? 'Worldwide' : activeMode === 'nearby' ? `Nearby · ${selection.radius} km` : 'Link only';
  const Icon = activeMode === 'everyone' ? Globe : activeMode === 'nearby' ? Radar : Link2;
  const edit = () => {
    const revision = ++operation.current;
    setMode(activeMode);
    setRadius(selection.radius);
    setOpen(true);
    setProfile(undefined);
    setProfileError('');
    port?.request('room:profile:get', {}, { connectedOnly: true, timeoutMs: 6000 }, (error, reply) => {
      if (revision !== operation.current) return;
      if (!error && reply?.ok && reply.profile) setProfile(reply.profile);
      else setProfileError('Room details could not be loaded. Reopen these settings to try again.');
    });
  };
  const apply = async () => {
    if (saving) return;
    const revision = operation.current;
    if (port && profile) {
      setSaving(true);
      const ok = await new Promise<boolean>(resolve =>
        port.request('room:profile', profile, { connectedOnly: true, timeoutMs: 6000 }, (error, reply) => resolve(!error && reply?.ok === true))
      );
      if (revision !== operation.current) return;
      setSaving(false);
      if (!ok) {
        setProfileError('Room details could not be saved. Please try again.');
        return;
      }
    }
    setOpen(false);
    if (mode === 'link') session.stop();
    else if (mode !== activeMode || (mode === 'nearby' && radius !== selection.radius) || unavailable) {
      // Cancel a pending grant before changing mode; late replies cannot publish.
      session.stop();
      void session.start({ kind: mode === 'everyone' ? 'worldwide' : 'device' }, radius);
    }
  };
  return (
    <section className='nearby-panel-host discovery-host' aria-label='Room visibility'>
      <button className='discovery-host-trigger' type='button' onClick={edit} aria-haspopup='dialog'>
        <Icon size={22} aria-hidden='true' />
        <span>
          <small>Who can find this room?</small>
          <strong>
            {state.revocationPending
              ? 'Updating visibility…'
              : state.phase === 'locating'
                ? 'Finding your area…'
                : busy
                  ? 'Updating visibility…'
                  : unavailable && activeMode !== 'link'
                    ? `${label} · unavailable`
                    : label}
          </strong>
        </span>
        <ChevronRight size={19} aria-hidden='true' />
      </button>
      {state.message && (
        <p className='nearby-status' role='status'>
          {state.message}
        </p>
      )}
      {unavailable && activeMode !== 'link' && (
        <button className='text-action' type='button' onClick={() => void session.start(selection.source!, selection.radius)}>
          Retry visibility
        </button>
      )}
      {state.locationIssue === 'host-unavailable' && <ProductNearbyFallback />}
      {open && (
        <Dialog className='discovery-sheet' labelledBy={`${id}-title`} onClose={dismiss} historyDismiss>
          <header className='discovery-sheet-heading'>
            <div>
              <span className='discovery-eyebrow'>YOUR INVITATION</span>
              <h2 id={`${id}-title`}>Who can find this room?</h2>
            </div>
            <button className='icon-button' type='button' onClick={dismiss} aria-label='Close visibility settings'>
              <X size={21} />
            </button>
          </header>
          <DiscoveryChoice value={mode} labelledBy={`${id}-title`} onChange={setMode} />
          {mode === 'nearby' && <NearbyRadius value={radius} onChange={setRadius} label='Visibility range' />}
          <p className='nearby-hint'>
            {mode === 'nearby'
              ? 'Your area updates while Dotify is on screen. In the background, your room stays visible around its last area while connected.'
              : mode === 'everyone'
                ? 'Anyone can see your room and join. Your location is not shared.'
                : state.revocationPending
                  ? 'Removal is not confirmed yet. The room may remain discoverable for up to 90 seconds.'
                  : 'Only people with your link or room code can find you.'}
          </p>
          {mode !== 'link' && <p className='nearby-hint'>The artist can also find your public room, wherever they are.</p>}
          {profile && (
            <details className='room-profile-optional'>
              <summary>Room name and invitation</summary>
              <RoomProfileFields value={profile} onChange={setProfile} />
            </details>
          )}
          {profileError && <p role='alert'>{profileError}</p>}
          <button type='button' disabled={saving} className='primary-action discovery-done' onClick={() => void apply()}>
            Done
          </button>
        </Dialog>
      )}
    </section>
  );
}
