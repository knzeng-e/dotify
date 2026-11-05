import { Coins, ShieldCheck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ListeningSheet } from './ListeningSheet';
import { CoverImage } from './CoverImage';
import { buildClassicAccessReceipt } from '../features/access/accessPromise';
import { releaseCreditRoleLabel, releaseDateLabel, releaseKindLabel } from '../features/catalog/releaseMetadata';
import { nativeRuntimeAmountLabel } from '../features/payments/paymentModel';
import { fetchTrackManifest, type DotifyTrackManifest } from '../services/pinata';
import type { CatalogTrack, TrackInfo } from '../shared/types';

function durationLabel(seconds: number | undefined): string | null {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return null;
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}

export function ReleaseDetailsDialog({
  track,
  nativePaymentSymbol,
  onClose,
  roomContext = false,
  onOpenArtist
}: {
  track: CatalogTrack | TrackInfo;
  nativePaymentSymbol: string;
  onClose: () => void;
  roomContext?: boolean;
  onOpenArtist?: () => void;
}) {
  const release = 'id' in track ? track : null;
  const [metadata, setMetadata] = useState<{
    ref: string | undefined;
    manifest: DotifyTrackManifest | null;
    state: 'loading' | 'ready' | 'unavailable';
  }>({ ref: track.metadataRef, manifest: null, state: track.metadataRef ? 'loading' : 'unavailable' });
  const manifest = metadata.ref === track.metadataRef ? metadata.manifest : null;
  const metadataState = metadata.ref === track.metadataRef ? metadata.state : track.metadataRef ? 'loading' : 'unavailable';
  const editorial = manifest?.editorial ?? null;
  const duration = durationLabel(manifest?.track.durationSeconds ?? track.duration);
  const access =
    release?.active === false
      ? 'Release unavailable'
      : track.accessMode === 'classic'
        ? track.priceDot
          ? nativeRuntimeAmountLabel(track.priceDot, { symbol: nativePaymentSymbol })
          : 'Listening price unavailable'
        : track.accessMode === 'free'
          ? 'Free for everyone'
          : track.accessMode !== 'human-free'
            ? 'Listening terms unavailable'
            : track.personhoodLevel === 'DIM2'
              ? 'Free with extended human verification'
              : 'Free with basic human verification';

  useEffect(() => {
    if (!track.metadataRef) {
      setMetadata({ ref: track.metadataRef, manifest: null, state: 'unavailable' });
      return;
    }
    const controller = new AbortController();
    const ref = track.metadataRef;
    setMetadata({ ref, manifest: null, state: 'loading' });
    void fetchTrackManifest(track.metadataRef, { signal: controller.signal })
      .then(next => {
        if (controller.signal.aborted) return;
        setMetadata({ ref, manifest: next, state: 'ready' });
      })
      .catch(() => {
        if (!controller.signal.aborted) setMetadata({ ref, manifest: null, state: 'unavailable' });
      });
    return () => controller.abort();
  }, [track.metadataRef]);

  const releaseFacts = editorial
    ? ([
        editorial.projectTitle ? { label: editorial.releaseKind === 'ep-track' ? 'EP' : 'Album / project', value: editorial.projectTitle } : null,
        editorial.genres.length ? { label: 'Genres', value: editorial.genres.join(' · ') } : null,
        editorial.languages.length ? { label: 'Languages', value: editorial.languages.join(' · ') } : null,
        editorial.version ? { label: 'Version', value: editorial.version } : null,
        editorial.label ? { label: 'Label', value: editorial.label } : null,
        editorial.productionLocation ? { label: 'Recorded / produced in', value: editorial.productionLocation } : null,
        duration ? { label: 'Duration', value: duration } : null
      ].filter(Boolean) as Array<{ label: string; value: string }>)
    : duration
      ? [{ label: 'Duration', value: duration }]
      : [];

  return (
    <ListeningSheet className='release-details-dialog' labelledBy='release-details-title' onClose={onClose} handleLabel='Collapse release details'>
      {close => (
        <>
          <div className='modal-header release-details-header'>
            <div>
              <span className='sr-only' id='release-details-title'>
                About this release
              </span>
              <span className='release-details-kicker'>Release</span>
              <h2>{track.title}</h2>
            </div>
            <button className='modal-close' type='button' onClick={close} aria-label='Close release details'>
              <X size={18} />
            </button>
          </div>

          <div className='release-details-hero'>
            <CoverImage src={track.imageRef} alt={`Cover of ${track.title}`} fallbackLabel={track.title} />
            <div className='release-details-identity'>
              <p className='release-details-artist'>{track.artist}</p>
              {onOpenArtist && track.artist && (
                <button type='button' className='text-action' onClick={onOpenArtist}>
                  Explore this artist
                </button>
              )}
              <div className='release-details-chips'>
                {editorial && <span>{releaseKindLabel(editorial.releaseKind)}</span>}
                {editorial?.releaseDate && <span>{releaseDateLabel(editorial.releaseDate)}</span>}
                {editorial?.explicitContent && <span>Explicit</span>}
              </div>
              <p className='release-access-summary'>
                {track.accessMode === 'classic' && release?.active !== false ? (
                  <Coins size={18} aria-hidden='true' />
                ) : (
                  <ShieldCheck size={18} aria-hidden='true' />
                )}
                <span className='sr-only'>{track.accessMode === 'classic' ? 'Listening price: ' : 'Listening access: '}</span>
                <span>{access}</span>
              </p>
            </div>
          </div>

          {roomContext && (
            <p className='release-metadata-status'>
              You’re still listening in the room.{' '}
              {release
                ? 'Explore without interrupting the music.'
                : 'These track details were shared by the host; a matching catalog release is not available.'}
            </p>
          )}

          {track.description && (
            <section className='release-details-section release-story-section'>
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
            <p className='release-metadata-status'>Additional release details could not load. The listening price and access conditions are still available.</p>
          )}

          <details className='release-listening-section'>
            <summary>Listening &amp; support</summary>
            <div className='release-listening-content'>
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
                  {release && release.royaltySplits.length ? (
                    <ul className='release-payment-splits'>
                      {buildClassicAccessReceipt(release, { symbol: nativePaymentSymbol }).recipients.map((recipient, index) => (
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
            </div>
          </details>

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
              {release?.artistAddress && (
                <div>
                  <dt>Artist account</dt>
                  <dd>
                    <code>{release.artistAddress}</code>
                  </dd>
                </div>
              )}
              {release?.registeredAtBlock !== undefined && (
                <div>
                  <dt>Registered block</dt>
                  <dd>{release.registeredAtBlock}</dd>
                </div>
              )}
              {release?.txHash && (
                <div>
                  <dt>Transaction</dt>
                  <dd>
                    <code>{release.txHash}</code>
                  </dd>
                </div>
              )}
              {release?.royaltySplits.map((split, index) => (
                <div key={`${split.recipient}-${index}`}>
                  <dt>{split.label || 'Recipient'}</dt>
                  <dd>
                    <code>{split.recipient}</code>
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        </>
      )}
    </ListeningSheet>
  );
}
