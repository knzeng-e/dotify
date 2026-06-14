import { ExternalLink, KeyRound, LockKeyhole, Music2, Power, RefreshCw, Users, Wallet, X } from 'lucide-react';
import type { WalletState } from '../hooks/useWallet';
import type { CatalogTrack } from '../types';
import { getBlockscoutAddressUrl } from '../utils/explorer';

function shortenAddress(address: string) {
  return address.length > 14 ? `${address.slice(0, 8)}...${address.slice(-6)}` : address;
}

type WalletSupportedArtist = Pick<CatalogTrack, 'artist' | 'artistAddress'> & { trackCount: number };
type WalletPaidTrack = Pick<CatalogTrack, 'id' | 'title' | 'artist' | 'artistAddress' | 'priceDot' | 'hash'>;

export function WalletStatusPill({ state, onClick, onDisconnect }: { state: WalletState; onClick: () => void; onDisconnect: () => void }) {
  if (state.status === 'connected') {
    return (
      <div className='status-pill wallet-pill' data-tone='green'>
        <button className='wallet-pill-open' type='button' onClick={onClick}>
          <LockKeyhole size={14} />
          <span>{state.wallet.label}</span>
        </button>
        <button className='wallet-pill-disconnect' type='button' onClick={onDisconnect} aria-label='Disconnect wallet' title='Disconnect'>
          x
        </button>
      </div>
    );
  }
  return (
    <button type='button' className='status-pill wallet-pill' data-tone='muted' onClick={onClick}>
      <Power size={14} />
      <span>{state.status === 'connecting' ? 'Connecting…' : state.status === 'needs-reconnect' ? 'Reconnect' : 'Connect'}</span>
    </button>
  );
}

