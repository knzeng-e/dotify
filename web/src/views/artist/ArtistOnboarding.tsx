import { BadgeCheck, Disc3, FileAudio, LockKeyhole, RefreshCw, Sparkles, Wallet } from 'lucide-react';
import { useState } from 'react';
import { shorten } from '../../utils/format';
import type { CatalogTrack } from '../../types';

type ArtistOnboardingProps = {
  activeEvmAddress: `0x${string}`;
  artistName: string;
  artistRegistrationStatus: string;
  isRegisteringArtist: boolean;
  isRefreshingArtistRuntime: boolean;
  artistRegistrationAvailable: boolean;
  connectedWallet: { label: string } | null;
  onUpdateArtistName: (name: string) => void;
  onRegisterArtist: () => void;
  onRefreshArtistRuntime: () => void;
  onShowWalletModal: () => void;
  artistTracks: CatalogTrack[];
};

export function ArtistOnboarding(props: ArtistOnboardingProps) {
  const {
    activeEvmAddress,
    artistName,
    artistRegistrationStatus,
    isRegisteringArtist,
    isRefreshingArtistRuntime,
    artistRegistrationAvailable,
    connectedWallet,
    onUpdateArtistName,
    onRegisterArtist,
    onRefreshArtistRuntime,
    onShowWalletModal,
    artistTracks
  } = props;

  const [consented, setConsented] = useState(false);
  const needsWallet = !connectedWallet;
  const canRegister = Boolean(artistRegistrationAvailable && connectedWallet && artistName.trim() && consented && !isRegisteringArtist);
  const registrationStatus = connectedWallet ? artistRegistrationStatus : 'Connect your wallet to claim an artist profile.';

  return (
    <div className='artist-onboarding'>
      <section className='artist-claim-hero' aria-labelledby='artist-claim-title'>
        <div className='artist-claim-copy'>
          <div className='artist-claim-kicker'>
            <Sparkles size={16} />
            Dotify for Artists
          </div>
          <h1 id='artist-claim-title'>Claim your artist space on Dotify.</h1>
          <p>
            Register the wallet that owns your catalog, publish music from your own SmartRuntime, and keep the listener
            experience centered on shared rooms, direct access, and transparent payments.
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
            <span>One profile per wallet, with royalties tied to the artist runtime.</span>
          </div>
          <div>
            <strong>Publish into listening rooms</strong>
            <span>Music enters a social catalog where people listen together in real time.</span>
          </div>
          <div>
            <strong>Keep context attached</strong>
            <span>Metadata, access mode, personhood rules, and pricing travel with the track.</span>
          </div>
        </div>
      </section>

      <div className='onboarding-container' id='claim-profile'>
        <div className='onboarding-hero'>
          <div className='onboarding-icon'>
            <Wallet size={28} />
          </div>
          <h2>Register as an artist</h2>
          <p className='onboarding-subtitle'>
            Use your wallet to create an artist profile before publishing releases.
          </p>
        </div>

        <div className='philosophy-commitment'>
          <p className='philosophy-statement'>
            Dotify is not only a streaming platform. It is a cultural social hub, a place where music becomes the reason people
            gather in real time. When you upload a track, it enters a shared space where listeners can tune in together,
            inhabiting the same moment around your work.
          </p>
          <p className='philosophy-statement'>
            You keep full control of your catalog, rights, and monetization. What you are offering is
            a presence. Your music as an instrument of direct human connection.
          </p>
          <label className='consent-row'>
            <input
              type='checkbox'
              className='consent-checkbox'
              checked={consented}
              onChange={e => setConsented(e.target.checked)}
            />
            <span>I understand and consent to my music being used to create real-time shared listening experiences on Dotify.</span>
          </label>
        </div>

        <div className='onboarding-steps'>
          <div className='step'>
            <div className='step-number'>1</div>
            <div className='step-content'>
              <h3>Connect or select an account</h3>
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
                    <code>{shorten(activeEvmAddress, 14)}</code>
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
                placeholder='Your artist name'
                value={artistName}
                onChange={(e) => onUpdateArtistName(e.target.value)}
                disabled={isRegisteringArtist}
              />
            </div>
          </div>

          <div className='step'>
            <div className='step-number'>3</div>
            <div className='step-content'>
              <h3>Register your SmartRuntime</h3>
              <p>Deploy your personal contract to manage releases and royalties.</p>
              <div className='registration-status'>
                <span className='status-text'>{registrationStatus}</span>
              </div>
              <button
                className='primary-action compact-action'
                type='button'
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
                disabled={isRefreshingArtistRuntime || !artistRegistrationAvailable || !connectedWallet}
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
              You have <strong>{artistTracks.length}</strong> unreleased track(s) waiting. Once registered, you can publish them
              and start earning royalties.
            </p>
          </div>
        )}
      </div>

      <style>{`
        .artist-onboarding {
          width: 100%;
          color: var(--fg-primary);
        }

        .onboarding-container {
          max-width: 760px;
          width: 100%;
          margin: 0 auto;
          padding: 4rem 1rem 5rem;
        }

        .artist-claim-hero {
          display: grid;
          grid-template-columns: minmax(0, 1.18fr) minmax(18rem, 0.82fr);
          gap: 2rem;
          align-items: end;
          min-height: calc(100vh - 4rem);
          padding: clamp(3rem, 8vw, 7rem) clamp(1rem, 5vw, 5rem) 3rem;
          border-bottom: 1px solid var(--border-divider);
          background:
            linear-gradient(135deg, rgba(7, 26, 51, 0.96), rgba(16, 47, 87, 0.92)),
            url('https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1800&q=80');
          background-size: cover;
          background-position: center;
          color: #ffffff;
        }

        .artist-claim-copy {
          max-width: 780px;
        }

        .artist-claim-kicker {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
          color: rgba(255, 255, 255, 0.78);
          font-size: 0.85rem;
          font-weight: 800;
          text-transform: uppercase;
        }

        .artist-claim-copy h1 {
          max-width: 780px;
          margin: 0;
          color: #ffffff;
          font-size: clamp(3rem, 7vw, 6.5rem);
          line-height: 0.98;
          letter-spacing: 0;
        }

        .artist-claim-copy p {
          max-width: 42rem;
          margin: 1.25rem 0 0;
          color: rgba(255, 255, 255, 0.78);
          font-size: 1.08rem;
          line-height: 1.7;
        }

        .artist-claim-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.8rem;
          align-items: center;
          margin-top: 1.6rem;
        }

        .artist-claim-actions .primary-action {
          width: auto;
          min-height: 3rem;
          padding: 0 1.05rem;
          background: #ffffff;
          color: #071a33;
          text-decoration: none;
        }

        .secondary-link {
          color: rgba(255, 255, 255, 0.82);
          font-weight: 700;
          text-decoration: none;
        }

        .secondary-link:hover {
          color: #ffffff;
        }

        .artist-claim-proof {
          display: grid;
          gap: 0.75rem;
        }

        .artist-claim-proof div {
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.1);
          padding: 1rem;
          backdrop-filter: blur(16px);
        }

        .artist-claim-proof strong,
        .artist-claim-proof span {
          display: block;
        }

        .artist-claim-proof strong {
          margin-bottom: 0.3rem;
        }

        .artist-claim-proof span {
          color: rgba(255, 255, 255, 0.72);
          font-size: 0.9rem;
          line-height: 1.5;
        }

        .onboarding-hero {
          text-align: center;
          margin-bottom: 3rem;
        }

        .onboarding-icon {
          width: 80px;
          height: 80px;
          margin: 0 auto 1.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #d946ef 0%, #ec4899 100%);
          border-radius: 8px;
        }

        .onboarding-icon svg {
          color: #ffffff;
        }

        .onboarding-hero h2 {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }

        .onboarding-subtitle {
          font-size: 1rem;
          color: var(--color-text-secondary, #666);
          line-height: 1.5;
        }

        .philosophy-commitment {
          background: var(--dotify-green-dim, rgba(4, 119, 255, 0.06));
          border: 1px solid var(--dotify-green-border, rgba(4, 119, 255, 0.2));
          border-radius: var(--radius-container, 8px);
          padding: 1.5rem;
          margin-bottom: 2.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.875rem;
        }

        .philosophy-statement {
          font-size: 0.875rem;
          line-height: 1.65;
          color: var(--fg-secondary, #526174);
          margin: 0;
        }

        .consent-row {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          margin-top: 0.25rem;
          cursor: pointer;
        }

        .consent-checkbox {
          flex-shrink: 0;
          margin-top: 0.2rem;
          width: 16px;
          height: 16px;
          accent-color: var(--dotify-green, #0477ff);
          cursor: pointer;
        }

        .consent-row span {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--fg-primary, #08172a);
          line-height: 1.5;
          user-select: none;
        }

        .onboarding-steps {
          display: flex;
          flex-direction: column;
          gap: 2rem;
          margin-bottom: 2rem;
        }

        .step {
          display: flex;
          gap: 1rem;
        }

        .step-number {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-action-primary);
          color: white;
          border-radius: 50%;
          font-weight: 600;
          font-size: 0.875rem;
        }

        .step-content {
          flex: 1;
        }

        .step-content h3 {
          font-size: 1rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }

        .step-content p {
          font-size: 0.875rem;
          color: var(--color-text-secondary, #666);
          margin-bottom: 1rem;
        }

        .account-info {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem;
          background: var(--color-background-secondary, #f9f9f9);
          border-radius: 0.375rem;
          border: 1px solid var(--color-border, #ddd);
        }

        .dev-account-field {
          display: block;
          margin-top: 0.8rem;
        }

        .dev-account-field span {
          display: block;
          margin-bottom: 0.35rem;
          color: var(--fg-secondary);
          font-size: 0.82rem;
          font-weight: 700;
        }

        .account-address {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .account-address .label {
          font-size: 0.75rem;
          color: var(--color-text-secondary, #666);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .account-address code {
          font-family: 'Monaco', 'Menlo', monospace;
          font-size: 0.875rem;
          color: var(--color-text-primary, #000);
        }

        .badge {
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .badge-success {
          background: #dcfce7;
          color: #166534;
        }

        .compact-action {
          width: auto;
          min-height: 2.55rem;
          padding: 0 0.9rem;
        }

        .registration-status {
          padding: 0.75rem;
          background: var(--color-background-secondary, #f9f9f9);
          border: 1px solid var(--color-border, #ddd);
          border-radius: 0.375rem;
          margin-bottom: 1rem;
        }

        .status-text {
          font-size: 0.875rem;
          color: var(--color-text-secondary, #666);
        }

        .onboarding-note {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
          padding: 1rem;
          background: #fef3c7;
          border: 1px solid #fcd34d;
          border-radius: 0.375rem;
          color: #92400e;
        }

        .onboarding-note svg {
          flex-shrink: 0;
          width: 20px;
          height: 20px;
        }

        .onboarding-note p {
          margin: 0;
          font-size: 0.875rem;
          line-height: 1.5;
        }

        @media (max-width: 860px) {
          .artist-claim-hero {
            grid-template-columns: 1fr;
            align-items: end;
          }

          .artist-claim-copy h1 {
            font-size: 3rem;
          }
        }
      `}</style>
    </div>
  );
}
