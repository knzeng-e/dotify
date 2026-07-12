// Top bar - the shared app header (Dotify brand + wallet status pill), used by
// both the listener shell and the artist portal. Extracted from the two nearly
// identical inline headers; callers vary the brand link, labels, and any extra
// nav content (e.g. the artist portal's "Listener app" link) via props. Wallet
// status and the connect/disconnect actions come from context, so no caller
// threads wallet state through this component.

import type { ReactNode } from 'react';
import { WalletStatusPill } from './WalletModal';
import { useWalletContext } from '../app/providers/WalletProvider';
import { useUiFeedback } from '../app/providers/UiFeedbackProvider';

type TopBarProps = {
  className?: string;
  brandHref: string;
  brandAriaLabel: string;
  onBrandClick?: () => void;
  navAriaLabel: string;
  /** Extra nav-pills content rendered before the wallet pill. */
  children?: ReactNode;
};

export function TopBar({ className, brandHref, brandAriaLabel, onBrandClick, navAriaLabel, children }: TopBarProps) {
  const { walletState, disconnect } = useWalletContext();
  const { setShowWalletModal } = useUiFeedback();

  return (
    <header className={className ? `topbar ${className}` : 'topbar'}>
      <div className='topbar-inner'>
        <a className='brand' href={brandHref} aria-label={brandAriaLabel} onClick={onBrandClick}>
          <span className='brand-mark' aria-hidden='true'>
            <i />
            <i />
            <i />
          </span>
          <span>Dotify</span>
        </a>
        <nav className='nav-pills' aria-label={navAriaLabel}>
          {children}
          <WalletStatusPill state={walletState} onClick={() => setShowWalletModal(true)} onDisconnect={disconnect} />
        </nav>
      </div>
    </header>
  );
}
