// Top bar - the shared app header (Dotify brand + wallet status pill), used by
// both the listener shell and the artist portal. Extracted from the two nearly
// identical inline headers; callers vary the brand link, labels, and any extra
// nav content (e.g. the artist portal's "Listener app" link) via props.

import { Disc3 } from 'lucide-react';
import type { ReactNode } from 'react';
import { WalletStatusPill } from './WalletModal';
import type { WalletState } from '../hooks/useWallet';

type TopBarProps = {
  className?: string;
  brandHref: string;
  brandAriaLabel: string;
  onBrandClick?: () => void;
  navAriaLabel: string;
  walletState: WalletState;
  onShowWallet: () => void;
  onDisconnect: () => void;
  /** Extra nav-pills content rendered before the wallet pill. */
  children?: ReactNode;
};

export function TopBar({ className, brandHref, brandAriaLabel, onBrandClick, navAriaLabel, walletState, onShowWallet, onDisconnect, children }: TopBarProps) {
  return (
    <header className={className ? `topbar ${className}` : 'topbar'}>
      <a className='brand' href={brandHref} aria-label={brandAriaLabel} onClick={onBrandClick}>
        <span className='brand-mark'>
          <Disc3 size={21} />
        </span>
        <span>Dotify</span>
      </a>
      <nav className='nav-pills' aria-label={navAriaLabel}>
        {children}
        <WalletStatusPill state={walletState} onClick={onShowWallet} onDisconnect={onDisconnect} />
      </nav>
    </header>
  );
}
