import { BadgeCheck, ExternalLink, Library, Play, ShieldCheck } from 'lucide-react';
import { EndpointRow } from '../../components/ui/EndpointRow';
import { PanelTitle } from '../../components/ui/PanelTitle';
import { getBlockscoutAddressUrl } from '../../utils/explorer';
import { accessModeLabel, shorten } from '../../utils/format';
import type { CatalogTrack } from '../../types';

function getRuntimeAddress(track: CatalogTrack) {
  return track.source === 'artist' && track.id.includes(':') ? (track.id.split(':')[0] as `0x${string}`) : null;
}

type ReleasesTabProps = {
  artistTracks: CatalogTrack[];
  selectedReleaseId: string | null;
  onSelectRelease: (releaseId: string) => void;
  onOpenTrack: (track: CatalogTrack) => void;
};

function releaseDomId(trackId: string) {
  return trackId.replace(/[^a-zA-Z0-9_-]/g, '-');
}

export function ReleasesTab({ artistTracks, selectedReleaseId, onSelectRelease, onOpenTrack }: ReleasesTabProps) {
  const selectedRelease = artistTracks.find(track => track.id === selectedReleaseId) ?? artistTracks[0] ?? null;
  const runtimeAddress = selectedRelease ? getRuntimeAddress(selectedRelease) : null;
  const selectedDomId = selectedRelease ? releaseDomId(selectedRelease.id) : 'empty';

  return (
    <section className='content-grid releases-grid release-console-grid'>
      <aside className='doc-panel releases-panel release-list-panel'>
        <PanelTitle icon={Library} title='My releases' meta={`${artistTracks.length} releases`} />
        <div className='release-tabs' role='tablist' aria-label='Published releases'>
          {artistTracks.length > 0 ? (
            artistTracks.map(track => {
              const selected = selectedRelease?.id === track.id;
              const tabId = `release-tab-${releaseDomId(track.id)}`;

              return (
                <button
                  className='release-tab'
                  type='button'
                  role='tab'
                  id={tabId}
                  aria-selected={selected}
                  aria-controls='release-detail-panel'
                  data-active={selected}
                  key={track.id}
                  onClick={() => onSelectRelease(track.id)}
                >
                  <img src={track.imageRef} alt='' crossOrigin='anonymous' />
                  <span className='release-tab-copy'>
                    <strong>{track.title}</strong>
                    <small>
                      {accessModeLabel(track)} / {track.durationLabel}
                    </small>
                  </span>
                  <code>{track.accessMode === 'classic' ? `${track.priceDot} DOT` : track.personhoodLevel}</code>
                </button>
              );
            })
          ) : (
            <div className='empty-state'>No releases registered for this artist wallet yet.</div>
          )}
        </div>
      </aside>

      {selectedRelease && (
        <article className='doc-panel release-focus-panel' id='release-detail-panel' role='tabpanel' aria-labelledby={`release-tab-${selectedDomId}`}>
          <div className='release-focus-hero'>
            <div className='release-focus-cover'>
              <img src={selectedRelease.imageRef} alt='' crossOrigin='anonymous' />
              <span className='sound-bars' aria-hidden='true'>
                <i />
                <i />
                <i />
                <i />
              </span>
            </div>
            <div className='release-focus-copy'>
              <span className='release-kicker'>Registered release</span>
              <h2>{selectedRelease.title}</h2>
              <p className='release-artist-line'>{selectedRelease.artist}</p>
              <div className='access-badges'>
                <span className='access-chip'>{accessModeLabel(selectedRelease)}</span>
                <span className='access-chip'>
                  {selectedRelease.accessMode === 'classic' ? `${selectedRelease.priceDot} DOT` : 'Listener pass'}
                </span>
                <span className='access-chip access-chip-trust'>
                  <BadgeCheck size={13} />
                  Artist controlled
                </span>
                <span className='access-chip access-chip-trust'>
                  <ShieldCheck size={13} />
                  {selectedRelease.encrypted ? 'Encrypted audio' : 'Plain audio'}
                </span>
              </div>
              <p className='release-description'>{selectedRelease.description}</p>
              <div className='release-actions release-primary-actions'>
                <button className='primary-action compact-action' type='button' onClick={() => onOpenTrack(selectedRelease)}>
                  <Play size={15} />
                  Open track
                </button>
                {runtimeAddress && (
                  <a className='secondary-action compact-action' href={getBlockscoutAddressUrl(runtimeAddress)} target='_blank' rel='noreferrer'>
                    <ExternalLink size={15} />
                    Artist record
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className='release-detail-grid'>
            <EndpointRow
              label='Access'
              value={selectedRelease.accessMode === 'classic' ? `${selectedRelease.priceDot} DOT` : 'Listener pass required'}
            />
            <EndpointRow label='Royalty total' value={`${selectedRelease.royaltyBps} bps`} />
            <EndpointRow label='Registered block' value={selectedRelease.registeredAtBlock ? selectedRelease.registeredAtBlock.toString() : 'unknown'} />
            <EndpointRow label='Encrypted audio' value={selectedRelease.encrypted ? 'yes' : 'no'} />
            <EndpointRow label='Content hash' value={<code className='release-ref-code'>{selectedRelease.hash}</code>} />
            <EndpointRow
              label='Artist record'
              value={
                runtimeAddress ? (
                  <a className='verify-link' href={getBlockscoutAddressUrl(runtimeAddress)} target='_blank' rel='noreferrer'>
                    {shorten(runtimeAddress, 12)}
                  </a>
                ) : (
                  'not indexed'
                )
              }
            />
            <EndpointRow
              label='Artist wallet'
              value={
                selectedRelease.artistAddress ? (
                  <a className='verify-link' href={getBlockscoutAddressUrl(selectedRelease.artistAddress)} target='_blank' rel='noreferrer'>
                    {shorten(selectedRelease.artistAddress, 12)}
                  </a>
                ) : (
                  'not indexed'
                )
              }
            />
            <EndpointRow label='Release record' value={<code className='release-ref-code'>{selectedRelease.metadataRef || 'not published'}</code>} />
            <EndpointRow label='Audio ref' value={<code className='release-ref-code'>{selectedRelease.audioRef || 'not published'}</code>} />
          </div>

          <div className='release-splits'>
            <strong>Royalty splits</strong>
            {selectedRelease.royaltySplits.length > 0 ? (
              selectedRelease.royaltySplits.map(split => (
                <div className='release-split-row' key={`${selectedRelease.id}-${split.recipient}-${split.bps}`}>
                  <span>
                    {split.label} / {split.bps} bps
                  </span>
                  <a className='verify-link' href={getBlockscoutAddressUrl(split.recipient)} target='_blank' rel='noreferrer'>
                    {shorten(split.recipient, 12)}
                  </a>
                </div>
              ))
            ) : (
              <span>No royalty splits indexed yet.</span>
            )}
          </div>
        </article>
      )}
    </section>
  );
}
