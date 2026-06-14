import { useState } from 'react';
import { ChevronDown, ExternalLink, Library, Play } from 'lucide-react';
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
  onOpenTrack: (track: CatalogTrack) => void;
};

export function ReleasesTab({ artistTracks, onOpenTrack }: ReleasesTabProps) {
  const [expandedReleaseId, setExpandedReleaseId] = useState<string | null>(artistTracks[0]?.id ?? null);

  return (
    <section className='content-grid releases-grid'>
      <div className='doc-panel releases-panel'>
        <PanelTitle icon={Library} title='My releases' meta={`${artistTracks.length} releases`} />
        <div className='catalogue-table release-table'>
          {artistTracks.length > 0 ? (
            artistTracks.map(track => {
              const expanded = expandedReleaseId === track.id;
              const runtimeAddress = getRuntimeAddress(track);

              return (
                <article className='release-entry' data-expanded={expanded} key={track.id}>
                  <button
                    className='catalogue-row release-row'
                    type='button'
                    aria-expanded={expanded}
                    aria-controls={`release-details-${track.id}`}
                    onClick={() => setExpandedReleaseId(expanded ? null : track.id)}
                  >
                    <img className='track-thumb' src={track.imageRef} alt='' crossOrigin='anonymous' />
                    <span>
                      <strong>{track.title}</strong>
                      <small>
                        {track.artist} / {accessModeLabel(track)} / {track.durationLabel}
                      </small>
                    </span>
                    <code>{track.accessMode === 'classic' ? `${track.priceDot} DOT` : track.personhoodLevel}</code>
                    <ChevronDown size={16} aria-hidden='true' />
                  </button>

                  {expanded && (
                    <div className='release-details' id={`release-details-${track.id}`}>
                      <div className='release-detail-grid'>
                        <EndpointRow label='Access' value={track.accessMode === 'classic' ? `${track.priceDot} DOT` : `Proof of Personhood ${track.personhoodLevel}`} />
                        <EndpointRow label='Royalty total' value={`${track.royaltyBps} bps`} />
                        <EndpointRow label='Registered block' value={track.registeredAtBlock ? track.registeredAtBlock.toString() : 'unknown'} />
                        <EndpointRow label='Encrypted audio' value={track.encrypted ? 'yes' : 'no'} />
                        <EndpointRow label='Content hash' value={<code>{shorten(track.hash, 18)}</code>} />
                        <EndpointRow
                          label='Runtime'
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
                            track.artistAddress ? (
                              <a className='verify-link' href={getBlockscoutAddressUrl(track.artistAddress)} target='_blank' rel='noreferrer'>
                                {shorten(track.artistAddress, 12)}
                              </a>
                            ) : (
                              'not indexed'
                            )
                          }
                        />
                        <EndpointRow label='Metadata' value={track.metadataRef || 'not published'} />
                        <EndpointRow label='Audio ref' value={track.audioRef || 'not published'} />
                      </div>

                      <div className='release-splits'>
                        <strong>Royalty splits</strong>
                        {track.royaltySplits.length > 0 ? (
                          track.royaltySplits.map(split => (
                            <div className='release-split-row' key={`${track.id}-${split.recipient}-${split.bps}`}>
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

                      <div className='release-actions'>
                        <button className='secondary-action compact-action' type='button' onClick={() => onOpenTrack(track)}>
                          <Play size={15} />
                          Open track
                        </button>
                        {runtimeAddress && (
                          <a className='secondary-action compact-action' href={getBlockscoutAddressUrl(runtimeAddress)} target='_blank' rel='noreferrer'>
                            <ExternalLink size={15} />
                            SmartRuntime
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })
          ) : (
            <div className='empty-state'>No releases registered for this artist wallet yet.</div>
          )}
        </div>
      </div>
    </section>
  );
}
