import { BadgeCheck, Disc3, FileAudio, Library, Plus, RefreshCw, Trash2, Upload } from 'lucide-react';
import { CoverImage } from '../../components/CoverImage';
import { PanelTitle } from '../../shared/ui/PanelTitle';
import { accessModeLabelFromState, shorten } from '../../shared/utils/format';
import {
  buildReleasePublicationFacts,
  buildReleaseTechnicalFacts,
  buildReleaseValueFlowRows,
  formatRoyaltyPercent,
  RELEASE_STEPS,
  releaseRoyaltySplitPreflightError,
  royaltyBpsToPercent,
  royaltyPercentToBps,
  royaltySplitRemaining,
  royaltySplitTotal
} from '../../features/artist-studio/releaseForm';
import { releaseDetailsErrors } from '../../features/artist-studio/releaseDetails';
import { RELEASE_CREDIT_ROLE_OPTIONS, RELEASE_KIND_OPTIONS, releaseKindLabel } from '../../features/catalog/releaseMetadata';
import type { AccessMode, AssetAction, PersonhoodLevel, ReleaseEditorialMetadata, ReleaseRoyaltySplitDraft, ReleaseStep } from '../../shared/types';
import type { ChangeEvent } from 'react';

type NewReleaseTabProps = {
  releaseStep: ReleaseStep;
  artistStudioLocked: boolean;
  publicationQuarantined: boolean;
  assetAction: AssetAction;
  audioSource: string | null;
  fileHash: `0x${string}` | '';
  coverSource: string;
  coverCID: string;
  title: string;
  description: string;
  releaseMetadata: ReleaseEditorialMetadata;
  accessMode: AccessMode;
  personhoodLevel: PersonhoodLevel;
  priceDot: string;
  nativePaymentSymbol: string;
  royaltyBps: number;
  additionalRoyaltySplits: ReleaseRoyaltySplitDraft[];
  rightsStatus: string;
  isRegistering: boolean;
  publicationVisibility?: { checking: boolean; check: () => void } | null;
  canReviewRelease: boolean;
  artistName: string;
  onUpdateArtistName: (name: string) => void;
  activeEvmAddress: string | null;
  artistRuntimeAddress: string | null;
  onSetReleaseStep: (step: ReleaseStep) => void;
  onGoToPreviousStep: () => void;
  onGoToNextStep: () => void;
  onHandleAudioFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onHandleCoverFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onSetTitle: (title: string) => void;
  onSetDescription: (desc: string) => void;
  onSetReleaseMetadata: (metadata: ReleaseEditorialMetadata) => void;
  onSetAccessMode: (mode: AccessMode) => void;
  onSetPersonhoodLevel: (level: PersonhoodLevel) => void;
  onSetPriceDot: (price: string) => void;
  onSetRoyaltyBps: (bps: number) => void;
  onAddRoyaltySplit: () => void;
  onUpdateRoyaltySplit: (id: string, patch: Partial<ReleaseRoyaltySplitDraft>) => void;
  onRemoveRoyaltySplit: (id: string) => void;
  onRegisterRights: () => void;
};

