import { useId, useState } from 'react';
import { ChevronRight, Globe2, Link2, Radar, X } from 'lucide-react';
import type { useNearby } from '../features/rooms/useNearby';
import { DiscoveryChoice, NearbyRadius, type DiscoveryMode } from './NearbyVisibility';
import { Dialog } from './Dialog';

/** Host publication is always an explicit choice, independently of scanning. */
export function NearbyControls({ nearby }: { nearby: ReturnType<typeof useNearby>; host?: boolean }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<DiscoveryMode>('link');
  const [radius, setRadius] = useState(5);
  const { session, state } = nearby;
  if (!session) return null;
  const selection = session.selection();
  const activeMode: DiscoveryMode = selection.source?.kind === 'worldwide' ? 'everyone' : selection.source ? 'nearby' : 'link';
  const busy = state.phase === 'locating' || state.phase === 'checking';
  const label = activeMode === 'everyone' ? 'Worldwide' : activeMode === 'nearby' ? `Nearby · ${selection.radius} km` : 'Link only';
  const Icon = activeMode === 'everyone' ? Globe2 : activeMode === 'nearby' ? Radar : Link2;
  const edit = () => {
    setMode(activeMode);
    setRadius(selection.radius);
    setOpen(true);
  };
  const apply = () => {
    setOpen(false);
    if (mode === 'link') session.stop();
    else if (mode !== activeMode || (mode === 'nearby' && radius !== selection.radius)) {
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
          <strong>{busy ? 'Setting your location…' : label}</strong>
        </span>
        <ChevronRight size={19} aria-hidden='true' />
      </button>
      {state.message && (
        <p className='nearby-status' role='status'>
          {state.message}
        </p>
      )}
      {open && (
        <Dialog className='discovery-sheet' labelledBy={`${id}-title`} onClose={() => setOpen(false)} historyDismiss>
          <header className='discovery-sheet-heading'>
            <div>
              <span className='discovery-eyebrow'>YOUR INVITATION</span>
              <h2 id={`${id}-title`}>Who can find this room?</h2>
            </div>
            <button className='icon-button' type='button' onClick={() => setOpen(false)} aria-label='Close visibility settings'>
              <X size={21} />
            </button>
          </header>
          <DiscoveryChoice value={mode} labelledBy={`${id}-title`} onChange={setMode} />
          {mode === 'nearby' && <NearbyRadius value={radius} onChange={setRadius} label='Visibility range' />}
          <p className='nearby-hint'>
            {mode === 'nearby'
              ? 'Your approximate area updates while Dotify is open. Your exact position stays on this device.'
              : mode === 'everyone'
                ? 'Anyone can see your room and join. Your location is not shared.'
                : 'Only people with your link or room code can find you.'}
          </p>
          <button type='button' className='primary-action discovery-done' onClick={apply}>
            Done
          </button>
        </Dialog>
      )}
    </section>
  );
}
