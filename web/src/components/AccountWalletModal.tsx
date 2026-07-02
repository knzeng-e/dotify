// Account wallet modal - wires the presentational WalletModal to context so both
// shells (listener + artist portal) render it the same way without rebuilding the
// support summary and the account-details nav jump. WalletModal itself stays
// presentational; this is the context adapter.

import { WalletModal } from './WalletModal';
import { useCatalogContext, useNavigation, useUiFeedback } from '../app/providers';
import { deriveSupportSummary } from '../features/wallet/supportSummary';

export function AccountWalletModal() {
  const catalog = useCatalogContext();
  const { navigateToView } = useNavigation();
  const { setShowWalletModal } = useUiFeedback();
  const { paidTracks, supportedArtists } = deriveSupportSummary(catalog.catalogTracks, catalog.catalogPaidAccessByTrackId);

  return (
    <WalletModal
      supportingCount={supportedArtists.length}
      unlockedCount={paidTracks.length}
      supportedArtists={supportedArtists}
      paidTracks={paidTracks.map(track => ({
        id: track.id,
        title: track.title,
        artist: track.artist,
        artistAddress: track.artistAddress,
        priceDot: track.priceDot,
        hash: track.hash
      }))}
      onOpenAccountDetails={() => {
        setShowWalletModal(false);
        navigateToView('you');
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            document.getElementById('account-dashboard-title')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
          });
        });
      }}
    />
  );
}