export function WalletModal({
  state,
  hasPrfSupport,
  hasStoredPasskey,
  supportingCount = 0,
  unlockedCount = 0,
  supportedArtists = [],
  paidTracks = [],
  expectedChainId = null,
  isSwitchingNetwork = false,
  onPasskey,
  onExtension,
  onSwitchNetwork,
  onForgetPasskey,
  onDisconnect,
  onClose
}: {
  state: WalletState;
  hasPrfSupport: boolean;
  hasStoredPasskey: boolean;
  supportingCount?: number;
  unlockedCount?: number;
  supportedArtists?: WalletSupportedArtist[];
  paidTracks?: WalletPaidTrack[];
  expectedChainId?: number | null;
  isSwitchingNetwork?: boolean;
  onPasskey: () => void;
  onExtension: () => void;
  onSwitchNetwork?: () => void;
  onForgetPasskey: () => void;
  onDisconnect?: () => void;
  onClose: () => void;
}) {
  if (state.status === 'connected') {
    const { wallet } = state;
    const identityAddress = wallet.substrateAddress ?? wallet.evmAddress;
    const walletChainMismatch = expectedChainId !== null && wallet.chainId !== undefined && wallet.chainId !== expectedChainId;
    return (
      <div className='modal-backdrop' role='presentation' onClick={onClose}>
        <div className='modal-card wallet-modal' role='dialog' aria-modal='true' aria-labelledby='wallet-modal-title' onClick={e => e.stopPropagation()}>
          <div className='modal-header'>
            <div className='modal-icon' data-tone='success'>
              <LockKeyhole size={20} />
            </div>
            <button className='modal-close' type='button' onClick={onClose} aria-label='Close'>
              <X size={16} />
            </button>
          </div>
          <div className='modal-copy'>
            <p className='modal-eyebrow'>Your wallet</p>
            <h2 id='wallet-modal-title'>Connected, on your terms</h2>
          </div>

          <div className='wallet-identity'>
            <span className='wallet-identity-orb' aria-hidden='true' />
            <div>
              <strong>{wallet.label}</strong>
              <small className='tnum'>
                {wallet.evmAddress ? (
                  <a className='verify-link' href={getBlockscoutAddressUrl(wallet.evmAddress)} target='_blank' rel='noreferrer'>
                    {shortenAddress(identityAddress)}
                  </a>
                ) : (
                  shortenAddress(identityAddress)
                )}
              </small>
            </div>
          </div>

          <div className='wallet-network' data-warning={walletChainMismatch}>
            <span>Network</span>
            <strong>{wallet.chainId !== undefined ? `Chain ${wallet.chainId}` : wallet.method === 'passkey' ? 'App RPC signer' : 'Unknown'}</strong>
            {expectedChainId !== null && <small>Expected chain {expectedChainId}</small>}
            {walletChainMismatch && wallet.method === 'extension' && onSwitchNetwork && (
              <button className='wallet-network-action' type='button' onClick={onSwitchNetwork} disabled={isSwitchingNetwork}>
                <RefreshCw size={14} className={isSwitchingNetwork ? 'spin' : undefined} />
                {isSwitchingNetwork ? 'Switching...' : 'Switch network'}
              </button>
            )}
          </div>

          <div className='wallet-stats'>
            <div>
              <strong className='tnum'>{supportingCount}</strong>
              <span>artist{supportingCount === 1 ? '' : 's'} supported</span>
            </div>
            <div>
              <strong className='tnum'>{unlockedCount}</strong>
              <span>track{unlockedCount === 1 ? '' : 's'} unlocked</span>
            </div>
          </div>

          <div className='wallet-activity'>
            <section className='wallet-activity-section'>
              <h3>
                <Users size={15} />
                Artists supported
              </h3>
              {supportedArtists.length > 0 ? (
                <div className='wallet-activity-list'>
                  {supportedArtists.slice(0, 5).map(artist => (
                    <div className='wallet-activity-row' key={artist.artistAddress ?? artist.artist}>
                      <span>
                        <strong>{artist.artist}</strong>
                        <small>{artist.trackCount} paid track{artist.trackCount === 1 ? '' : 's'}</small>
                      </span>
                      {artist.artistAddress && (
                        <a className='icon-link' href={getBlockscoutAddressUrl(artist.artistAddress)} target='_blank' rel='noreferrer' aria-label={`Open ${artist.artist} wallet on explorer`}>
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className='wallet-empty'>No paid artist support detected for this wallet yet.</p>
              )}
            </section>

            <section className='wallet-activity-section'>
              <h3>
                <Music2 size={15} />
                Paid access
              </h3>
              {paidTracks.length > 0 ? (
                <div className='wallet-activity-list'>
                  {paidTracks.slice(0, 5).map(track => (
                    <div className='wallet-activity-row' key={track.id}>
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
                <p className='wallet-empty'>No Classic unlocks found in the indexed catalog.</p>
              )}
            </section>
          </div>

          <div className='wallet-selfcustody'>
            <span className='wallet-option-icon'>
              <KeyRound size={16} />
            </span>
            <span className='wallet-option-copy'>
              <strong>You hold your keys</strong>
              <small>Dotify never sees your seed. Payments and access proofs are signed by you, on your device.</small>
            </span>
          </div>

          {hasStoredPasskey && (
            <button
              className='wallet-forget'
              type='button'
              onClick={() => {
                onForgetPasskey();
              }}
            >
              Remove saved passkey
            </button>
          )}
          {onDisconnect && (
            <button
              className='secondary-action'
              type='button'
              onClick={() => {
                onDisconnect();
                onClose();
              }}
            >
              <Power size={16} />
              Disconnect
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className='modal-backdrop' role='presentation' onClick={onClose}>
      <div className='modal-card wallet-modal' role='dialog' aria-modal='true' aria-labelledby='wallet-modal-title' onClick={e => e.stopPropagation()}>
        <div className='modal-header'>
          <div className='modal-icon' data-tone='success'>
            <LockKeyhole size={20} />
          </div>
          <button className='modal-close' type='button' onClick={onClose} aria-label='Close'>
            <X size={16} />
          </button>
        </div>
        <div className='modal-copy'>
          <p className='modal-eyebrow'>Account</p>
          <h2 id='wallet-modal-title'>Your wallet, quietly</h2>
          <p>Use Dotify without creating a platform account. Your wallet proves access while your keys stay with you.</p>
        </div>

        {state.status === 'error' && <p className='error-box'>{state.message}</p>}
        {state.status === 'connecting' && (
          <p className='info-box'>{state.via === 'passkey' ? 'Check your browser prompt to continue.' : 'Check your wallet to approve the connection.'}</p>
        )}
        {state.status === 'needs-reconnect' && state.via === 'passkey' && (
          <p className='info-box'>Your saved passkey is ready. Use passkey to reconnect when you are ready.</p>
        )}

        <div className='wallet-options'>
          {hasPrfSupport && (
            <button className='wallet-option wallet-option-primary' type='button' onClick={onPasskey}>
              <span className='wallet-option-icon'>
                <KeyRound size={18} />
              </span>
              <span className='wallet-option-copy'>
                <strong>{state.status === 'needs-reconnect' && state.via === 'passkey' ? 'Reconnect passkey' : hasStoredPasskey ? 'Use passkey' : 'Create passkey'}</strong>
                <small>Use this device without a seed phrase prompt.</small>
              </span>
            </button>
          )}

          <button className='wallet-option' type='button' onClick={onExtension}>
            <span className='wallet-option-icon'>
              <Wallet size={18} />
            </span>
            <span className='wallet-option-copy'>
              <strong>Use wallet app</strong>
              <small>Bring your existing wallet when a signature is needed.</small>
            </span>
          </button>

          {hasStoredPasskey && (
            <button
              className='wallet-forget'
              type='button'
              onClick={() => {
                onForgetPasskey();
                onClose();
              }}
            >
              Remove saved passkey
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
