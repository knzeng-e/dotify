// Artist portal shell - the /artists screen chrome (topbar + layout + modal
// slots). The artist content (ArtistConsole / ArtistOnboarding) and the wallet /
// transaction modals are passed in as nodes, so the large prop lists stay in
// App.tsx where the state lives; only the layout moved out of the monolith.

import type { ReactNode } from 'react';
import { AuraBackground } from '../components/AuraBackground';
import { TopBar } from '../components/TopBar';

type ArtistPortalViewProps = {
  walletModal: ReactNode;
  transactionModal: ReactNode;
  children: ReactNode;
};

export function ArtistPortalView({ walletModal, transactionModal, children }: ArtistPortalViewProps) {
  return (
    <>
      <AuraBackground />
      <div className='app-shell artist-portal-shell'>
        <TopBar className='artist-portal-topbar' brandHref='/' brandAriaLabel='Dotify home' navAriaLabel='Artist portal actions'>
          <a className='artist-entry-link' href='/'>
            Listener app
          </a>
        </TopBar>

        {walletModal}

        <main className='artist-portal-main'>{children}</main>

        {transactionModal}
      </div>
    </>
  );
}
