import { useEffect, useState } from 'react';
import type { PlayerState } from '../../shared/types';
import { projectRoomClock } from './roomClock';

export function useRoomClock(sample: PlayerState | null, active: boolean) {
  const [clock, setClock] = useState(() => projectRoomClock(null, 0));
  useEffect(() => {
    if (!active || !sample) {
      setClock(projectRoomClock(sample, 0));
      return;
    }
    // Receipt time is monotonic and local; updatedAt is never subtracted from
    // the listener's Date.now(), which could be hours ahead/behind the host.
    const receivedAt = performance.now();
    const tick = () => setClock(projectRoomClock(sample, performance.now() - receivedAt));
    tick();
    if (!sample.playing) return;
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [sample, active]);
  return clock;
}
