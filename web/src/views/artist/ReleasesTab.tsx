import { useEffect, useState, type FormEvent } from 'react';
import { Library, Play, Power, PowerOff, Save, Search, ShieldCheck } from 'lucide-react';
import { CoverImage } from '../../components/CoverImage';
import { EndpointRow } from '../../shared/ui/EndpointRow';
import { PanelTitle } from '../../shared/ui/PanelTitle';
import { getBlockscoutAddressUrl } from '../../shared/utils/explorer';
import { formatWeiAsDot, shorten } from '../../shared/utils/format';
import type { ReleaseEarnings } from '../../features/artist-studio/earnings';
import { runtimeAddressFromTrackId } from '../../features/catalog/trackModel';
import { formatRoyaltyPercent } from '../../features/artist-studio/releaseForm';
import type { AccessMode, CatalogTrack, PersonhoodLevel } from '../../shared/types';

type ReleasesTabProps = {
  mode?: 'releases' | 'rights';
  onManageRights?: () => void;
  artistTracks: CatalogTrack[];
  selectedReleaseId: string | null;
  onSelectRelease: (releaseId: string) => void;
  onOpenTrack: (track: CatalogTrack) => void;
  onUpdateReleaseAccessMode: (track: CatalogTrack, accessMode: AccessMode, priceDot: string, personhoodLevel: PersonhoodLevel) => void;
  onSetReleaseActive: (track: CatalogTrack, active: boolean) => void;
  releaseActionId: string | null;
  nativePaymentSymbol: string;
  earnings: ReleaseEarnings[];
  earningsKnown: boolean;
  earningsStale: boolean;
  /** Into orbit (Constellation phase C): id of a release that just landed on
   * chain while the console was open; its card plays a one-shot arrival. */
  arrivedReleaseId?: string | null;
};

function releaseDomId(trackId: string) {
  return trackId.replace(/[^a-zA-Z0-9_-]/g, '-');
}

