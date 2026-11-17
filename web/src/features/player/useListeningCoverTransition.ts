import { useLayoutEffect, useRef, type RefObject } from 'react';

/** Presentation-only continuity: the same artwork anchors solo ↔ Room.
 * No source, clock or signaling update waits for this optional animation. */
export function useListeningCoverTransition(cover: RefObject<HTMLElement>, roomId: string, trackIdentity: string) {
  const previous = useRef<{ roomId: string; trackIdentity: string; rect: DOMRect }>();
  const animation = useRef<Animation>();
  useLayoutEffect(() => {
    const element = cover.current;
    if (!element) return;
    animation.current?.cancel();
    animation.current = undefined;
    const next = element.getBoundingClientRect();
    const old = previous.current;
    if (
      old &&
      old.roomId !== roomId &&
      old.trackIdentity === trackIdentity &&
      old.rect.width &&
      next.width &&
      old.rect.bottom > 0 &&
      old.rect.top < window.innerHeight &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
      typeof element.animate === 'function'
    ) {
      animation.current = element.animate(
        [
          {
            transformOrigin: 'top left',
            transform: `translate(${old.rect.left - next.left}px, ${old.rect.top - next.top}px) scale(${old.rect.width / next.width}, ${old.rect.height / next.height})`
          },
          { transformOrigin: 'top left', transform: 'none' }
        ],
        { duration: 360, easing: 'cubic-bezier(0.22, 0.8, 0.3, 1)' }
      );
    }
    previous.current = { roomId, trackIdentity, rect: next };
    const remember = () => {
      if (animation.current?.playState === 'running') return;
      previous.current = { roomId, trackIdentity, rect: element.getBoundingClientRect() };
    };
    const resize = new ResizeObserver(remember);
    resize.observe(element);
    window.addEventListener('scroll', remember, { passive: true });
    return () => {
      animation.current?.cancel();
      resize.disconnect();
      window.removeEventListener('scroll', remember);
    };
  }, [cover, roomId, trackIdentity]);
}
