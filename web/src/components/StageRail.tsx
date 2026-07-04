// The Stage (Constellation phase A) - the catalog as a stage rail: covers on a
// shallow arc, an aura-colored lamp cone that lights the hovered/focused track
// while the rest of the rail dims, and a holographic glare reserved for tracks
// the wallet has genuinely unlocked. CSS + requestAnimationFrame only, no WebGL.
// Spec: docs/design/dotify-constellation-ux.md (surface A).
//
// Honesty rule: the lamp color is the track's real aura, the glare only appears
// when catalogAccessByTrackId grants access, and the price chip shows the real
// access label. Nothing here animates fabricated data.
//
// The e2e-load-bearing selectors (track-card / track-card-open) belong to the
// catalogue grid; the stage uses its own stage-* testids so they stay unique.

import { useEffect, useMemo, useRef, useState } from 'react';
import { auraForTrack } from '../shared/utils/aura';
import { catalogAccessLabel } from '../shared/utils/format';
import type { CatalogTrack } from '../shared/types';

type StageRailProps = {
  tracks: CatalogTrack[];
  accessByTrackId: Record<string, boolean>;
  selectedTrackId: string;
  onOpenTrack: (track: CatalogTrack) => void;
};

// Arc shape: how far a card sinks and tilts as it moves away from center stage.
const ARC_DROP_PX = 26;
const ARC_TILT_DEG = 5;
const ARC_SCALE_LOSS = 0.07;

export function StageRail({ tracks, accessByTrackId, selectedTrackId, onOpenTrack }: StageRailProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const lampRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const [litId, setLitId] = useState<string | null>(null);

  // The opening act: the selected track (or the first) is on stage by default.
  const defaultLitId = tracks.some(track => track.id === selectedTrackId) ? selectedTrackId : (tracks[0]?.id ?? null);
  const activeLitId = litId ?? defaultLitId;
  const litTrack = tracks.find(track => track.id === activeLitId) ?? null;
  const litAura = useMemo(() => auraForTrack(litTrack), [litTrack]);

  // Arc + lamp geometry, recomputed on scroll/resize via one rAF-throttled pass.
  // Written straight to the DOM so scrolling never re-renders React.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const update = () => {
      frameRef.current = 0;
      const railRect = rail.getBoundingClientRect();
      const railCenter = railRect.left + railRect.width / 2;
      for (const card of rail.querySelectorAll<HTMLElement>('.stage-card')) {
        if (reduceMotion.matches) {
          card.style.removeProperty('--arc-y');
          card.style.removeProperty('--arc-rot');
          card.style.removeProperty('--arc-scale');
          continue;
        }
        const rect = card.getBoundingClientRect();
        const distance = Math.max(-1, Math.min(1, (rect.left + rect.width / 2 - railCenter) / (railRect.width / 2)));
        card.style.setProperty('--arc-y', `${(Math.abs(distance) * ARC_DROP_PX).toFixed(1)}px`);
        card.style.setProperty('--arc-rot', `${(distance * ARC_TILT_DEG).toFixed(2)}deg`);
        card.style.setProperty('--arc-scale', (1 - Math.abs(distance) * ARC_SCALE_LOSS).toFixed(3));
      }
      const lamp = lampRef.current;
      const litCard = rail.querySelector<HTMLElement>('.stage-card[data-lit="true"]');
      if (lamp && litCard) {
        const rect = litCard.getBoundingClientRect();
        lamp.style.transform = `translateX(${(rect.left + rect.width / 2 - railRect.left).toFixed(1)}px)`;
      }
    };

    const schedule = () => {
      if (frameRef.current) return;
      frameRef.current = window.requestAnimationFrame(update);
    };

    update();
    rail.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      rail.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    };
  }, [tracks, activeLitId]);

  if (tracks.length === 0) return null;

  return (
    <section
      className='stage'
      aria-label='Catalog on stage'
      data-testid='stage-rail'
      style={{ '--lamp-a': litAura.a, '--lamp-b': litAura.b, '--lamp-accent': litAura.accent } as React.CSSProperties}
      onMouseLeave={() => setLitId(null)}
    >
      <div className='stage-lamp' ref={lampRef} aria-hidden='true'>
        <span className='stage-lamp-cone' />
        <span className='stage-lamp-glow' />
      </div>
      <div className='stage-rail' ref={railRef}>
        {tracks.map(track => {
          const unlocked = accessByTrackId[track.id] === true;
          const aura = auraForTrack(track);
          return (
            <button
              className='stage-card'
              type='button'
              key={track.id}
              data-lit={track.id === activeLitId}
              data-unlocked={unlocked}
              data-testid='stage-card'
              style={{ '--card-a': aura.a, '--card-accent': aura.accent } as React.CSSProperties}
              aria-label={`Open ${track.title} by ${track.artist}`}
              onMouseEnter={() => setLitId(track.id)}
              onFocus={() => setLitId(track.id)}
              onClick={() => onOpenTrack(track)}
            >
              <span className='stage-cover'>
                <img src={track.imageRef} alt='' crossOrigin='anonymous' loading='lazy' />
                <span className='stage-glare' aria-hidden='true' />
              </span>
              <span className='stage-copy'>
                <strong>{track.title}</strong>
                <span>{track.artist}</span>
                <small data-access={unlocked ? 'granted' : 'locked'}>{unlocked ? 'Unlocked for this wallet' : catalogAccessLabel(track)}</small>
              </span>
            </button>
          );
        })}
      </div>
      <div className='stage-floor' aria-hidden='true' />
    </section>
  );
}
