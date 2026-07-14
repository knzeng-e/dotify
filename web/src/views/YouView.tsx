import { ArrowRight, ExternalLink, KeyRound, Mic2, Music2, Power, Sparkles, Users, Wallet } from 'lucide-react';

import type { WalletState } from '../hooks/useWallet';
import { getBlockscoutAddressUrl } from '../shared/utils/explorer';
import { formatWeiAsDot, shortenAddress } from '../shared/utils/format';

type AccountSupportedArtist = { artist: string; artistAddress?: `0x${string}`; trackCount: number };
type AccountUnlockedTrack = { id: string; title: string; artist: string; priceDot: string; hash: `0x${string}` };

type YouViewProps = {
  walletState: WalletState;
  artistName: string;
  artistRuntimeAddress: `0x${string}` | null;
  artistReleaseCount: number;
  totalRoyaltyWei: bigint;
  unlockedTrackCount: number;
  supportedArtistCount: number;
  supportedArtists: AccountSupportedArtist[];
  unlockedTracks: AccountUnlockedTrack[];
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
  unlockedTracks,
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
        <p className='eyebrow'>Your private space</p>
        <h2 id='you-view-title'>Your music.</h2>
        <p>Keep opened tracks, supported artists, and your artist space close.</p>
      </header>

      <div className='you-layout'>
        <section className='you-panel account-dashboard' aria-labelledby='account-dashboard-title'>
          <div className='account-dashboard-head'>
            <span className='you-panel-icon'>
              <Music2 size={18} />
            </span>
            <div>
              <h3 id='account-dashboard-title'>Your music</h3>
              <p>Only support and access that Dotify can show for this wallet appears here.</p>
            </div>
            <div className='account-summary' aria-label='Music summary'>
              <span>
                <strong className='tnum'>{unlockedTrackCount}</strong>
                tracks opened
              </span>
              <span>
                <strong className='tnum'>{supportedArtistCount}</strong>
                artists supported
              </span>
            </div>
          </div>

          <div className='account-detail-grid'>
            <section className='account-detail-section' id='account-unlocked-tracks' tabIndex={-1} aria-labelledby='account-unlocked-title'>
              <div className='account-detail-title'>
                <Music2 size={16} />
                <h4 id='account-unlocked-title'>Tracks opened</h4>
              </div>
              {unlockedTracks.length > 0 ? (
                <div className='account-detail-list'>
                  {unlockedTracks.map(track => (
                    <div className='account-detail-row' key={track.id}>
                      <span>
                        <strong>{track.title}</strong>
                        <small>
                          {track.artist} / {track.priceDot} DOT
                        </small>
                      </span>
                      <code>{shortenAddress(track.hash)}</code>
                    </div>
                  ))}
                </div>
              ) : (
                <p className='account-empty'>Tracks you support and open will appear here.</p>
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
                          {artist.trackCount} opened track{artist.trackCount === 1 ? '' : 's'}
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
                  <span>DOT received</span>
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
                  <span>{isConnected ? 'Ready to set up' : 'Available when useful'}</span>
                </div>
                <ArrowRight className='you-card-arrow' size={18} />
              </div>
              <p className='you-muted'>Publish tracks, host rooms, and receive direct support.</p>
              <span className='you-studio-cta'>
                Explore the artist space
                <ArrowRight size={15} />
              </span>
            </button>
          )}

          <section className='you-panel wallet-pass-panel' aria-label='Confirmation method'>
            <div className='you-panel-head'>
              <span className='you-panel-icon'>
                <Wallet size={18} />
              </span>
              <div>
                <strong>{wallet ? wallet.label : 'No wallet connected'}</strong>
                <span>{isConnected ? 'Ready for protected actions' : 'Connect for support or protected access'}</span>
              </div>
            </div>

            {isConnected ? (
              <code className='you-address'>{shortenAddress(identityAddress)}</code>
            ) : (
              <p className='you-muted'>Connect to support an artist or open protected access.</p>
            )}

            <div className='you-actions'>
              <button className='primary-action compact-action' type='button' onClick={onShowWalletModal}>
                <KeyRound size={16} />
                {isConnected ? 'Manage' : 'Choose a method'}
              </button>
              {isConnected && (
                <button className='secondary-action compact-action' type='button' onClick={onDisconnectWallet}>
                  <Power size={16} />
                  Disconnect
                </button>
              )}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
