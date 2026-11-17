import { X } from 'lucide-react';
import { Dialog } from './Dialog';
import { CoverImage } from './CoverImage';
import { formatRoyaltyPercent, releaseAccessConditionLabel } from '../features/artist-studio/releaseForm';
import { preparedReleaseForm, type PreparedRelease } from '../features/artist-studio/preparedReleaseRecovery';
import { releaseKindLabel, releaseCreditRoleLabel } from '../features/catalog/releaseMetadata';

export function PreparedReleaseReview({
  release,
  symbol,
  onConfirm,
  onCancel
}: {
  release: PreparedRelease;
  symbol: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { manifest } = release;
  const form = preparedReleaseForm(release);
  const details = [
    ['Album / project', form.releaseMetadata.projectTitle],
    ['Version', form.releaseMetadata.version],
    ['Original release', form.releaseMetadata.releaseDate],
    ['Genres', form.releaseMetadata.genres.join(', ')],
    ['Languages', form.releaseMetadata.languages.join(', ')],
    ['Credits', form.releaseMetadata.credits.map(c => `${c.name} · ${releaseCreditRoleLabel(c.role)}`).join('; ')],
    ['Label', form.releaseMetadata.label],
    ['Recorded in', form.releaseMetadata.productionLocation],
    ['Explicit content', form.releaseMetadata.explicitContent ? 'Yes' : 'No'],
    ['ISRC', form.releaseMetadata.isrc],
    ['Copyright', form.releaseMetadata.copyrightNotice],
    ['Master recording', form.releaseMetadata.masterNotice]
  ].filter(([, value]) => value);
  const remainingBps = 10000 - manifest.settlement.royaltyBps;
  return (
    <Dialog
      labelledBy='prepared-release-title'
      describedBy='prepared-release-description'
      onClose={onCancel}
      className='prepared-release-review'
      initialFocus='dialog'
    >
      <div className='modal-header'>
        <p className='modal-eyebrow'>Your prepared release</p>
        <button className='modal-close' type='button' onClick={onCancel} aria-label='Keep current draft'>
          <X size={18} />
        </button>
      </div>
      <div className='modal-copy'>
        <h2 id='prepared-release-title'>Restore your release details?</h2>
        <p id='prepared-release-description'>
          These are the details saved with your prepared music. Using them replaces the current form and cover. Your audio is reused. You will still review and
          approve publication separately.
        </p>
      </div>
      <div className='prepared-release-heading'>
        {manifest.assets.coverCID ? (
          <CoverImage src={manifest.assets.coverCID} alt={`Saved cover for ${form.title}`} loading='eager' sizes='96px' />
        ) : (
          <span>No saved cover</span>
        )}
        <div>
          <p className='modal-eyebrow'>{form.artistName}</p>
          <h3>{form.title}</h3>
          <p>
            {releaseKindLabel(form.releaseMetadata.releaseKind)} · {form.durationSeconds ?? '—'} seconds
          </p>
        </div>
      </div>
      <section className='prepared-release-story'>
        <h3>About this track</h3>
        <p>{form.description}</p>
      </section>
      <dl className='transaction-facts'>
        <div>
          <dt>Listening access</dt>
          <dd>{releaseAccessConditionLabel(form.accessMode, form.priceDot, symbol, form.personhoodLevel)}</dd>
        </div>
        {remainingBps > 0 && (
          <div>
            <dt>Remaining share to artist</dt>
            <dd>{formatRoyaltyPercent(remainingBps)}</dd>
          </div>
        )}
        {manifest.royalties.map((share, index) => (
          <div key={`${index}-${share.recipient}`}>
            <dt>{share.recipient.toLowerCase() === release.owner.toLowerCase() ? 'Artist share' : 'Rights holder'}</dt>
            <dd>
              {formatRoyaltyPercent(share.bps)} <span className='prepared-release-address'>{share.recipient}</span>
            </dd>
          </div>
        ))}
      </dl>
      <details>
        <summary>More release details</summary>
        <dl className='transaction-facts'>
          {details.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </details>
      <div className='modal-actions'>
        <button className='modal-action' type='button' onClick={onCancel}>
          Keep current draft
        </button>
        <button className='modal-action prepared-release-confirm' type='button' onClick={onConfirm}>
          Use prepared release
        </button>
      </div>
    </Dialog>
  );
}