export function NewReleaseTab({
  releaseStep,
  artistStudioLocked,
  publicationQuarantined,
  assetAction,
  audioSource,
  fileHash,
  coverSource,
  coverCID,
  title,
  description,
  releaseMetadata,
  accessMode,
  personhoodLevel,
  priceDot,
  nativePaymentSymbol,
  royaltyBps,
  additionalRoyaltySplits,
  rightsStatus,
  isRegistering,
  publicationVisibility,
  canReviewRelease,
  artistName,
  onUpdateArtistName,
  activeEvmAddress,
  artistRuntimeAddress,
  onSetReleaseStep,
  onGoToPreviousStep,
  onGoToNextStep,
  onHandleAudioFile,
  onHandleCoverFile,
  onSetTitle,
  onSetDescription,
  onSetReleaseMetadata,
  onSetAccessMode,
  onSetPersonhoodLevel,
  onSetPriceDot,
  onSetRoyaltyBps,
  onAddRoyaltySplit,
  onUpdateRoyaltySplit,
  onRemoveRoyaltySplit,
  onRegisterRights
}: NewReleaseTabProps) {
  const releaseStepIndex = RELEASE_STEPS.findIndex(step => step.id === releaseStep);
  const totalRoyaltyBps = royaltySplitTotal(royaltyBps, additionalRoyaltySplits);
  const remainingRoyaltyBps = royaltySplitRemaining(royaltyBps, additionalRoyaltySplits);
  const isFreeAccess = accessMode === 'free';
  const isListenerPassAccess = accessMode === 'human-free';
  const isDirectSupportAccess = accessMode === 'classic';
  const royaltyFieldsDisabled = artistStudioLocked;
  const royaltySplitError = releaseRoyaltySplitPreflightError(accessMode, royaltyBps, additionalRoyaltySplits);
  const detailsErrors = releaseDetailsErrors({ title, artistName, description });
  const hasDetailsErrors = Object.keys(detailsErrors).length > 0;
  const releaseCanPublish = canReviewRelease && !hasDetailsErrors && !royaltySplitError;
  const releaseValueFlowRows = buildReleaseValueFlowRows({
    accessMode,
    artistRecipient: activeEvmAddress ?? '',
    primaryBps: royaltyBps,
    additionalSplits: additionalRoyaltySplits
  });
  const releasePublicationFacts = buildReleasePublicationFacts({
    accessMode,
    priceDot,
    nativePaymentSymbol,
    personhoodLevel,
    artistRecipient: activeEvmAddress ?? '',
    runtimeAddress: artistRuntimeAddress
  });
  const releaseTechnicalFacts = buildReleaseTechnicalFacts({
    artistRecipient: activeEvmAddress ?? '',
    runtimeAddress: artistRuntimeAddress,
    additionalSplits: additionalRoyaltySplits
  });

  return (
    <section className='content-grid release-workbench-grid'>
      <div className='doc-panel studio-panel release-wizard'>
        <PanelTitle
          icon={FileAudio}
          title='New release'
          meta={
            publicationQuarantined ? 'publishing paused' : artistStudioLocked ? 'create profile first' : (RELEASE_STEPS[releaseStepIndex]?.label ?? 'draft')
          }
        />

        <div className='release-stepper' aria-label='Release steps'>
          {RELEASE_STEPS.map((step, index) => (
            <button
              key={step.id}
              type='button'
              data-active={releaseStep === step.id}
              aria-current={releaseStep === step.id ? 'step' : undefined}
              onClick={() => onSetReleaseStep(step.id)}
            >
              <span className='release-step-number'>{index + 1}</span>
              <span className='release-step-label'>{step.label}</span>
            </button>
          ))}
        </div>

        {releaseStep === 'assets' && (
          <div className='wizard-panel'>
            <div className='asset-actions'>
              <label className='file-button' data-disabled={assetAction !== 'idle' || artistStudioLocked}>
                {assetAction === 'audio' ? <Disc3 size={16} className='spin' /> : <Upload size={16} />}
                {assetAction === 'audio' ? 'Preparing audio…' : 'Add audio'}
                <input
                  type='file'
                  accept='audio/*'
                  data-testid='artist-audio-input'
                  onChange={onHandleAudioFile}
                  disabled={assetAction !== 'idle' || artistStudioLocked}
                />
              </label>
              <label className='file-button secondary-file' data-disabled={assetAction !== 'idle' || artistStudioLocked}>
                {assetAction === 'cover' ? <Disc3 size={16} className='spin' /> : <Upload size={16} />}
                {assetAction === 'cover' ? 'Preparing cover…' : 'Add cover image'}
                <input
                  type='file'
                  accept='image/*'
                  data-testid='artist-cover-input'
                  onChange={onHandleCoverFile}
                  disabled={assetAction !== 'idle' || artistStudioLocked}
                />
              </label>
            </div>
            <div className='asset-readiness'>
              <div>
                <strong>{audioSource ? 'Audio ready' : 'Audio missing'}</strong>
                <span>{fileHash ? shorten(fileHash, 18) : 'Add an audio file to start your release.'}</span>
              </div>
              <div>
                <strong>{coverCID || coverSource.startsWith('blob:') ? 'Cover ready' : 'Generated cover'}</strong>
                <span>{coverCID ? shorten(coverCID, 18) : 'You can add your own cover before publishing.'}</span>
              </div>
            </div>
          </div>
        )}

        {releaseStep === 'metadata' && (
          <div className='wizard-panel release-metadata-editor'>
            <div className='fields-grid'>
              <label>
                <span>Title (required)</span>
                <input
                  className='field'
                  data-testid='release-title-input'
                  required
                  aria-invalid={Boolean(detailsErrors.title)}
                  aria-describedby={detailsErrors.title ? 'release-title-error' : undefined}
                  value={title}
                  onChange={event => onSetTitle(event.target.value)}
                  disabled={artistStudioLocked}
                />
                {detailsErrors.title && <small id='release-title-error'>{detailsErrors.title}</small>}
              </label>
              <label>
                <span>Artist name (required)</span>
                <input
                  className='field'
                  data-testid='release-artist-name-input'
                  value={artistName}
                  onChange={event => onUpdateArtistName(event.target.value)}
                  disabled={artistStudioLocked}
                  required
                  aria-invalid={Boolean(detailsErrors.artistName)}
                  aria-describedby={detailsErrors.artistName ? 'release-artist-name-error' : 'release-artist-name-hint'}
                />
                <small id='release-artist-name-hint'>The name listeners will see on this release.</small>
                {detailsErrors.artistName && <small id='release-artist-name-error'>{detailsErrors.artistName}</small>}
              </label>
              <label>
                <span>About this track (required)</span>
                <textarea
                  className='field textarea-field'
                  data-testid='release-description-input'
                  required
                  aria-invalid={Boolean(detailsErrors.description)}
                  aria-describedby={detailsErrors.description ? 'release-description-error' : undefined}
                  value={description}
                  placeholder='Share the story, context or intention behind this track.'
                  onChange={event => onSetDescription(event.target.value)}
                  disabled={artistStudioLocked}
                  maxLength={2000}
                />
                {detailsErrors.description && <small id='release-description-error'>{detailsErrors.description}</small>}
              </label>
            </div>

            <details className='release-editorial-details'>
              <summary>
                <span>More release details</span>
                <small>Album, date, genres, languages and credits</small>
              </summary>
              <div className='fields-grid release-editorial-fields'>
                <label>
                  <span>Release type</span>
                  <select
                    className='field'
                    data-testid='release-kind-input'
                    value={releaseMetadata.releaseKind}
                    onChange={event => onSetReleaseMetadata({ ...releaseMetadata, releaseKind: event.target.value as ReleaseEditorialMetadata['releaseKind'] })}
                    disabled={artistStudioLocked}
                  >
                    {RELEASE_KIND_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Album or EP</span>
                  <input
                    className='field'
                    data-testid='release-project-input'
                    value={releaseMetadata.projectTitle}
                    onChange={event => onSetReleaseMetadata({ ...releaseMetadata, projectTitle: event.target.value })}
                    placeholder='Project title'
                    maxLength={200}
                    disabled={artistStudioLocked}
                  />
                </label>
                <label>
                  <span>Original release date</span>
                  <input
                    className='field'
                    data-testid='release-date-input'
                    value={releaseMetadata.releaseDate}
                    onChange={event => onSetReleaseMetadata({ ...releaseMetadata, releaseDate: event.target.value })}
                    placeholder='YYYY or YYYY-MM-DD'
                    inputMode='numeric'
                    pattern='\d{4}(-\d{2}-\d{2})?'
                    maxLength={10}
                    disabled={artistStudioLocked}
                  />
                </label>
                <label>
                  <span>Version</span>
                  <input
                    className='field'
                    value={releaseMetadata.version}
                    onChange={event => onSetReleaseMetadata({ ...releaseMetadata, version: event.target.value })}
                    placeholder='Original, acoustic, radio edit…'
                    maxLength={120}
                    disabled={artistStudioLocked}
                  />
                </label>
                <label>
                  <span>Genres</span>
                  <input
                    className='field'
                    data-testid='release-genres-input'
                    value={releaseMetadata.genres.join(', ')}
                    onChange={event => onSetReleaseMetadata({ ...releaseMetadata, genres: event.target.value.split(',').slice(0, 8) })}
                    placeholder='Hip hop, soul'
                    disabled={artistStudioLocked}
                  />
                  <small>Separate up to eight genres with commas.</small>
                </label>
                <label>
                  <span>Languages</span>
                  <input
                    className='field'
                    value={releaseMetadata.languages.join(', ')}
                    onChange={event => onSetReleaseMetadata({ ...releaseMetadata, languages: event.target.value.split(',').slice(0, 8) })}
                    placeholder='French, Fang'
                    disabled={artistStudioLocked}
                  />
                </label>
                <label>
                  <span>Label</span>
                  <input
                    className='field'
                    value={releaseMetadata.label}
                    onChange={event => onSetReleaseMetadata({ ...releaseMetadata, label: event.target.value })}
                    placeholder='Independent or label name'
                    maxLength={200}
                    disabled={artistStudioLocked}
                  />
                </label>
                <label>
                  <span>Recorded / produced in</span>
                  <input
                    className='field'
                    value={releaseMetadata.productionLocation}
                    onChange={event => onSetReleaseMetadata({ ...releaseMetadata, productionLocation: event.target.value })}
                    placeholder='City, studio or context'
                    maxLength={200}
                    disabled={artistStudioLocked}
                  />
                </label>
                <label>
                  <span>ISRC</span>
                  <input
                    className='field'
                    value={releaseMetadata.isrc}
                    onChange={event => onSetReleaseMetadata({ ...releaseMetadata, isrc: event.target.value })}
                    placeholder='Optional recording identifier'
                    maxLength={15}
                    disabled={artistStudioLocked}
                  />
                </label>
                <label className='release-explicit-field'>
                  <input
                    type='checkbox'
                    checked={releaseMetadata.explicitContent}
                    onChange={event => onSetReleaseMetadata({ ...releaseMetadata, explicitContent: event.target.checked })}
                    disabled={artistStudioLocked}
                  />
                  <span>Contains explicit content</span>
                </label>
                <label>
                  <span>Copyright notice</span>
                  <input
                    className='field'
                    value={releaseMetadata.copyrightNotice}
                    onChange={event => onSetReleaseMetadata({ ...releaseMetadata, copyrightNotice: event.target.value })}
                    placeholder='© notice'
                    maxLength={300}
                    disabled={artistStudioLocked}
                  />
                </label>
                <label>
                  <span>Master recording notice</span>
                  <input
                    className='field'
                    value={releaseMetadata.masterNotice}
                    onChange={event => onSetReleaseMetadata({ ...releaseMetadata, masterNotice: event.target.value })}
                    placeholder='℗ notice'
                    maxLength={300}
                    disabled={artistStudioLocked}
                  />
                </label>
              </div>

              <div className='release-credit-editor'>
                <div className='release-credit-editor-head'>
                  <div>
                    <strong>Credits</strong>
                    <small>Artist-declared contributors and roles</small>
                  </div>
                  <button
                    className='secondary-action compact-action'
                    type='button'
                    onClick={() => onSetReleaseMetadata({ ...releaseMetadata, credits: [...releaseMetadata.credits, { name: '', role: 'performer' }] })}
                    disabled={artistStudioLocked || releaseMetadata.credits.length >= 20}
                  >
                    <Plus size={16} /> Add credit
                  </button>
                </div>
                {releaseMetadata.credits.map((credit, index) => (
                  <div className='release-credit-row' key={index}>
                    <input
                      className='field'
                      value={credit.name}
                      aria-label={`Contributor ${index + 1}`}
                      placeholder='Contributor name'
                      maxLength={200}
                      disabled={artistStudioLocked}
                      onChange={event => {
                        const credits = [...releaseMetadata.credits];
                        credits[index] = { ...credit, name: event.target.value };
                        onSetReleaseMetadata({ ...releaseMetadata, credits });
                      }}
                    />
                    <select
                      className='field'
                      value={credit.role}
                      aria-label={`Contributor ${index + 1} role`}
                      disabled={artistStudioLocked}
                      onChange={event => {
                        const credits = [...releaseMetadata.credits];
                        credits[index] = { ...credit, role: event.target.value as typeof credit.role };
                        onSetReleaseMetadata({ ...releaseMetadata, credits });
                      }}
                    >
                      {RELEASE_CREDIT_ROLE_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button
                      className='icon-button release-credit-remove'
                      type='button'
                      aria-label={`Remove contributor ${index + 1}`}
                      onClick={() =>
                        onSetReleaseMetadata({ ...releaseMetadata, credits: releaseMetadata.credits.filter((_, creditIndex) => creditIndex !== index) })
                      }
                      disabled={artistStudioLocked}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}

        {releaseStep === 'access' && (
          <div className='wizard-panel'>
            <div className='fields-grid'>
              <label>
                <span>Who can listen</span>
                <select
                  className='field'
                  data-testid='release-access-select'
                  value={accessMode}
                  onChange={event => onSetAccessMode(event.target.value as AccessMode)}
                  disabled={artistStudioLocked}
                >
                  <option value='free'>Everyone · free</option>
                  <option value='human-free'>Verified humans · free</option>
                  <option value='classic'>Paid listening access</option>
                </select>
              </label>
              <label>
                <span>Human verification level</span>
                <select
                  className='field'
                  value={personhoodLevel}
                  onChange={event => onSetPersonhoodLevel(event.target.value as PersonhoodLevel)}
                  disabled={artistStudioLocked || !isListenerPassAccess}
                >
                  <option value='DIM1'>Basic verification</option>
                  <option value='DIM2'>Extended verification</option>
                </select>
              </label>
              <label>
                <span>Access price in {nativePaymentSymbol}</span>
                <input
                  className='field'
                  type='number'
                  data-testid='release-price-input'
                  min={0}
                  step={0.1}
                  value={priceDot}
                  onChange={event => onSetPriceDot(event.target.value)}
                  disabled={artistStudioLocked || !isDirectSupportAccess}
                />
              </label>
              <label>
                <span>Your minimum share (%)</span>
                <input
                  className='field'
                  type='number'
                  data-testid='release-royalty-input'
                  min={0}
                  max={100}
                  step={0.25}
                  value={royaltyBpsToPercent(royaltyBps)}
                  onChange={event => onSetRoyaltyBps(royaltyPercentToBps(Number(event.target.value)))}
                  disabled={royaltyFieldsDisabled}
                />
              </label>
            </div>
            <div className='royalty-split-editor' data-disabled={royaltyFieldsDisabled}>
              <div className='royalty-split-head'>
                <div>
                  <strong>How revenue is shared</strong>
                  <span>
                    {isFreeAccess
                      ? 'Listening is free. Voluntary tips follow this distribution.'
                      : 'You receive the unassigned share. Add the rights holders who share this work’s revenue.'}
                  </span>
                </div>
                <button className='secondary-action compact-action' type='button' onClick={onAddRoyaltySplit} disabled={royaltyFieldsDisabled}>
                  <Plus size={15} />
                  Add recipient
                </button>
              </div>
              <div className='royalty-primary-row'>
                <span>You receive</span>
                <strong>{additionalRoyaltySplits.length === 0 ? '100%' : formatRoyaltyPercent(royaltyBps + Math.max(0, remainingRoyaltyBps))}</strong>
              </div>
              {additionalRoyaltySplits.length > 0 && (
                <div className='royalty-split-list'>
                  {additionalRoyaltySplits.map(split => (
                    <div className='royalty-split-row' key={split.id}>
                      <label>
                        <span>Label</span>
                        <input
                          className='field'
                          value={split.label}
                          onChange={event => onUpdateRoyaltySplit(split.id, { label: event.target.value })}
                          disabled={royaltyFieldsDisabled}
                        />
                      </label>
                      <label>
                        <span>Payment address</span>
                        <input
                          className='field'
                          inputMode='text'
                          placeholder='0x…'
                          value={split.recipient}
                          onChange={event => onUpdateRoyaltySplit(split.id, { recipient: event.target.value })}
                          disabled={royaltyFieldsDisabled}
                        />
                      </label>
                      <label>
                        <span>Share (%)</span>
                        <input
                          className='field'
                          type='number'
                          min={0}
                          max={100}
                          step={0.25}
                          value={royaltyBpsToPercent(split.bps)}
                          onChange={event => onUpdateRoyaltySplit(split.id, { bps: royaltyPercentToBps(Number(event.target.value)) })}
                          disabled={royaltyFieldsDisabled}
                        />
                      </label>
                      <button
                        className='icon-action royalty-split-remove'
                        type='button'
                        aria-label={`Remove ${split.label || 'rights holder'}`}
                        onClick={() => onRemoveRoyaltySplit(split.id)}
                        disabled={royaltyFieldsDisabled}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className='royalty-split-total' data-over-limit={remainingRoyaltyBps < 0}>
                <span>Revenue split</span>
                <strong>
                  {remainingRoyaltyBps < 0
                    ? `${formatRoyaltyPercent(totalRoyaltyBps)} · over 100%`
                    : additionalRoyaltySplits.length === 0
                      ? 'You receive 100%'
                      : `${formatRoyaltyPercent(totalRoyaltyBps)} assigned · ${formatRoyaltyPercent(remainingRoyaltyBps)} returns to you`}
                </strong>
              </div>
            </div>
            <div className='rights-status'>
              {accessMode === 'free'
                ? 'Everyone can listen without an account or payment.'
                : accessMode === 'human-free'
                  ? 'Listening is free after the configured human-verification service confirms the selected level.'
                  : 'Listeners see the access price and recipients before they confirm payment.'}
            </div>
          </div>
        )}

        {releaseStep === 'review' && (
          <div className='wizard-panel release-review'>
            {(!fileHash || !audioSource) && <p className='error-box'>Add an audio file before publishing.</p>}
            {hasDetailsErrors && (
              <div className='error-box' role='alert'>
                {Object.entries(detailsErrors).map(([field, message]) => (
                  <p key={field}>{message}</p>
                ))}
                <button className='secondary-action compact-action' type='button' onClick={() => onSetReleaseStep('metadata')}>
                  Complete release details
                </button>
              </div>
            )}
            <section className='release-review-summary' data-testid='release-preflight-panel' aria-label='Release review'>
              <div className='release-review-heading'>
                <span>Final review</span>
                <h3>{title.trim() || 'Untitled'}</h3>
                <p>By {artistName.trim() || 'artist name needed'}</p>
              </div>
              <dl>
                {releasePublicationFacts.map(fact => (
                  <div key={`${fact.label}-${fact.value}`}>
                    <dt>{fact.label}</dt>
                    <dd>{fact.value}</dd>
                  </div>
                ))}
              </dl>
              <div className='release-value-summary' data-testid='release-value-flow'>
                <h4>How revenue is shared</h4>
                <dl>
                  {releaseValueFlowRows.map(row => (
                    <div key={`${row.label}-${row.value}`}>
                      <dt>{row.label}</dt>
                      <dd>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className='release-review-editorial' data-testid='release-editorial-review'>
                <h4>Release details</h4>
                <span>{releaseKindLabel(releaseMetadata.releaseKind)}</span>
                {releaseMetadata.projectTitle && <span>{releaseMetadata.projectTitle}</span>}
                {releaseMetadata.releaseDate && <span>{releaseMetadata.releaseDate}</span>}
                {releaseMetadata.genres.filter(Boolean).length > 0 && <span>{releaseMetadata.genres.filter(Boolean).join(' · ')}</span>}
                {releaseMetadata.credits.filter(credit => credit.name.trim()).length > 0 && (
                  <span>{releaseMetadata.credits.filter(credit => credit.name.trim()).length} credited contributor(s)</span>
                )}
              </div>
            </section>
            <details className='artist-technical-disclosure release-technical-review'>
              <summary>Technical details</summary>
              <dl>
                {releaseTechnicalFacts.map(fact => (
                  <div key={`${fact.label}-${fact.value}`}>
                    <dt>{fact.label}</dt>
                    <dd>{fact.code ? <code>{fact.value}</code> : fact.value}</dd>
                  </div>
                ))}
              </dl>
            </details>
            <p className='rights-status'>
              {publicationVisibility
                ? 'Your approval is confirmed. Dotify is checking that your release appears in the catalog.'
                : 'Nothing is published until you approve it and Dotify confirms the release is visible in the catalog.'}
            </p>
            {royaltySplitError && <p className='error-box'>{royaltySplitError}</p>}
          </div>
        )}

        <p className='rights-status' role='status' aria-live='polite'>
          {rightsStatus}
        </p>

        <div className='wizard-actions'>
          <button className='secondary-action compact-action' type='button' onClick={onGoToPreviousStep} disabled={releaseStepIndex === 0}>
            Back
          </button>
          {releaseStep === 'review' ? (
            <button
              className='primary-action compact-action'
              type='button'
              data-testid='publish-release-button'
              onClick={publicationVisibility ? publicationVisibility.check : onRegisterRights}
              disabled={publicationVisibility ? publicationVisibility.checking : isRegistering || artistStudioLocked || !releaseCanPublish}
            >
              {publicationVisibility ? (
                publicationVisibility.checking ? (
                  <Disc3 size={16} className='spin' />
                ) : (
                  <RefreshCw size={16} />
                )
              ) : isRegistering ? (
                <Disc3 size={16} className='spin' />
              ) : (
                <BadgeCheck size={16} />
              )}
              {publicationVisibility
                ? publicationVisibility.checking
                  ? 'Checking visibility…'
                  : 'Check visibility'
                : isRegistering
                  ? 'Publishing…'
                  : publicationQuarantined
                    ? 'Publishing paused'
                    : artistStudioLocked
                      ? 'Create profile first'
                      : 'Publish release'}
            </button>
          ) : (
            <button className='primary-action compact-action' type='button' onClick={onGoToNextStep}>
              Continue
            </button>
          )}
        </div>
      </div>

      <div className='doc-panel release-preview-panel'>
        <PanelTitle icon={Library} title='Release preview' meta={accessModeLabelFromState(accessMode)} />
        <div className='release-preview-card'>
          <div className='release-preview-cover'>
            <CoverImage src={coverSource} alt='' fallbackLabel={title || 'Untitled'} />
          </div>
          <div className='release-preview-copy'>
            <span className='release-preview-artist'>{artistName || 'Artist'}</span>
            <h2>{title || 'Untitled'}</h2>
            <p>{description || 'Add a short release note to help listeners understand the world behind this track.'}</p>
            <div className='release-preview-meta'>
              <span>{releaseKindLabel(releaseMetadata.releaseKind)}</span>
              {releaseMetadata.projectTitle && <span>{releaseMetadata.projectTitle}</span>}
              {releaseMetadata.releaseDate && <span>{releaseMetadata.releaseDate}</span>}
            </div>
            <div className='access-badges'>
              <span>{accessModeLabelFromState(accessMode)}</span>
              <span>{accessMode === 'classic' ? `${priceDot} ${nativePaymentSymbol}` : accessMode === 'free' ? 'Free' : 'Free with human verification'}</span>
            </div>
          </div>
        </div>
        <div className='rights-status'>This is how the release will appear to listeners. Storage and proof details remain available under Advanced.</div>
      </div>
    </section>
  );
}
