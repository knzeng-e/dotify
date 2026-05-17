import { BadgeCheck, Disc3, LockKeyhole, RefreshCw, Upload } from 'lucide-react';
import { PanelTitle } from '../../components/ui/PanelTitle';
import { EndpointRow } from '../../components/ui/EndpointRow';
import { Metric } from '../../components/ui/Metric';
import { shorten } from '../../utils/format';
import type { CatalogTrack } from '../../types';

const blockscoutBaseUrl = 'https://blockscout-testnet.polkadot.io';

function getBlockscoutAddressUrl(address: `0x${string}`) {
  return `${blockscoutBaseUrl}/address/${address}`;
}

type OverviewTabProps = {
  artistName: string;
  activeEvmAddress: `0x${string}`;
  artistRuntimeAddress: `0x${string}` | null;
  artistRegistrationStatus: string;
  isRegisteringArtist: boolean;
  isRefreshingArtistRuntime: boolean;
  artistRegistrationAvailable: boolean;
  artistSetupState: string;
  artistTracks: CatalogTrack[];
  connectedWallet: { label: string } | null;
  onUpdateArtistName: (name: string) => void;
  onRegisterArtist: () => void;
  onRefreshArtistRuntime: () => void;
  onSetArtistTab: (tab: 'overview' | 'new' | 'releases' | 'royalties' | 'advanced') => void;
  onShowWalletModal: () => void;
};

export function OverviewTab({
  artistName,
  activeEvmAddress,
  artistRuntimeAddress,
  artistRegistrationStatus,
  isRegisteringArtist,
  isRefreshingArtistRuntime,
  artistRegistrationAvailable,
  artistSetupState,
  artistTracks,
  connectedWallet,
  onUpdateArtistName,
  onRegisterArtist,
  onRefreshArtistRuntime,
  onSetArtistTab,
  onShowWalletModal
}: OverviewTabProps) {
  return (
    <section className='content-grid artist-overview-grid'>
      <div className='doc-panel studio-panel'>
        <PanelTitle icon={LockKeyhole} title='Artist profile' meta={artistSetupState.toLowerCase()} />

        <div className='fields-grid'>
          <label>
            <span>Artist name</span>
            <input className='field' value={artistName} onChange={event => onUpdateArtistName(event.target.value)} />
          </label>
          <label>
            <span>Wallet</span>
            <div className='field wallet-field'>
              <LockKeyhole size={14} />
              {connectedWallet?.label ?? 'Connect wallet'}
            </div>
          </label>
        </div>

        <div className='stack-list'>
          <EndpointRow
            label='Rights wallet'
            value={
              <a className='verify-link' href={getBlockscoutAddressUrl(activeEvmAddress)} target='_blank' rel='noreferrer'>
                {shorten(activeEvmAddress, 12)}
              </a>
            }
          />
          <EndpointRow
            label='Artist profile'
            value={
              artistRuntimeAddress ? (
                <div className='endpoint-link-stack'>
                  <a className='verify-link' href={getBlockscoutAddressUrl(artistRuntimeAddress)} target='_blank' rel='noreferrer'>
                    {shorten(artistRuntimeAddress, 12)}
                  </a>
                  <small>Ready to publish</small>
                </div>
              ) : (
                'not created'
              )
            }
          />
        </div>

        <p className='rights-status'>{artistRegistrationStatus}</p>

        <button
          className='primary-action wide'
          type='button'
          onClick={onRegisterArtist}
          disabled={isRegisteringArtist || !artistRegistrationAvailable || Boolean(artistRuntimeAddress)}
        >
          {isRegisteringArtist ? <Disc3 size={16} className='spin' /> : <BadgeCheck size={16} />}
          {isRegisteringArtist ? 'Creating profile…' : artistRuntimeAddress ? 'Artist profile ready' : 'Create artist profile'}
        </button>

        <button
          className='secondary-action'
          type='button'
          onClick={onRefreshArtistRuntime}
          disabled={isRefreshingArtistRuntime || !artistRegistrationAvailable}
        >
          {isRefreshingArtistRuntime ? <Disc3 size={16} className='spin' /> : <RefreshCw size={16} />}
          {isRefreshingArtistRuntime ? 'Refreshing…' : 'Refresh status'}
        </button>
      </div>

      <div className='doc-panel next-action-panel'>
        <PanelTitle icon={BadgeCheck} title='Next action' meta={artistSetupState} />
        <div className='next-action-copy'>
          <strong>
            {!connectedWallet
              ? 'Use a wallet to make this profile yours.'
              : artistRuntimeAddress
                ? 'Your artist profile is yours to publish from.'
                : 'Create your artist-owned profile before publishing.'}
          </strong>
          <p>
            {!connectedWallet
              ? 'No password, no platform login. Your wallet becomes the address that owns your catalog and receives payments.'
              : artistRuntimeAddress
                ? 'Start a new release, choose the access culture around it, then publish it to your own runtime.'
                : 'Dotify creates one artist profile per wallet. Releases, rights, and payments stay attached to that address.'}
          </p>
        </div>
        {!connectedWallet ? (
          <button className='primary-action wide' type='button' onClick={onShowWalletModal}>
            <LockKeyhole size={16} />
            Use my wallet
          </button>
        ) : artistRuntimeAddress ? (
          <button className='primary-action wide' type='button' onClick={() => onSetArtistTab('new')}>
            <Upload size={16} />
            Publish a release
          </button>
        ) : (
          <button
            className='primary-action wide'
            type='button'
            onClick={onRegisterArtist}
            disabled={isRegisteringArtist || !artistRegistrationAvailable}
          >
            {isRegisteringArtist ? <Disc3 size={16} className='spin' /> : <BadgeCheck size={16} />}
            Create artist profile
          </button>
        )}
        <div className='artist-summary-grid'>
          <Metric label='releases' value={artistTracks.length.toString()} />
          <Metric label='profile' value={artistRuntimeAddress ? 'ready' : 'pending'} />
        </div>
      </div>
    </section>
  );
}
