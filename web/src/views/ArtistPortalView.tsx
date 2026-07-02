// Artist portal shell - the /artists screen chrome (topbar + layout + modal
// slots). The artist content (ArtistConsole / ArtistOnboarding) and the wallet /
// transaction modals are passed in as nodes, so the large prop lists stay in
// App.tsx where the state lives; only the layout moved out of the monolith.

import { Disc3 } from 'lucide-react';
import type { ReactNode } from 'react';
import { AuraBackground } from '../components/AuraBackground';
import { WalletStatusPill } from '../components/WalletModal';
import type { WalletState } from '../hooks/useWallet';

type ArtistPortalViewProps = {
  walletState: WalletState;
  onShowWallet: () => void;
  onDisconnect: () => void;
  walletModal: ReactNode;
  transactionModal: ReactNode;
  children: ReactNode;
};

export function ArtistPortalView({ walletState, onShowWallet, onDisconnect, walletModal, transactionModal, children }: ArtistPortalViewProps) {
  return (
    <>
      <AuraBackground />
      <div className='app-shell artist-portal-shell'>
        <header className='topbar artist-portal-topbar'>
          <a className='brand' href='/' aria-label='Dotify home'>
            <span className='brand-mark'>
              <Disc3 size={21} />
            </span>
            <span>Dotify</span>
          </a>
          <nav className='nav-pills' aria-label='Artist portal actions'>
            <a className='artist-entry-link' href='/'>
              Listener app
            </a>
            <WalletStatusPill state={walletState} onClick={onShowWallet} onDisconnect={onDisconnect} />
          </nav>
        </header>

        {walletModal}

        <main className='artist-portal-main'>{children}</main>

        {transactionModal}
      </div>
    </>
  );
}
