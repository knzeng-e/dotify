import { useEffect, useState, type FormEvent } from 'react';
import { BadgeCheck, ExternalLink, Library, Play, Power, PowerOff, Save, ShieldCheck } from 'lucide-react';
import { CoverImage } from '../../components/CoverImage';
import { EndpointRow } from '../../shared/ui/EndpointRow';
import { PanelTitle } from '../../shared/ui/PanelTitle';
import { getBlockscoutAddressUrl } from '../../shared/utils/explorer';
import { accessModeLabel, shorten } from '../../shared/utils/format';
import { runtimeAddressFromTrackId } from '../../features/catalog/trackModel';
import type { AccessMode, CatalogTrack, PersonhoodLevel } from '../../shared/types';

type ReleasesTabProps = {
  artistTracks: CatalogTrack[];
  selectedReleaseId: string | null;
  onSelectRelease: (releaseId: string) => void;
  onOpenTrack: (track: CatalogTrack) => void;
  onUpdateReleaseAccessMode: (track: CatalogTrack, accessMode: AccessMode, priceDot: string, personhoodLevel: PersonhoodLevel) => void;
  onSetReleaseActive: (track: CatalogTrack, active: boolean) => void;
  releaseActionId: string | null;
  /** Into orbit (Constellation phase C): id of a release that just landed on
   * chain while the console was open; its card plays a one-shot arrival. */
  arrivedReleaseId?: string | null;
};

function releaseDomId(trackId: string) {
  return trackId.replace(/[^a-zA-Z0-9_-]/g, '-');
}

export function ReleasesTab({
  artistTracks,
  selectedReleaseId,
  onSelectRelease,
  onOpenTrack,
  onUpdateReleaseAccessMode,
  onSetReleaseActive,
  releaseActionId,
  arrivedReleaseId = null
}: ReleasesTabProps) {
  const selectedRelease = artistTracks.find(track => track.id === selectedReleaseId) ?? artistTracks[0] ?? null;
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
                  data-arrived={track.id === arrivedReleaseId}
                  key={track.id}
                  onClick={() => onSelectRelease(track.id)}
                >
                  <CoverImage src={track.imageRef} alt='' />
                  <span className='release-tab-copy'>
                    <strong>{track.title}</strong>
                    <small>
                      {accessModeLabel(track)} / {track.durationLabel}
                    </small>
                  </span>
                  <span className='release-tab-access'>
                    {track.active === false
                      ? 'Inactive'
                      : track.accessMode === 'classic'
                        ? `${track.priceDot} DOT`
                        : track.accessMode === 'free'
                          ? 'Free'
                          : track.personhoodLevel}
                  </span>
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
              <CoverImage src={selectedRelease.imageRef} alt='' />
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
                  {selectedRelease.accessMode === 'classic'
                    ? `${selectedRelease.priceDot} DOT`
                    : selectedRelease.accessMode === 'free'
                      ? 'Free'
                      : 'Listener pass'}
                </span>
                <span className='access-chip' data-tone={selectedReleaseActive ? 'ready' : 'locked'}>
                  {selectedReleaseActive ? 'Active' : 'Inactive'}
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
                <button className='primary-action compact-action' type='button' onClick={() => onOpenTrack(selectedRelease)} disabled={!selectedReleaseActive}>
                  <Play size={15} />
                  Open track
                </button>
                {runtimeAddress && (
                  <a className='secondary-action compact-action' href={getBlockscoutAddressUrl(runtimeAddress)} target='_blank' rel='noreferrer'>
                    <ExternalLink size={15} />
                    Artist record
                  </a>
                )}
                <button
                  className='secondary-action compact-action'
                  type='button'
                  disabled={isBusy}
                  onClick={() => onSetReleaseActive(selectedRelease, !selectedReleaseActive)}
                >
                  {selectedReleaseActive ? <PowerOff size={15} /> : <Power size={15} />}
                  {isActiveBusy ? 'Updating' : selectedReleaseActive ? 'Deactivate' : 'Reactivate'}
                </button>
              </div>
            </div>
          </div>

          <form className='release-access-editor' onSubmit={handleAccessSubmit}>
            <label className='release-editor-field'>
              <span>Access mode</span>
              <select
                className='field'
                value={draftAccessMode}
                onChange={event => setDraftAccessMode(event.target.value as AccessMode)}
                disabled={!selectedReleaseActive || isBusy}
              >
                <option value='human-free'>Human pass</option>
                <option value='classic'>Classic paid</option>
                <option value='free'>Free</option>
              </select>
            </label>
            <label className='release-editor-field'>
              <span>Price DOT</span>
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
              <span>Pass level</span>
              <select
                className='field'
                value={draftPersonhoodLevel}
                onChange={event => setDraftPersonhoodLevel(event.target.value as PersonhoodLevel)}
                disabled={draftAccessMode !== 'human-free' || !selectedReleaseActive || isBusy}
              >
                <option value='DIM1'>DIM1</option>
                <option value='DIM2'>DIM2</option>
              </select>
            </label>
            <button className='primary-action compact-action' type='submit' disabled={!canSavePolicy}>
              <Save size={15} />
              {isAccessBusy ? 'Saving' : 'Save access'}
            </button>
          </form>

          <div className='release-detail-grid'>
            <EndpointRow
              label='Access'
              value={
                selectedRelease.accessMode === 'classic'
                  ? `${selectedRelease.priceDot} DOT`
                  : selectedRelease.accessMode === 'free'
                    ? 'Free for everyone'
                    : 'Listener pass required'
              }
            />
            <EndpointRow label='Royalty total' value={`${selectedRelease.royaltyBps} bps`} />
            <EndpointRow label='Registered block' value={selectedRelease.registeredAtBlock ? selectedRelease.registeredAtBlock.toString() : 'unknown'} />
            <EndpointRow label='Encrypted audio' value={selectedRelease.encrypted ? 'yes' : 'no'} />
            <EndpointRow label='Status' value={selectedReleaseActive ? 'active' : 'inactive'} />
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
