import { ArrowRight, ExternalLink, LogOut, Mic2, Music2, Sparkles, Users, Wallet } from 'lucide-react';

import { ProductionReadinessPanel, type ProductionReadinessPanelProps } from '../components/ProductionReadinessPanel';
import type { WalletState } from '../hooks/useWallet';
import { getBlockscoutAddressUrl } from '../shared/utils/explorer';
import { formatWeiAsDot, shortenAddress } from '../shared/utils/format';

type AccountSupportedArtist = { artist: string; artistAddress?: `0x${string}`; trackCount: number };
type AccountUnlockedTrack = { id: string; title: string; artist: string };

type YouViewProps = {
  walletState: WalletState;
  artistName: string;
  artistRuntimeAddress: `0x${string}` | null;
  artistReleaseCount: number;
  totalRoyaltyWei: bigint;
  unlockedTrackCount: number;
  supportedArtistCount: number;
  supportedArtists: AccountSupportedArtist[];
  nativePaymentSymbol: string;
  unlockedTracks: AccountUnlockedTrack[];
  productionReadiness: ProductionReadinessPanelProps | null;
  onOpenArtistStudio: () => void;
  onShowWalletModal: () => void;
  onDisconnectWallet: () => void;
};

export function YouView({
  walletState,
  artistName,
  artistRuntimeAddress,
  artistReleaseCount,
  totalRoyaltyWei,
  unlockedTrackCount,
  supportedArtistCount,
  supportedArtists,
  nativePaymentSymbol,
  unlockedTracks,
  productionReadiness,
  onOpenArtistStudio,
  onShowWalletModal,
  onDisconnectWallet
}: YouViewProps) {
  const wallet = walletState.status === 'connected' ? walletState.wallet : null;
  const isConnected = wallet !== null;
  const identityAddress = wallet?.substrateAddress ?? wallet?.evmAddress ?? '';
  const isArtist = Boolean(artistRuntimeAddress);
  const earnedDot = formatWeiAsDot(totalRoyaltyWei);

  return (
    <section className='you-view' aria-labelledby='you-view-title'>
      <header className='you-hero'>
        <h2 id='you-view-title'>Your music.</h2>
        <p>Your collection and the artists you support.</p>
      </header>

      <div className='you-layout'>
        {!isConnected ? (
          <section className='you-panel you-invitation' aria-label='Your collection'>
            <Music2 size={28} aria-hidden='true' />
            <h3>Your collection</h3>
            <p>Connect to find your supported tracks.</p>
            <button className='primary-action' type='button' onClick={onShowWalletModal}>
              Connect a wallet
            </button>
          </section>
        ) : (
          <section className='you-panel account-dashboard' aria-labelledby='account-dashboard-title'>
            <div className='account-dashboard-head'>
              <span className='you-panel-icon'>
                <Music2 size={18} />
              </span>
              <div>
                <h3 id='account-dashboard-title'>Your support</h3>
                <p>Listening access is checked when you open a track.</p>
              </div>
              {(unlockedTrackCount > 0 || supportedArtistCount > 0) && (
                <div className='account-summary' aria-label='Music summary'>
                  <span>
                    <strong className='tnum'>{unlockedTrackCount}</strong>
                    supported tracks
                  </span>
                  <span>
                    <strong className='tnum'>{supportedArtistCount}</strong>
                    artists supported
                  </span>
                </div>
              )}
            </div>

            <div className='account-detail-grid'>
              <section className='account-detail-section' id='account-unlocked-tracks' tabIndex={-1} aria-labelledby='account-unlocked-title'>
                <div className='account-detail-title'>
                  <Music2 size={16} />
                  <h4 id='account-unlocked-title'>Supported tracks</h4>
                </div>
                {unlockedTracks.length > 0 ? (
                  <div className='account-detail-list'>
                    {unlockedTracks.map(track => (
                      <div className='account-detail-row' key={track.id}>
                        <span>
                          <strong>{track.title}</strong>
                          <small>{track.artist}</small>
                        </span>
                        <span className='support-record-label'>Payment recorded</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className='account-empty'>Tracks you support will appear here after payment is verified.</p>
                )}
              </section>

              <section className='account-detail-section' id='account-artists-backed' tabIndex={-1} aria-labelledby='account-artists-title'>
                <div className='account-detail-title'>
                  <Users size={16} />
                  <h4 id='account-artists-title'>Artists supported</h4>
                </div>
                {supportedArtists.length > 0 ? (
                  <div className='account-detail-list'>
                    {supportedArtists.map(artist => (
                      <div className='account-detail-row' key={artist.artistAddress ?? artist.artist}>
                        <span>
                          <strong>{artist.artist}</strong>
                          <small>
                            {artist.trackCount} paid track{artist.trackCount === 1 ? '' : 's'}
                          </small>
                        </span>
                        {artist.artistAddress && (
                          <a
                            className='icon-link'
                            href={getBlockscoutAddressUrl(artist.artistAddress)}
                            target='_blank'
                            rel='noreferrer'
                            aria-label={`Open ${artist.artist} on Blockscout`}
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className='account-empty'>Artists you choose to support will appear here.</p>
                )}
              </section>
            </div>
          </section>
        )}

        <aside className='you-side' aria-label='Your artist and confirmation spaces'>
          {isArtist ? (
            <button className='you-panel artist-studio-card' type='button' onClick={onOpenArtistStudio} aria-label={`Open ${artistName} Studio`}>
              <div className='you-panel-head'>
                <span className='you-panel-icon lime'>
                  <Mic2 size={18} />
                </span>
                <div>
                  <strong>{artistName}</strong>
                  <span>Your artist space</span>
                </div>
                <ArrowRight className='you-card-arrow' size={18} />
              </div>
              <div className='you-stats'>
                <div>
                  <strong className='tnum'>{artistReleaseCount}</strong>
                  <span>releases</span>
                </div>
                <div>
                  <strong className='tnum'>{earnedDot}</strong>
                  <span>{nativePaymentSymbol} received</span>
                </div>
              </div>
              <code className='you-address'>{shortenAddress(artistRuntimeAddress!)}</code>
              <span className='you-studio-cta'>
                Open Studio
                <ArrowRight size={15} />
              </span>
            </button>
          ) : (
            <button className='you-panel artist-setup-card' type='button' onClick={onOpenArtistStudio} aria-label='Set up your artist space'>
              <div className='you-panel-head'>
                <span className='you-panel-icon lime'>
                  <Sparkles size={18} />
                </span>
                <div>
                  <strong>Artist space</strong>
                  <span>Share your music</span>
                </div>
                <ArrowRight className='you-card-arrow' size={18} />
              </div>
              <p className='you-muted'>Publish a release and receive support.</p>
              <span className='you-studio-cta'>
                Open artist studio
                <ArrowRight size={15} />
              </span>
            </button>
          )}

          {isConnected && (
            <section className='you-panel wallet-pass-panel' aria-label='Connected wallet'>
              <div className='you-panel-head'>
                <span className='you-panel-icon'>
                  <Wallet size={18} />
                </span>
                <div>
                  <strong>{wallet.label}</strong>
                  <span>Connected</span>
                </div>
              </div>

              <code className='you-address'>{shortenAddress(identityAddress)}</code>

              <div className='you-actions'>
                <button className='primary-action compact-action' type='button' onClick={onShowWalletModal}>
                  <Wallet size={16} />
                  Manage
                </button>
                <button className='secondary-action compact-action' type='button' onClick={onDisconnectWallet}>
                  <LogOut size={16} />
                  Disconnect
                </button>
              </div>
            </section>
          )}

          {productionReadiness && <ProductionReadinessPanel {...productionReadiness} />}
        </aside>
      </div>
    </section>
  );
}
