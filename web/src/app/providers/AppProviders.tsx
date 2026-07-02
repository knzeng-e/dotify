// App providers - the composition root for the frontend context stack. Order
// matters and mirrors the hook dependency order in App.tsx: UI feedback sits at
// the top so lower providers can raise transaction/wallet-modal state, then the
// wallet identity everything else reads from, then navigation (route/view state
// and history), then the release-form draft that catalog + artist console share.
// Later steps (8b-4..8b-5) add the catalog, session, artist-studio, and playback
// providers inside this stack.

import type { ReactNode } from 'react';
import { UiFeedbackProvider } from './UiFeedbackProvider';
import { WalletProvider } from './WalletProvider';
import { NavigationProvider } from './NavigationProvider';
import { ReleaseFormProvider } from './ReleaseFormProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <UiFeedbackProvider>
      <WalletProvider>
        <NavigationProvider>
          <ReleaseFormProvider>{children}</ReleaseFormProvider>
        </NavigationProvider>
      </WalletProvider>
    </UiFeedbackProvider>
  );
}
