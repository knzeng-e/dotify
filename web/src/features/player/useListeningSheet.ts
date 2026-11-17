import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';

/** Presentation only: the existing Dialog continues to own history/focus. */
export function useListeningSheet(onClose: () => void, open = true) {
  const closeRef = useRef(onClose);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const closingRef = useRef(false);
  const [closing, setClosing] = useState(false);
  const gesture = useRef<{ y: number; offset: number; card: HTMLElement } | null>(null);
  const dragged = useRef(false);
  const cardRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => () => clearTimeout(timer.current), []);
  useLayoutEffect(() => {
    clearTimeout(timer.current);
    const card = cardRef.current;
    card?.style.removeProperty('--sheet-pull');
    if (card) {
      delete card.dataset.presented;
      delete card.dataset.pulling;
    }
    gesture.current = null;
    dragged.current = false;
    closingRef.current = false;
    setClosing(false);
  }, [open]);
  const dismissThen = (after?: () => void) => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      closeRef.current();
      after?.();
      return;
    }
    setClosing(true);
    timer.current = setTimeout(() => {
      closeRef.current();
      after?.();
    }, 200);
  };
  const close = () => dismissThen();
  const reset = () => {
    if (gesture.current) {
      gesture.current.card.style.removeProperty('--sheet-pull');
      delete gesture.current.card.dataset.pulling;
      gesture.current = null;
    }
  };
  return {
    closing,
    close,
    dismissThen,
    handle: {
      onPointerDown(event: PointerEvent<HTMLButtonElement>) {
        if (closingRef.current || event.button !== 0) return;
        const card = event.currentTarget.closest<HTMLElement>('.listening-sheet');
        if (!card) return;
        cardRef.current = card;
        dragged.current = false;
        gesture.current = { y: event.clientY, offset: 0, card };
        event.currentTarget.setPointerCapture(event.pointerId);
        card.dataset.presented = 'true';
        card.dataset.pulling = 'true';
      },
      onPointerMove(event: PointerEvent<HTMLButtonElement>) {
        const active = gesture.current;
        if (!active) return;
        active.offset = Math.max(0, Math.min(400, event.clientY - active.y));
        if (active.offset > 6) dragged.current = true;
        active.card.style.setProperty('--sheet-pull', `${active.offset}px`);
      },
      onPointerUp(event: PointerEvent<HTMLButtonElement>) {
        const offset = gesture.current?.offset ?? 0;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        if (offset >= 80) {
          close();
          if (gesture.current) delete gesture.current.card.dataset.pulling;
          // Continue the exit from the pulled position instead of jumping back.
          gesture.current = null;
        } else reset();
      },
      onPointerCancel() {
        reset();
        dragged.current = false;
      },
      onClick() {
        if (!dragged.current) close();
        dragged.current = false;
      }
    }
  };
}
