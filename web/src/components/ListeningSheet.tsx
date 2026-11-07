import type { ReactNode } from 'react';
import { Dialog } from './Dialog';
import { useListeningSheet } from '../features/player/useListeningSheet';

/** Shared presentation for listening tools. Dialog retains focus/history ownership. */
export function ListeningSheet({
  children,
  labelledBy,
  describedBy,
  className = '',
  onClose,
  open = true,
  handleLabel = 'Collapse panel',
  initialFocus = 'first',
  listeningAnchor
}: {
  children: (close: () => void, closing: boolean, dismissThen: (after: () => void) => void) => ReactNode;
  labelledBy: string;
  describedBy?: string;
  className?: string;
  onClose: () => void;
  open?: boolean;
  handleLabel?: string;
  initialFocus?: 'dialog' | 'first';
  listeningAnchor?: ReactNode;
}) {
  const sheet = useListeningSheet(onClose, open);
  return (
    <Dialog
      open={open}
      historyDismiss
      initialFocus={initialFocus}
      labelledBy={labelledBy}
      describedBy={describedBy}
      className={`listening-sheet ${listeningAnchor ? 'listening-sheet-anchored' : ''} ${className}`}
      backdropClassName='listening-sheet-backdrop'
      dataAttributes={{ closing: sheet.closing }}
      onClose={sheet.close}
    >
      <button className='queue-sheet-handle' type='button' aria-label={handleLabel} title='Pull down or tap to close' {...sheet.handle} />
      {listeningAnchor ? (
        <>
          <div className='listening-sheet-content'>{children(sheet.close, sheet.closing, sheet.dismissThen)}</div>
          {listeningAnchor}
        </>
      ) : (
        children(sheet.close, sheet.closing, sheet.dismissThen)
      )}
    </Dialog>
  );
}
