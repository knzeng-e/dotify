// App providers - the composition root for the frontend context stack. Order
// matters and mirrors the hook dependency order in App.tsx: UI feedback sits at
// the top so lower providers can raise transaction/wallet-modal state, then the
// wallet identity everything else reads from, then navigation (route/view state
// and history), then the release-form draft that catalog + artist console share,
// then the catalog (on-chain tracks + access) and the session (WebRTC rooms) that
// streams it, then the artist studio (runtime/rights/royalties) and the playback
// layer (media transport + open-track/preview handlers). With this stack in place
// App.tsx owns no hooks or business state - it composes providers and renders.

import type { ReactNode } from 'react';
import { UiFeedbackProvider } from './UiFeedbackProvider';
import { WalletProvider } from './WalletProvider';
import { NavigationProvider } from './NavigationProvider';
import { ReleaseFormProvider } from './ReleaseFormProvider';
import { CatalogProvider } from './CatalogProvider';
import { SessionProvider } from './SessionProvider';
import { ArtistStudioProvider } from './ArtistStudioProvider';
import { PlaybackProvider } from './PlaybackProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <UiFeedbackProvider>
      <WalletProvider>
        <NavigationProvider>
          <ReleaseFormProvider>
            <CatalogProvider>
              <SessionProvider>
                <ArtistStudioProvider>
                  <PlaybackProvider>{children}</PlaybackProvider>
                </ArtistStudioProvider>
              </SessionProvider>
            </CatalogProvider>
          </ReleaseFormProvider>
        </NavigationProvider>
      </WalletProvider>
    </UiFeedbackProvider>
  );
}
