import { useEffect, useRef } from 'react';

// Only the active room uses the visual viewport: keep conversation above the
// software keyboard without remounting either persistent audio element.
export function useRoomViewport(active: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const shell = ref.current;
    if (!active || !shell) return;
    const viewport = window.visualViewport;
    const update = () => {
      shell.style.setProperty('--room-viewport-height', `${viewport?.height ?? window.innerHeight}px`);
      shell.style.setProperty('--room-viewport-top', `${viewport?.offsetTop ?? 0}px`);
      shell.dataset.keyboardOpen = String(Boolean(viewport && window.innerHeight - viewport.height > 150 && viewport.scale === 1));
    };
    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      shell.style.removeProperty('--room-viewport-height');
      shell.style.removeProperty('--room-viewport-top');
      delete shell.dataset.keyboardOpen;
    };
  }, [active]);
  return ref;
}