export function ReleasesTab({
  mode = 'releases',
  onManageRights,
  artistTracks,
  selectedReleaseId,
  onSelectRelease,
  onOpenTrack,
  onUpdateReleaseAccessMode,
  onSetReleaseActive,
  releaseActionId,
  nativePaymentSymbol,
  earnings,
  earningsKnown,
  earningsStale,
  arrivedReleaseId = null
}: ReleasesTabProps) {
  const [search, setSearch] = useState('');
  const visibleTracks = artistTracks.filter(track => track.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const selectedRelease = visibleTracks.find(track => track.id === selectedReleaseId) ?? visibleTracks[0] ?? null;
  const selectedEarnings = earnings.find(row => row.track.id === selectedRelease?.id);
  const runtimeAddress = selectedRelease ? runtimeAddressFromTrackId(selectedRelease) : null;
  const selectedDomId = selectedRelease ? releaseDomId(selectedRelease.id) : 'empty';
  const [draftAccessMode, setDraftAccessMode] = useState<AccessMode>(selectedRelease?.accessMode ?? 'human-free');
  const [draftPriceDot, setDraftPriceDot] = useState(selectedRelease?.priceDot ?? '0');
  const [draftPersonhoodLevel, setDraftPersonhoodLevel] = useState<PersonhoodLevel>(selectedRelease?.personhoodLevel ?? 'DIM1');

  useEffect(() => {
    if (!selectedRelease) return;
    setDraftAccessMode(selectedRelease.accessMode);
    setDraftPriceDot(selectedRelease.priceDot);
    setDraftPersonhoodLevel(selectedRelease.personhoodLevel);
  }, [selectedRelease]);

  const selectedReleaseActive = selectedRelease?.active !== false;
  const accessActionId = selectedRelease ? `${selectedRelease.id}:access` : '';
  const activeActionId = selectedRelease ? `${selectedRelease.id}:active` : '';
  const isAccessBusy = releaseActionId === accessActionId;
  const isActiveBusy = releaseActionId === activeActionId;
  const isBusy = Boolean(releaseActionId);
  const hasPolicyChanges =
    Boolean(selectedRelease) &&
    (draftAccessMode !== selectedRelease.accessMode ||
      draftPriceDot.trim() !== selectedRelease.priceDot ||
      draftPersonhoodLevel !== selectedRelease.personhoodLevel);
  const canSavePolicy = Boolean(selectedRelease && selectedReleaseActive && hasPolicyChanges && !isBusy);

  function handleAccessSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRelease || !canSavePolicy) return;
    onUpdateReleaseAccessMode(selectedRelease, draftAccessMode, draftPriceDot.trim() || '0', draftPersonhoodLevel);
  }

  return (
    <section className='content-grid releases-grid release-console-grid' data-task={mode}>
      <aside className='doc-panel releases-panel release-list-panel'>
        <PanelTitle icon={Library} title='My releases' meta={`${artistTracks.length} releases`} />
        <label className='studio-release-search'>
          <Search size={17} aria-hidden='true' />
          <input type='search' value={search} onChange={event => setSearch(event.target.value)} placeholder='Search releases' aria-label='Search releases' />
        </label>
        <div
          className='release-tabs'
          role={artistTracks.length ? 'tablist' : undefined}
          aria-label={artistTracks.length ? 'Published releases' : undefined}
          aria-orientation={artistTracks.length ? 'vertical' : undefined}
        >
          {visibleTracks.length > 0 ? (
            visibleTracks.map(track => {
              const selected = selectedRelease?.id === track.id;
              const tabId = `release-tab-${releaseDomId(track.id)}`;

              return (
                <button
                  className='release-tab'
                  type='button'
                  role='tab'
                  tabIndex={selected ? 0 : -1}
                  id={tabId}
                  aria-selected={selected}
                  aria-controls='release-detail-panel'
                  data-active={selected}
                  data-arrived={track.id === arrivedReleaseId}
                  key={track.id}
                  onClick={() => onSelectRelease(track.id)}
                  onKeyDown={event => {
                    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
                    event.preventDefault();
                    const index = visibleTracks.findIndex(item => item.id === track.id);
                    const next =
                      event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? visibleTracks.length - 1
                          : (index + (event.key === 'ArrowDown' ? 1 : -1) + visibleTracks.length) % visibleTracks.length;
                    const destination = visibleTracks[next];
                    onSelectRelease(destination.id);
                    document.getElementById(`release-tab-${releaseDomId(destination.id)}`)?.focus();
                  }}
                >
                  <CoverImage src={track.imageRef} alt='' fallbackLabel={track.title} />
                  <span className='release-tab-copy'>
                    <strong>{track.title}</strong>
                    <small>{track.active === false ? 'Inactive' : 'Published'}</small>
                  </span>
                  <span className='release-tab-access'>
                    {track.active === false
                      ? 'Inactive'
                      : track.accessMode === 'classic'
                        ? `${track.priceDot} ${nativePaymentSymbol}`
                        : track.accessMode === 'free'
                          ? 'Free'
                          : 'Verified humans'}
                  </span>
                </button>
              );
            })
          ) : (
            <div className='studio-empty'>{search ? 'No releases match this search.' : 'No published releases for this artist account yet.'}</div>
          )}
        </div>
      </aside>

      {selectedRelease && (
        <article className='doc-panel release-focus-panel' id='release-detail-panel' role='tabpanel' aria-labelledby={`release-tab-${selectedDomId}`}>
          <div className='release-focus-hero'>
            <div className='release-focus-cover'>
              <CoverImage src={selectedRelease.imageRef} alt='' fallbackLabel={selectedRelease.title} />
            </div>
            <div className='release-focus-copy'>
              <span className='release-kicker'>{selectedReleaseActive ? 'Published release' : 'Inactive release'}</span>
              <h2>{selectedRelease.title}</h2>
              <p className='release-artist-line'>{selectedRelease.artist}</p>
              <div className='access-badges'>
                <span className='access-chip'>
                  {selectedRelease.accessMode === 'classic'
                    ? `${selectedRelease.priceDot} ${nativePaymentSymbol}`
                    : selectedRelease.accessMode === 'free'
                      ? 'Free'
                      : 'Free with human verification'}
                </span>
                <span className='access-chip' data-tone={selectedReleaseActive ? 'ready' : 'locked'}>
                  {selectedReleaseActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className='release-description'>{selectedRelease.description}</p>
              <div className='release-actions release-primary-actions'>
                <button
                  className='secondary-action compact-action'
                  type='button'
                  onClick={() => onOpenTrack(selectedRelease)}
                  disabled={!selectedReleaseActive}
                >
                  <Play size={15} fill='currentColor' />
                  Open track
                </button>
                {mode === 'rights' && (
                  <button
                    className='secondary-action compact-action'
                    type='button'
                    disabled={isBusy}
                    onClick={() => onSetReleaseActive(selectedRelease, !selectedReleaseActive)}
                  >
                    {selectedReleaseActive ? <PowerOff size={15} /> : <Power size={15} />}
                    {isActiveBusy ? 'Updating' : selectedReleaseActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                )}
                {mode === 'releases' && onManageRights && (
                  <button className='secondary-action compact-action' type='button' onClick={onManageRights}>
                    <ShieldCheck size={15} /> Manage rights
                  </button>
                )}
              </div>
            </div>
          </div>

          {mode === 'releases' && (
            <div>
              {earningsStale && (
                <p className='earnings-freshness' role='status'>
                  Update delayed. Showing the last complete reading.
                </p>
              )}
              <dl className='release-earnings-totals'>
                <div>
                  <dt>Generated</dt>
                  <dd>{earningsKnown && selectedEarnings ? `${formatWeiAsDot(selectedEarnings.generatedWei)} ${nativePaymentSymbol}` : 'Unavailable'}</dd>
                </div>
                <div>
                  <dt>Received by you</dt>
                  <dd>{earningsKnown && selectedEarnings ? `${formatWeiAsDot(selectedEarnings.receivedWei)} ${nativePaymentSymbol}` : 'Unavailable'}</dd>
                </div>
                <div>
                  <dt>Payments</dt>
                  <dd>{earningsKnown && selectedEarnings ? selectedEarnings.payments : 'Unavailable'}</dd>
                </div>
              </dl>
            </div>
          )}

          {mode === 'rights' && (
            <form className='release-access-editor' onSubmit={handleAccessSubmit}>
              <label className='release-editor-field'>
                <span>Access mode</span>
                <select
                  className='field'
                  value={draftAccessMode}
                  onChange={event => setDraftAccessMode(event.target.value as AccessMode)}
                  disabled={!selectedReleaseActive || isBusy}
                >
                  <option value='human-free'>Free with human verification</option>
                  <option value='classic'>Direct support</option>
                  <option value='free'>Free</option>
                </select>
              </label>
              <label className='release-editor-field'>
                <span>Price {nativePaymentSymbol}</span>
                <input
                  className='field'
                  type='number'
                  min='0'
                  step='0.0001'
                  value={draftPriceDot}
                  onChange={event => setDraftPriceDot(event.target.value)}
                  disabled={draftAccessMode !== 'classic' || !selectedReleaseActive || isBusy}
                />
              </label>
              <label className='release-editor-field'>
                <span>Human verification level</span>
                <select
                  className='field'
                  value={draftPersonhoodLevel}
                  onChange={event => setDraftPersonhoodLevel(event.target.value as PersonhoodLevel)}
                  disabled={draftAccessMode !== 'human-free' || !selectedReleaseActive || isBusy}
                >
                  <option value='DIM1'>Basic verification</option>
                  <option value='DIM2'>Extended verification</option>
                </select>
              </label>
              <button className='primary-action compact-action' type='submit' disabled={!canSavePolicy}>
                <Save size={15} />
                {isAccessBusy ? 'Saving' : 'Save access'}
              </button>
            </form>
          )}

          <details className='studio-technical'>
            <summary>Release records</summary>
            <div className='release-detail-grid'>
              <EndpointRow
                label='Access'
                value={
                  selectedRelease.accessMode === 'classic'
                    ? `${selectedRelease.priceDot} ${nativePaymentSymbol}`
                    : selectedRelease.accessMode === 'free'
                      ? 'Free for everyone'
                      : selectedRelease.personhoodLevel === 'DIM2'
                        ? 'Free with extended human verification'
                        : 'Free with basic human verification'
                }
              />
              <EndpointRow
                label='Payment split'
                value={selectedRelease.accessMode === 'free' ? 'Not used for free access' : formatRoyaltyPercent(selectedRelease.royaltyBps)}
              />
              <EndpointRow label='Registered block' value={selectedRelease.registeredAtBlock ? selectedRelease.registeredAtBlock.toString() : 'unknown'} />
              <EndpointRow label='Encrypted audio' value={selectedRelease.encrypted ? 'yes' : 'no'} />
              <EndpointRow label='Status' value={selectedReleaseActive ? 'active' : 'inactive'} />
              <EndpointRow label='Track NFT' value='Current owner receives active-track access; policy control does not move with the NFT.' />
              <EndpointRow label='Content hash' value={<code className='release-ref-code'>{selectedRelease.hash}</code>} />
              <EndpointRow
                label='Directory runtime'
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
                label='Original artist'
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
          </details>

          {mode === 'rights' && (
            <div className='release-splits'>
              <strong>Payment splits</strong>
              <p className='release-split-note'>
                Existing releases keep their current payment split. Updating it requires a runtime method that is not exposed by the current contracts.
              </p>
              {selectedRelease.royaltySplits.length > 0 ? (
                selectedRelease.royaltySplits.map(split => (
                  <div className='release-split-row' key={`${selectedRelease.id}-${split.recipient}-${split.bps}`}>
                    <span>
                      {split.label} / {formatRoyaltyPercent(split.bps)}
                    </span>
                    <a className='verify-link' href={getBlockscoutAddressUrl(split.recipient)} target='_blank' rel='noreferrer'>
                      {shorten(split.recipient, 12)}
                    </a>
                  </div>
                ))
              ) : (
                <span>No payment splits indexed yet.</span>
              )}
            </div>
          )}
        </article>
      )}
    </section>
  );
}
