import { ArrowRight, KeyRound, Mic2, Power, ShieldCheck, Sparkles, UserRound, Wallet } from 'lucide-react';
import { formatWeiAsDot } from '../utils/format';
import type { WalletState } from '../hooks/useWallet';

type YouViewProps = {
  walletState: WalletState;
  artistName: string;
  artistRuntimeAddress: `0x${string}` | null;
  artistReleaseCount: number;
  totalRoyaltyWei: bigint;
  unlockedTrackCount: number;
  supportedArtistCount: number;
  onShowWalletModal: () => void;
  onDisconnectWallet: () => void;
};

function shortenAddress(address: string) {
  return address.length > 16 ? `${address.slice(0, 8)}...${address.slice(-6)}` : address;
}

export function YouView({
  walletState,
  artistName,
  artistRuntimeAddress,
  artistReleaseCount,
  totalRoyaltyWei,
  unlockedTrackCount,
  supportedArtistCount,
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
      <div className='you-hero'>
        <p className='eyebrow'>You</p>
        <h2 id='you-view-title'>Your door pass.</h2>
        <p>What you have unlocked, the artists you back, and your own artist space - all tied to your wallet.</p>
      </div>

      <div className='you-grid'>
        <section className='you-panel wallet-pass-panel' aria-label='Wallet'>
          <div className='you-panel-head'>
            <span className='you-panel-icon'>
              <Wallet size={18} />
            </span>
            <div>
              <strong>{wallet ? wallet.label : 'No wallet connected'}</strong>
              <span>{isConnected ? 'Ready for access checks' : 'Connect only when a door needs it'}</span>
            </div>
          </div>

          {isConnected ? (
            <>
              <code className='you-address'>{shortenAddress(identityAddress)}</code>
              <div className='you-stats'>
                <div>
                  <strong className='tnum'>{unlockedTrackCount}</strong>
                  <span>tracks unlocked</span>
                </div>
                <div>
                  <strong className='tnum'>{supportedArtistCount}</strong>
                  <span>artists backed</span>
                </div>
              </div>
            </>
          ) : (
            <p className='you-muted'>Listen to rooms through shared links without an account. Unlocking a protected release asks for your wallet.</p>
          )}

          <div className='you-actions'>
            <button className='primary-action compact-action' type='button' onClick={onShowWalletModal}>
              <KeyRound size={16} />
              {isConnected ? 'Manage wallet' : 'Connect wallet'}
            </button>
            {isConnected && (
              <button className='secondary-action compact-action' type='button' onClick={onDisconnectWallet}>
                <Power size={16} />
                Disconnect
              </button>
            )}
          </div>
        </section>

        {isArtist ? (
          <a className='you-panel artist-studio-card' href='/artists' aria-label={`Open ${artistName} Studio`}>
            <div className='you-panel-head'>
              <span className='you-panel-icon lime'>
                <Mic2 size={18} />
              </span>
              <div>
                <strong>{artistName}</strong>
                <span>Your Artist Studio</span>
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
                <span>DOT earned</span>
              </div>
            </div>
            <code className='you-address'>{shortenAddress(artistRuntimeAddress!)}</code>
            <span className='you-studio-cta'>
              Open Studio
              <ArrowRight size={15} />
            </span>
          </a>
        ) : (
          <a className='you-panel artist-setup-card' href='/artists' aria-label='Set up your artist space'>
            <div className='you-panel-head'>
              <span className='you-panel-icon lime'>
                <Sparkles size={18} />
              </span>
              <div>
                <strong>Become an artist</strong>
                <span>{isConnected ? 'Ready to set up' : 'Set up your space'}</span>
              </div>
              <ArrowRight className='you-card-arrow' size={18} />
            </div>
            <p className='you-muted'>Publish your music, host listening rooms, and get paid directly. Setting up your artist space takes a minute.</p>
            <span className='you-studio-cta'>
              Set up artist space
              <ArrowRight size={15} />
            </span>
          </a>
        )}

        <section className='you-panel policy-panel' aria-label='How access works'>
          <div className='you-policy-item'>
            <UserRound size={17} />
            <span>Guests join rooms as people, not accounts.</span>
          </div>
          <div className='you-policy-item'>
            <ShieldCheck size={17} />
            <span>Protected tracks stay with the host who holds access.</span>
          </div>
        </section>
      </div>
    </section>
  );
}
