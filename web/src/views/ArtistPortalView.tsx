// Artist portal shell - the /artists screen chrome (topbar + layout + modals).
// The artist content (ArtistConsole / ArtistOnboarding) is passed in as children;
// the wallet + transaction modals are self-contained (context-driven), so they
// render here directly rather than being threaded down from App.

import type { ReactNode } from 'react';
import { TopBar } from '../components/TopBar';
import { AccountWalletModal } from '../components/AccountWalletModal';
import { TransactionModal } from '../components/TransactionModal';

export function ArtistPortalView({ children }: { children: ReactNode }) {
  return (
    <>
      <div className='app-shell artist-portal-shell'>
        <a className='skip-link' href='#artist-main'>
          Skip to studio
        </a>
        <TopBar className='artist-portal-topbar' brandHref='/' brandAriaLabel='Dotify home' navAriaLabel='Artist portal actions'>
          <a className='artist-entry-link' href='/'>
            Listener app
          </a>
        </TopBar>

        <AccountWalletModal />

        <main className='artist-portal-main' id='artist-main'>
          {children}
        </main>

        <TransactionModal />
      </div>
    </>
  );
}
