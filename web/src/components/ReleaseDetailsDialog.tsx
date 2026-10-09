import { X } from 'lucide-react';
import { Dialog } from './Dialog';
import { CoverImage } from './CoverImage';
import { buildClassicAccessReceipt } from '../features/access/accessPromise';
import { nativeRuntimeAmountLabel } from '../features/payments/paymentModel';
import type { CatalogTrack } from '../shared/types';

export function ReleaseDetailsDialog({ track, nativePaymentSymbol, onClose }: { track: CatalogTrack; nativePaymentSymbol: string; onClose: () => void }) {
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
  return (
    <Dialog historyDismiss className='release-details-dialog' labelledBy='release-details-title' onClose={onClose} size='compact'>
      <div className='modal-header'>
        <h2 id='release-details-title'>About this release</h2>
        <button className='modal-close' type='button' onClick={onClose} aria-label='Close release details'>
          <X size={18} />
        </button>
      </div>
      <div className='release-details-identity'>
        <CoverImage src={track.imageRef} alt='' fallbackLabel={track.title} />
        <div>
          <h3>{track.title}</h3>
          <p>{track.artist}</p>
        </div>
      </div>
      {track.description && <p>{track.description}</p>}
      <dl className='transaction-facts'>
        <div>
          <dt>Listening access</dt>
          <dd>{access}</dd>
        </div>
        <div>
          <dt>In a room</dt>
          <dd>The host unlocks the track. Guests listen without an account.</dd>
        </div>
        {track.durationLabel && (
          <div>
            <dt>Duration</dt>
            <dd>{track.durationLabel}</dd>
          </div>
        )}
      </dl>
      <h3>Rights and value</h3>
      <p>Listening access does not transfer copyright or permission to redistribute the recording.</p>
      {track.accessMode === 'classic' && (
        <div>
          <h4>Where a payment goes</h4>
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
            <p>Payment recipients are not indexed here. Review the confirmed quote before paying.</p>
          )}
          <p>You see the exact price before you confirm. Gifts and tips are voluntary and do not unlock listening.</p>
        </div>
      )}
      <details className='release-provenance'>
        <summary>Release records</summary>
        <p>These are catalog references, not independent proof of copyright ownership.</p>
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
