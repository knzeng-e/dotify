import { CalendarDays, Disc3, Languages, MapPin, ShieldCheck, UsersRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Dialog } from './Dialog';
import { CoverImage } from './CoverImage';
import { buildClassicAccessReceipt } from '../features/access/accessPromise';
import { releaseCreditRoleLabel, releaseDateLabel, releaseKindLabel } from '../features/catalog/releaseMetadata';
import { nativeRuntimeAmountLabel } from '../features/payments/paymentModel';
import { fetchTrackManifest, type DotifyTrackManifest } from '../services/pinata';
import type { CatalogTrack } from '../shared/types';

function durationLabel(seconds: number | undefined): string | null {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return null;
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}

export function ReleaseDetailsDialog({ track, nativePaymentSymbol, onClose }: { track: CatalogTrack; nativePaymentSymbol: string; onClose: () => void }) {
  const [manifest, setManifest] = useState<DotifyTrackManifest | null>(null);
  const [metadataState, setMetadataState] = useState<'loading' | 'ready' | 'unavailable'>(track.metadataRef ? 'loading' : 'unavailable');
  const editorial = manifest?.editorial ?? null;
  const duration = durationLabel(manifest?.track.durationSeconds ?? track.duration);
  const access =
    track.active === false
      ? 'Release unavailable'
      : track.accessMode === 'classic'
        ? `${nativeRuntimeAmountLabel(track.priceDot, { symbol: nativePaymentSymbol })} to unlock, plus network fees`
        : track.accessMode === 'free'
          ? 'Free for everyone'
          : track.personhoodLevel === 'DIM2'
            ? 'Free with extended human verification'
            : 'Free with basic human verification';

  useEffect(() => {
    setManifest(null);
    if (!track.metadataRef) {
      setMetadataState('unavailable');
      return;
    }
    const controller = new AbortController();
    setMetadataState('loading');
    void fetchTrackManifest(track.metadataRef, { signal: controller.signal })
      .then(next => {
        if (controller.signal.aborted) return;
        setManifest(next);
        setMetadataState('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setMetadataState('unavailable');
      });
    return () => controller.abort();
  }, [track.metadataRef]);

  const releaseFacts = editorial
    ? ([
        { icon: Disc3, label: 'Release', value: releaseKindLabel(editorial.releaseKind) },
        editorial.projectTitle ? { icon: Disc3, label: editorial.releaseKind === 'ep-track' ? 'EP' : 'Album / project', value: editorial.projectTitle } : null,
        editorial.releaseDate ? { icon: CalendarDays, label: 'Original release', value: releaseDateLabel(editorial.releaseDate) } : null,
        editorial.genres.length ? { icon: Disc3, label: 'Genres', value: editorial.genres.join(' · ') } : null,
        editorial.languages.length ? { icon: Languages, label: 'Languages', value: editorial.languages.join(' · ') } : null,
        editorial.version ? { icon: Disc3, label: 'Version', value: editorial.version } : null,
        editorial.label ? { icon: ShieldCheck, label: 'Label', value: editorial.label } : null,
        editorial.productionLocation ? { icon: MapPin, label: 'Recorded / produced in', value: editorial.productionLocation } : null,
        duration ? { icon: Disc3, label: 'Duration', value: duration } : null
      ].filter(Boolean) as Array<{ icon: typeof Disc3; label: string; value: string }>)
    : duration
      ? [{ icon: Disc3, label: 'Duration', value: duration }]
      : [];

  return (
    <Dialog historyDismiss className='release-details-dialog' labelledBy='release-details-title' onClose={onClose} size='default'>
      <div className='modal-header release-details-header'>
        <div>
          <span className='sr-only' id='release-details-title'>
            About this release
          </span>
          <span className='release-details-kicker'>Release</span>
          <h2>{track.title}</h2>
        </div>
        <button className='modal-close' type='button' onClick={onClose} aria-label='Close release details'>
          <X size={18} />
        </button>
      </div>

      <div className='release-details-hero'>
        <CoverImage src={track.imageRef} alt={`Cover of ${track.title}`} fallbackLabel={track.title} />
        <div className='release-details-identity'>
          <p className='release-details-artist'>{track.artist}</p>
          <div className='release-details-chips'>
            {editorial && <span>{releaseKindLabel(editorial.releaseKind)}</span>}
            {editorial?.releaseDate && <span>{releaseDateLabel(editorial.releaseDate)}</span>}
            {editorial?.explicitContent && <span>Explicit</span>}
          </div>
          <div className='release-access-summary'>
            <ShieldCheck size={18} aria-hidden='true' />
            <div>
              <strong>Listening access</strong>
              <span>{access}</span>
            </div>
          </div>
        </div>
      </div>

      {track.description && (
        <section className='release-details-section'>
          <h3>About this track</h3>
          <p className='release-story'>{track.description}</p>
        </section>
      )}

      {releaseFacts.length > 0 && (
        <section className='release-details-section'>
          <h3>Release details</h3>
          <dl className='release-editorial-facts'>
            {releaseFacts.map(fact => (
              <div key={fact.label}>
                <fact.icon size={17} aria-hidden='true' />
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {editorial?.credits.length ? (
        <section className='release-details-section'>
          <div className='release-section-heading'>
            <h3>Credits</h3>
            <span>Provided by the artist</span>
          </div>
          <ul className='release-credits-list'>
            {editorial.credits.map((credit, index) => (
              <li key={`${credit.name}-${credit.role}-${index}`}>
                <UsersRound size={17} aria-hidden='true' />
                <span>{credit.name}</span>
                <small>{releaseCreditRoleLabel(credit.role)}</small>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {editorial && (editorial.copyrightNotice || editorial.masterNotice || editorial.isrc) && (
        <section className='release-details-section release-notices'>
          <h3>Release notices</h3>
          {editorial.copyrightNotice && <p>{editorial.copyrightNotice}</p>}
          {editorial.masterNotice && <p>{editorial.masterNotice}</p>}
          {editorial.isrc && (
            <p>
              <strong>ISRC</strong> {editorial.isrc}
            </p>
          )}
        </section>
      )}

      {metadataState === 'loading' && (
        <p className='release-metadata-status' role='status'>
          Loading the artist’s release details…
        </p>
      )}
      {metadataState === 'unavailable' && track.metadataRef && (
        <p className='release-metadata-status'>Additional artist details are unavailable. Listening access below remains authoritative.</p>
      )}

      <section className='release-details-section release-listening-section'>
        <h3>Listening &amp; support</h3>
        <dl className='transaction-facts'>
          <div>
            <dt>Solo listening</dt>
            <dd>{access}</dd>
          </div>
          <div>
            <dt>In a room</dt>
            <dd>The host unlocks the track. Guests listen without an account.</dd>
          </div>
        </dl>
        <p>Listening access does not transfer copyright or permission to redistribute the recording.</p>
        {track.accessMode === 'classic' && (
          <div>
            <h4>Where an access payment goes</h4>
            {track.royaltySplits.length ? (
              <ul className='release-payment-splits'>
                {buildClassicAccessReceipt(track, { symbol: nativePaymentSymbol }).recipients.map((recipient, index) => (
                  <li key={`${recipient.label}-${index}`}>
                    <span>{recipient.label}</span>
                    <strong>{recipient.value}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Payment recipients are shown in the confirmed quote before payment.</p>
            )}
            <p>Tips are voluntary and do not unlock listening.</p>
          </div>
        )}
      </section>

      <details className='release-provenance'>
        <summary>Release records</summary>
        <p>Technical catalog references. Artist-entered credits are declarations, not independent proof of copyright ownership.</p>
        <dl className='transaction-facts'>
          <div>
            <dt>Content hash</dt>
            <dd>
              <code>{track.hash}</code>
            </dd>
          </div>
          {track.metadataRef && (
            <div>
              <dt>Metadata</dt>
              <dd>
                <code>{track.metadataRef}</code>
              </dd>
            </div>
          )}
          {track.artistAddress && (
            <div>
              <dt>Artist account</dt>
              <dd>
                <code>{track.artistAddress}</code>
              </dd>
            </div>
          )}
          {track.registeredAtBlock !== undefined && (
            <div>
              <dt>Registered block</dt>
              <dd>{track.registeredAtBlock}</dd>
            </div>
          )}
          {track.txHash && (
            <div>
              <dt>Transaction</dt>
              <dd>
                <code>{track.txHash}</code>
              </dd>
            </div>
          )}
          {track.royaltySplits.map((split, index) => (
            <div key={`${split.recipient}-${index}`}>
              <dt>{split.label || 'Recipient'}</dt>
              <dd>
                <code>{split.recipient}</code>
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </Dialog>
  );
}
