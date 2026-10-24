import { lazy, Suspense, useEffect } from 'react';
import type { RoomGalaxySceneProps } from './RoomGalaxyScene';

function UnavailableScene({ onUnavailable }: Pick<RoomGalaxySceneProps, 'onUnavailable'>) {
  useEffect(() => onUnavailable('graphics'), [onUnavailable]);
  return null;
}

const RoomGalaxyScene = lazy(() =>
  import('./RoomGalaxyScene').then(module => ({ default: module.RoomGalaxyScene })).catch(() => ({ default: UnavailableScene }))
);

// Presentation only: the current scoped discovery owner remains mounted in
// the listener shell. Switching graphics never starts another room query.
export function RoomDiscoveryRenderer(props: RoomGalaxySceneProps) {
  return (
    <Suspense fallback={<p role='status'>Opening the 3D galaxy. The room list stays available.</p>}>
      <RoomGalaxyScene {...props} />
    </Suspense>
  );
}
