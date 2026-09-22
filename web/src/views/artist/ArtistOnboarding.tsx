import { Disc3, ExternalLink, FileAudio, LockKeyhole, RefreshCw, Sparkles, UserRoundPlus, Wallet } from 'lucide-react';
import { useState } from 'react';
import { getBlockscoutAddressUrl } from '../../shared/utils/explorer';
import { shorten } from '../../shared/utils/format';
import { isTrackManagedByArtist } from '../../features/catalog/trackModel';
import { useReleaseForm, useWalletContext, useUiFeedback, useCatalogContext, useArtistStudio } from '../../app/providers';

// Self-contained via context, mirroring ArtistConsole.
export function ArtistOnboarding() {
  const { artistName, setArtistName } = useReleaseForm();
  const { connectedWallet, activeEvmAddress } = useWalletContext();
  const { openWalletModal } = useUiFeedback();
  const catalog = useCatalogContext();
  const { artistConsole } = useArtistStudio();

  const artistRegistrationStatus = artistConsole.artistRegistrationStatus;
  const isRegisteringArtist = artistConsole.isRegisteringArtist;
  const isRefreshingArtistRuntime = artistConsole.isRefreshingArtistRuntime;
  const artistRegistrationConfigured = artistConsole.artistRegistrationConfigured;
  const artistRegistrationAvailable = artistConsole.artistRegistrationAvailable;
  const artistPublicationQuarantined = artistConsole.artistPublicationQuarantined;
  const artistPublicationQuarantineReason = artistConsole.artistPublicationQuarantineReason;
  const artistTracks = connectedWallet ? catalog.allCatalogTracks.filter(track => isTrackManagedByArtist(track, activeEvmAddress, artistName)) : [];
  const onUpdateArtistName = (name: string) => artistConsole.updateArtistName(name, setArtistName);
  const onRegisterArtist = artistConsole.registerArtist;
  const onRefreshArtistRuntime = () => {
    void artistConsole.refreshArtistRuntime(true);
  };
  const onShowWalletModal = () => openWalletModal('artist');

  const [consented, setConsented] = useState(false);
  const needsWallet = !connectedWallet;
  const canRegister = Boolean(artistRegistrationAvailable && connectedWallet && artistName.trim() && consented && !isRegisteringArtist);
  const registrationBlocker = artistPublicationQuarantined
    ? artistPublicationQuarantineReason
    : !artistRegistrationAvailable
      ? artistRegistrationStatus
      : needsWallet
        ? 'Connect your account to continue.'
        : !artistName.trim()
          ? 'Enter the artist name listeners should see.'
          : !consented
            ? 'Confirm the shared-listening permission to continue.'
            : null;
  const registrationStatus = artistPublicationQuarantined
    ? artistPublicationQuarantineReason
    : connectedWallet
      ? artistRegistrationStatus
      : 'Connect your account to create an artist space.';

  return (
    <div className='artist-onboarding'>
      {artistPublicationQuarantined && (
        <div className='artist-publication-quarantine' role='status'>
          <strong>Artist publishing is temporarily paused.</strong>
          <span>{artistPublicationQuarantineReason}</span>
        </div>
      )}
      <section className='artist-claim-hero' aria-labelledby='artist-claim-title'>
        <div className='artist-claim-copy'>
          <div className='artist-claim-kicker'>
            <Sparkles size={16} />
            Dotify for Artists
          </div>
          <h1 id='artist-claim-title'>Claim your artist space on Dotify.</h1>
          <p>
            Create a home for your releases, choose how people listen, and decide where support goes. Dotify keeps the technical record behind the experience.
          </p>
          <div className='artist-claim-actions'>
            <a className='primary-action' href='#claim-profile'>
              <UserRoundPlus size={16} />
              Get started
            </a>
            <a className='secondary-link' href='/'>
              Open listener app
            </a>
          </div>
        </div>

        <div className='artist-claim-proof' aria-label='Artist tools summary'>
          <div>
            <strong>Own the release path</strong>
            <span>One artist space per connected account, with choices attached to each release.</span>
          </div>
          <div>
            <strong>Publish into listening rooms</strong>
            <span>Music enters a social catalog where people listen together in real time.</span>
          </div>
          <div>
            <strong>Keep context attached</strong>
            <span>Release details, listening access, and support choices stay together.</span>
          </div>
        </div>
      </section>

      <div className='onboarding-container' id='claim-profile'>
        <div className='onboarding-hero'>
          <div className='onboarding-icon'>
            <Wallet size={28} />
          </div>
          <h2>Register as an artist</h2>
          <p className='onboarding-subtitle'>Three short steps create your artist space before you publish.</p>
        </div>

        <div className='onboarding-steps'>
          <div className='step'>
            <div className='step-number'>1</div>
            <div className='step-content'>
              <h3>Connect your account</h3>
              <p>This account approves your releases and future changes.</p>
              {needsWallet ? (
                <button className='primary-action compact-action' type='button' onClick={onShowWalletModal}>
                  <LockKeyhole size={16} />
                  Use my account
                </button>
              ) : (
                <div className='account-info'>
                  <span className='badge badge-success'>{connectedWallet.label} connected</span>
                  <details className='artist-technical-disclosure'>
                    <summary>Account details</summary>
                    <div className='account-address'>
                      <span className='label'>Publishing address</span>
                      <a className='verify-link' href={getBlockscoutAddressUrl(activeEvmAddress)} target='_blank' rel='noreferrer'>
                        <code>{shorten(activeEvmAddress, 14)}</code>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </details>
                </div>
              )}
            </div>
          </div>

          <div className='step'>
            <div className='step-number'>2</div>
            <div className='step-content'>
              <h3>Choose your artist name</h3>
              <p>This is how listeners will see you in the catalog.</p>
              <input
                type='text'
                className='field'
                data-testid='artist-name-input'
                placeholder='Your artist name'
                value={artistName}
                onChange={e => onUpdateArtistName(e.target.value)}
                disabled={isRegisteringArtist}
              />
            </div>
          </div>

          <div className='step'>
            <div className='step-number'>3</div>
            <div className='step-content'>
              <h3>Register your artist space</h3>
              <p>Dotify will use your releases in real-time shared listening rooms. You choose the listening access and support terms for every release.</p>
              <label className='consent-row'>
                <input type='checkbox' className='consent-checkbox' checked={consented} onChange={e => setConsented(e.target.checked)} />
                <span>I understand and consent to shared listening on Dotify.</span>
              </label>
              <div className='registration-status'>
                <span className='status-text'>{registrationStatus}</span>
              </div>
              {registrationBlocker && !isRegisteringArtist && <p className='registration-guidance'>{registrationBlocker}</p>}
              <button
                className='primary-action compact-action'
                type='button'
                data-testid='create-artist-profile'
                onClick={onRegisterArtist}
                disabled={!canRegister}
              >
                {isRegisteringArtist ? <Disc3 size={16} className='spin' /> : <UserRoundPlus size={16} />}
                {isRegisteringArtist ? 'Registering...' : 'Create artist profile'}
              </button>
              <button
                className='secondary-action compact-action'
                type='button'
                onClick={onRefreshArtistRuntime}
                disabled={isRefreshingArtistRuntime || !artistRegistrationConfigured || !connectedWallet}
              >
                {isRefreshingArtistRuntime ? <Disc3 size={16} className='spin' /> : <RefreshCw size={16} />}
                {isRefreshingArtistRuntime ? 'Refreshing...' : 'Refresh status'}
              </button>
            </div>
          </div>
        </div>

        {artistTracks.length > 0 && (
          <div className='onboarding-note'>
            <FileAudio size={20} />
            <p>
              Dotify found <strong>{artistTracks.length}</strong> release{artistTracks.length === 1 ? '' : 's'} associated with this artist account. Register or
              refresh the status to manage them.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
