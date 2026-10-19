import { useLayoutEffect } from 'react';
import { roomComposerSelector } from '../features/rooms/roomViewport';

// Portalled dialogs and document forms share the visible screen. The room
// composer keeps its dedicated layout controller in useRoomViewport.
const editableSelector =
  'textarea:not([readonly]):not([disabled]), input:not([readonly]):not([disabled]):is(:not([type]), [type="text"], [type="search"], [type="email"], [type="url"], [type="tel"], [type="password"], [type="number"]), [contenteditable="true"]';

function revealField(field: HTMLElement, top: number, bottom: number) {
  // Reveal within the nearest scrollable surface first. Never scroll the
  // listening page behind a dialog, or center a field that is already visible.
  const dialog = field.closest<HTMLElement>('[role="dialog"]');
  const label = field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement ? field.labels?.[0] : null;
  const delta = (visibleTop: number, visibleBottom: number) => {
    const rect = field.getBoundingClientRect();
    const labelTop = label?.getBoundingClientRect().top;
    const start = labelTop !== undefined && labelTop <= rect.top && rect.top - labelTop < 80 ? labelTop : rect.top;
    const end = Math.min(rect.bottom, start + Math.max(40, visibleBottom - visibleTop));
    if (start < visibleTop) return start - visibleTop;
    if (end > visibleBottom) return end - visibleBottom;
    return 0;
  };
  for (let parent = field.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    if (/(auto|scroll)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight) {
      const rect = parent.getBoundingClientRect();
      const movement = delta(Math.max(top, rect.top + 12), Math.min(bottom, rect.bottom - 12));
      if (Math.abs(movement) > 1) parent.scrollBy({ top: movement, behavior: 'instant' });
    }
    if (parent === dialog) return;
  }
  if (!dialog) {
    const movement = delta(top, bottom);
    if (Math.abs(movement) > 1) window.scrollBy({ top: movement, behavior: 'instant' });
  }
}

export function FormViewport() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let restingHeight = 0;
    let layoutWidth = window.innerWidth;
    let editingSession = false;
    let keyboardOpen = false;
    let pressingControl = false;
    let frame = 0;
    const timers: number[] = [];

    const update = () => {
      // A blur can precede click. Keep the action under the finger until release.
      if (pressingControl) return;
      const height = viewport?.height ?? window.innerHeight;
      const width = viewport?.width ?? window.innerWidth;
      const scale = viewport?.scale ?? 1;
      const top = viewport?.offsetTop ?? 0;
      const left = viewport?.offsetLeft ?? 0;
      if (
        ![height, width, scale, window.innerHeight, window.innerWidth].every(value => Number.isFinite(value) && value > 0) ||
        ![top, left].every(Number.isFinite)
      )
        return;

      const focused = document.activeElement;
      const field = focused instanceof HTMLElement && focused.matches(editableSelector) ? focused : null;
      const roomOwnsFocus = Boolean(field?.closest('.app-shell[data-room-focus="true"]')) && Boolean(field?.matches(roomComposerSelector));
      const dialogOwnsFocus = Boolean(field?.closest('[role="dialog"]'));
      // Native transitions can begin with an empty frame. Learn the baseline
      // only from valid geometry, including if focus arrived in the meantime.
      if (!restingHeight) restingHeight = field ? Math.max(window.innerHeight, height * scale) : height * scale;
      if (Math.abs(layoutWidth - window.innerWidth) > 80) restingHeight = window.innerHeight;
      layoutWidth = window.innerWidth;
      if (field) editingSession = true;
      // Scale normalization distinguishes pinch zoom from keyboard occlusion.
      keyboardOpen = editingSession && restingHeight - height * scale > (keyboardOpen ? 40 : 120);
      if (!field && !keyboardOpen) {
        editingSession = false;
        restingHeight = height * scale;
      }

      root.style.setProperty('--form-viewport-height', `${height}px`);
      root.style.setProperty('--form-viewport-width', `${width}px`);
      root.style.setProperty('--form-viewport-top', `${top}px`);
      root.style.setProperty('--form-viewport-left', `${left}px`);
      root.style.setProperty('--form-keyboard-inset', `${Math.max(0, window.innerHeight - height - top)}px`);
      root.dataset.formKeyboard = String(keyboardOpen && !roomOwnsFocus && !dialogOwnsFocus && Boolean(field));
      root.dataset.keyboardVisible = String(keyboardOpen);

      if (field && !roomOwnsFocus) {
        const header = !dialogOwnsFocus ? document.querySelector('.topbar')?.getBoundingClientRect() : null;
        revealField(field, Math.max(top + 16, header && header.top <= top ? header.bottom + 12 : 0), top + height - 16);
      }
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const focusChanged = () => {
      schedule();
      timers.splice(0).forEach(clearTimeout);
      // WebKit may only report final geometry after its keyboard animation.
      for (const delay of [80, 240, 500]) timers.push(window.setTimeout(schedule, delay));
    };
    const pointerStarted = (event: PointerEvent) => {
      pressingControl = event.target instanceof Element && Boolean(event.target.closest('button, a, [role="button"]'));
    };
    const pointerFinished = () => {
      if (!pressingControl) return;
      pressingControl = false;
      schedule();
    };
    update();
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    document.addEventListener('focusin', focusChanged);
    document.addEventListener('focusout', focusChanged);
    document.addEventListener('pointerdown', pointerStarted, true);
    window.addEventListener('pointerup', pointerFinished);
    window.addEventListener('pointercancel', pointerFinished);
    return () => {
      cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('focusin', focusChanged);
      document.removeEventListener('focusout', focusChanged);
      document.removeEventListener('pointerdown', pointerStarted, true);
      window.removeEventListener('pointerup', pointerFinished);
      window.removeEventListener('pointercancel', pointerFinished);
      for (const name of ['height', 'width', 'top', 'left']) root.style.removeProperty(`--form-viewport-${name}`);
      root.style.removeProperty('--form-keyboard-inset');
      delete root.dataset.formKeyboard;
      delete root.dataset.keyboardVisible;
    };
  }, []);
  return null;
}
