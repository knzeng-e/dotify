import { useEffect, useRef } from 'react';
import { keyboardOccludesRoom } from './roomViewport';

// Visual viewport owns geometry; editor focus owns composing mode. Neither
// depends on innerHeight and visualViewport shrinking at different times.
export function useRoomViewport(active: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const shell = ref.current;
    if (!active || !shell) return;
    const viewport = window.visualViewport;
    let baselineHeight = window.innerHeight;
    let restingInset = Math.max(0, baselineHeight - (viewport?.height ?? window.innerHeight) * (viewport?.scale ?? 1));
    let layoutWidth = window.innerWidth;
    let composingSession = false;
    let wasKeyboardOpen = false;
    let frame = 0;
    let pressingControl = false;
    const timers: number[] = [];
    const update = () => {
      // Blur can precede click. Do not move a tapped control before release.
      if (pressingControl) return;
      const focused = document.activeElement;
      const editing =
        focused instanceof HTMLElement && shell.contains(focused) && focused.matches('.room-chat-form input, .room-chat-form textarea, .room-composer-done');
      if (Math.abs(window.innerWidth - layoutWidth) > 80) {
        baselineHeight = window.innerHeight;
        restingInset = 0;
      }
      layoutWidth = window.innerWidth;
      baselineHeight = Math.max(baselineHeight, window.innerHeight);
      if (editing) composingSession = true;
      const height = viewport?.height ?? window.innerHeight;
      const scale = viewport?.scale ?? 1;
      // Existing browser chrome is not keyboard occlusion. Measure changes
      // from the resting viewport, including during the closing animation.
      const restingHeight = baselineHeight - restingInset;
      const keyboardOpen = composingSession && (keyboardOccludesRoom(restingHeight, height, scale) || (wasKeyboardOpen && restingHeight - height * scale > 40));
      // Focus precedes the keyboard animation. Compact only with measured
      // occlusion, avoiding a full-height flash and hardware-keyboard jumps.
      const composing = keyboardOpen;
      wasKeyboardOpen = keyboardOpen;
      if (!editing && !keyboardOpen) composingSession = false;
      shell.style.setProperty('--room-viewport-height', `${height}px`);
      shell.style.setProperty('--room-viewport-top', `${viewport?.offsetTop ?? 0}px`);
      shell.style.setProperty('--room-viewport-width', `${composing ? (viewport?.width ?? window.innerWidth) : window.innerWidth}px`);
      shell.style.setProperty('--room-viewport-left', `${composing ? (viewport?.offsetLeft ?? 0) : 0}px`);
      shell.dataset.keyboardOpen = String(keyboardOpen);
      shell.dataset.composing = String(composing);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const focusChanged = () => {
      schedule();
      timers.splice(0).forEach(clearTimeout);
      // WebKit can publish keyboard geometry only after its opening/closing
      // animation. Bounded follow-up reads cover that delay without polling.
      for (const delay of [80, 240, 500]) timers.push(window.setTimeout(schedule, delay));
    };
    const pointerStarted = (event: PointerEvent) => {
      pressingControl = event.target instanceof Element && shell.contains(event.target) && Boolean(event.target.closest('button'));
    };
    const pointerFinished = () => {
      if (!pressingControl) return;
      pressingControl = false;
      schedule();
    };
    update();
    window.addEventListener('pointerdown', pointerStarted, true);
    window.addEventListener('pointerup', pointerFinished);
    window.addEventListener('pointercancel', pointerFinished);
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    document.addEventListener('focusin', focusChanged);
    document.addEventListener('focusout', focusChanged);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointerdown', pointerStarted, true);
      window.removeEventListener('pointerup', pointerFinished);
      window.removeEventListener('pointercancel', pointerFinished);
      timers.forEach(clearTimeout);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('focusin', focusChanged);
      document.removeEventListener('focusout', focusChanged);
      for (const name of ['height', 'top', 'width', 'left']) shell.style.removeProperty(`--room-viewport-${name}`);
      delete shell.dataset.keyboardOpen;
      delete shell.dataset.composing;
    };
  }, [active]);
  return ref;
}
