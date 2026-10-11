import { useRef, useState, type PointerEvent } from 'react';

/** A touch shortcut only: vertical scrolling, zoom and the visible action button stay available. */
export function useSwipeReply(onReply: () => void) {
  const gesture = useRef<{ id: number; x: number; y: number; dx: number } | null>(null);
  const [offset, setOffset] = useState(0);
  function cancel() {
    gesture.current = null;
    setOffset(0);
  }
  return {
    offset,
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (!event.isPrimary) {
        cancel();
        return;
      }
      if (event.pointerType !== 'touch' || event.clientX < 24 || (event.target as Element).closest('button, a, input, summary')) return;
      gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0 };
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const start = gesture.current;
      if (!start || start.id !== event.pointerId) return;
      const dx = event.clientX - start.x;
      const dy = Math.abs(event.clientY - start.y);
      if (dx < -10 || (dy > 10 && dy > dx / 2)) {
        cancel();
        return;
      }
      start.dx = dx;
      if (dx > 10) {
        event.currentTarget.setPointerCapture(event.pointerId);
        setOffset(Math.min(dx, 72));
      }
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      const start = gesture.current;
      cancel();
      if (start?.id === event.pointerId && start.dx >= 52 && !window.getSelection()?.toString()) onReply();
    },
    onPointerCancel: cancel,
    onLostPointerCapture(event: PointerEvent<HTMLElement>) {
      // Touch starts with implicit capture on the text node. Moving capture to
      // the row bubbles a loss from that child; only losing the row cancels us.
      if (event.target === event.currentTarget) cancel();
    }
  };
}
