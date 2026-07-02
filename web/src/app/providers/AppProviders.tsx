// App providers - the composition root for the frontend context stack. Order
// matters and mirrors the hook dependency order in App.tsx: UI feedback sits at
// the top so lower providers can raise transaction/wallet-modal state, then the
// wallet identity everything else reads from, then navigation (route/view state
// and history), then the release-form draft that catalog + artist console share,
// then the catalog (on-chain tracks + access) and the session (WebRTC rooms) that
// streams it. Later steps (8b-5) add the artist-studio and playback providers.

import type { ReactNode } from 'react';
import { UiFeedbackProvider } from './UiFeedbackProvider';
import { WalletProvider } from './WalletProvider';
import { NavigationProvider } from './NavigationProvider';
import { ReleaseFormProvider } from './ReleaseFormProvider';
import { CatalogProvider } from './CatalogProvider';
import { SessionProvider } from './SessionProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <UiFeedbackProvider>
      <WalletProvider>
        <NavigationProvider>
          <ReleaseFormProvider>
            <CatalogProvider>
              <SessionProvider>{children}</SessionProvider>
            </CatalogProvider>
          </ReleaseFormProvider>
        </NavigationProvider>
      </WalletProvider>
    </UiFeedbackProvider>
  );
}
