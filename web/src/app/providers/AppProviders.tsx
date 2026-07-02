// App providers - the composition root for the frontend context stack. Order
// matters and mirrors the hook dependency order in App.tsx: UI feedback sits at
// the top so lower providers can raise transaction/wallet-modal state, then the
// wallet identity everything else reads from, then navigation (route/view state
// and history). Later steps (8b-3..8b-5) add the release-form, catalog, session,
// artist-studio, and playback providers inside this stack.

import type { ReactNode } from 'react';
import { UiFeedbackProvider } from './UiFeedbackProvider';
import { WalletProvider } from './WalletProvider';
import { NavigationProvider } from './NavigationProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <UiFeedbackProvider>
      <WalletProvider>
        <NavigationProvider>{children}</NavigationProvider>
      </WalletProvider>
    </UiFeedbackProvider>
  );
}
