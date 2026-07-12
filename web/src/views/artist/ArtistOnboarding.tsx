import { BadgeCheck, Disc3, ExternalLink, FileAudio, LockKeyhole, RefreshCw, Sparkles, Wallet } from 'lucide-react';
import { useState } from 'react';
import { getBlockscoutAddressUrl } from '../../shared/utils/explorer';
import { shorten } from '../../shared/utils/format';
import { isTrackManagedByArtist } from '../../features/catalog/trackModel';
import { useReleaseForm, useWalletContext, useUiFeedback, useCatalogContext, useArtistStudio } from '../../app/providers';

// Self-contained via context, mirroring ArtistConsole.
export function ArtistOnboarding() {
  const { artistName, setArtistName } = useReleaseForm();
  const { connectedWallet, activeEvmAddress } = useWalletContext();
  const { setShowWalletModal } = useUiFeedback();
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
  const onShowWalletModal = () => setShowWalletModal(true);

  const [consented, setConsented] = useState(false);
  const needsWallet = !connectedWallet;
  const canRegister = Boolean(artistRegistrationAvailable && connectedWallet && artistName.trim() && consented && !isRegisteringArtist);
  const registrationStatus = artistPublicationQuarantined
    ? artistPublicationQuarantineReason
    : connectedWallet
      ? artistRegistrationStatus
      : 'Connect your wallet to claim an artist profile.';

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
            Connect the wallet that owns your catalog, publish music from your artist space, and keep the listener experience centered on shared rooms, clear
            listening doors, and transparent payments.
          </p>
          <div className='artist-claim-actions'>
            <a className='primary-action' href='#claim-profile'>
              <BadgeCheck size={16} />
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
            <span>One profile per wallet, with royalties tied to your artist space.</span>
          </div>
          <div>
            <strong>Publish into listening rooms</strong>
            <span>Music enters a social catalog where people listen together in real time.</span>
          </div>
          <div>
            <strong>Keep context attached</strong>
            <span>Release details, listening rules, and pricing travel with the track.</span>
          </div>
        </div>
      </section>

      <div className='onboarding-container' id='claim-profile'>
        <div className='onboarding-hero'>
          <div className='onboarding-icon'>
            <Wallet size={28} />
          </div>
          <h2>Register as an artist</h2>
          <p className='onboarding-subtitle'>Use your wallet to create an artist profile before publishing releases.</p>
        </div>

        <div className='philosophy-commitment'>
          <p className='philosophy-statement'>
            Dotify is not only a streaming platform. It is a cultural social hub, a place where music becomes the reason people gather in real time. When you
            upload a track, it enters a shared space where listeners can tune in together.
          </p>
          <p className='philosophy-statement'>
            You keep full control of your catalog, rights, and monetization. What you are offering is a presence. Your music as an instrument of direct human
            connection.
          </p>
          <label className='consent-row'>
            <input type='checkbox' className='consent-checkbox' checked={consented} onChange={e => setConsented(e.target.checked)} />
            <span>I understand and consent to my music being used to create real-time shared listening experiences on Dotify.</span>
          </label>
        </div>

        <div className='onboarding-steps'>
          <div className='step'>
            <div className='step-number'>1</div>
            <div className='step-content'>
              <h3>Connect your wallet</h3>
              <p>Your artist workspace will be tied to this address.</p>
              {needsWallet ? (
                <button className='primary-action compact-action' type='button' onClick={onShowWalletModal}>
                  <LockKeyhole size={16} />
                  Use my wallet
                </button>
              ) : (
                <div className='account-info'>
                  <div className='account-address'>
                    <span className='label'>Active address:</span>
                    <a className='verify-link' href={getBlockscoutAddressUrl(activeEvmAddress)} target='_blank' rel='noreferrer'>
                      <code>{shorten(activeEvmAddress, 14)}</code>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                  <span className='badge badge-success'>{connectedWallet.label}</span>
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
              <p>Create the space that manages releases and royalties.</p>
              <div className='registration-status'>
                <span className='status-text'>{registrationStatus}</span>
              </div>
              <button
                className='primary-action compact-action'
                type='button'
                data-testid='create-artist-profile'
                onClick={onRegisterArtist}
                disabled={!canRegister}
              >
                {isRegisteringArtist ? <Disc3 size={16} className='spin' /> : <BadgeCheck size={16} />}
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
              You have <strong>{artistTracks.length}</strong> unreleased track(s) waiting. Once registered, you can publish them and start earning royalties.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
