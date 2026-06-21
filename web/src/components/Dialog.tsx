import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type DialogProps = {
  backdropClassName?: string;
  children: ReactNode;
  className?: string;
  dataAttributes?: Record<string, string | number | boolean | undefined>;
  describedBy?: string;
  dismissible?: boolean;
  labelledBy: string;
  onClose?: () => void;
  size?: 'compact' | 'default' | 'wide';
  tone?: 'pending' | 'success' | 'error';
};

function getFocusableElements(dialog: HTMLDivElement | null) {
  if (!dialog) return [] as HTMLElement[];
  return Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter(element => element.getClientRects().length > 0 || element === document.activeElement);
}

export function Dialog({
  backdropClassName,
  children,
  className,
  dataAttributes,
  describedBy,
  dismissible = true,
  labelledBy,
  onClose,
  size = 'default',
  tone
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  const dataProps = Object.fromEntries(
    Object.entries(dataAttributes ?? {})
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [`data-${key}`, String(value)])
  );

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const appRoot = document.getElementById('root');
    const previousAriaHidden = appRoot?.getAttribute('aria-hidden') ?? null;
    document.body.style.overflow = 'hidden';
    // Dotify currently opens one dialog at a time. If nested dialogs are later
    // allowed, replace this restore logic with a stack-aware aria-hidden manager.
    appRoot?.setAttribute('aria-hidden', 'true');

    const frame = window.requestAnimationFrame(() => {
      const focusable = getFocusableElements(dialogRef.current);
      (focusable[0] ?? dialogRef.current)?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (dismissible) onCloseRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = getFocusableElements(dialog);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
        return;
      }
      if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousAriaHidden === null) {
        appRoot?.removeAttribute('aria-hidden');
      } else {
        appRoot?.setAttribute('aria-hidden', previousAriaHidden);
      }
      previousActive?.focus();
    };
  }, [dismissible]);

  const modal = (
    <div
      className={['modal-backdrop', backdropClassName].filter(Boolean).join(' ')}
      role='presentation'
      onClick={event => {
        if (dismissible && event.target === event.currentTarget) onCloseRef.current?.();
      }}
    >
      <div
        className={['modal-card', className].filter(Boolean).join(' ')}
        {...dataProps}
        data-size={size}
        data-tone={tone}
        role='dialog'
        aria-modal='true'
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        ref={dialogRef}
      >
        {children}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
