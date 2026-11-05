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
  handleLabel = 'Collapse panel'
}: {
  children: (close: () => void, closing: boolean) => ReactNode;
  labelledBy: string;
  describedBy?: string;
  className?: string;
  onClose: () => void;
  open?: boolean;
  handleLabel?: string;
}) {
  const sheet = useListeningSheet(onClose, open);
  return (
    <Dialog
      open={open}
      historyDismiss
      labelledBy={labelledBy}
      describedBy={describedBy}
      className={`listening-sheet ${className}`}
      backdropClassName='listening-sheet-backdrop'
      dataAttributes={{ closing: sheet.closing }}
      onClose={sheet.close}
    >
      <button className='queue-sheet-handle' type='button' aria-label={handleLabel} title='Pull down or tap to close' {...sheet.handle} />
      {children(sheet.close, sheet.closing)}
    </Dialog>
  );
}
