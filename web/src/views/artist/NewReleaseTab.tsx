import { BadgeCheck, Disc3, FileAudio, Library, Plus, Trash2, Upload } from 'lucide-react';
import { CoverImage } from '../../components/CoverImage';
import { PanelTitle } from '../../shared/ui/PanelTitle';
import { accessModeLabelFromState, shorten } from '../../shared/utils/format';
import { devAccounts } from '../../hooks/useDevAccounts';
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
import type { AccessMode, AssetAction, PersonhoodLevel, ReleaseRoyaltySplitDraft, ReleaseStep } from '../../shared/types';
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
  accessMode: AccessMode;
  personhoodLevel: PersonhoodLevel;
  priceDot: string;
  nativePaymentSymbol: string;
  royaltyBps: number;
  additionalRoyaltySplits: ReleaseRoyaltySplitDraft[];
  uploadToBulletinEnabled: boolean;
  rightsStatus: string;
  isRegistering: boolean;
  canReviewRelease: boolean;
  artistName: string;
  connectedWallet: { label: string } | null;
  activeEvmAddress: string | null;
  artistRuntimeAddress: string | null;
  activeSubstrateAddress: string | null;
  bulletinAccountIndex: number;
  onSetReleaseStep: (step: ReleaseStep) => void;
  onGoToPreviousStep: () => void;
  onGoToNextStep: () => void;
  onHandleAudioFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onHandleCoverFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onSetTitle: (title: string) => void;
  onSetDescription: (desc: string) => void;
  onSetAccessMode: (mode: AccessMode) => void;
  onSetPersonhoodLevel: (level: PersonhoodLevel) => void;
  onSetPriceDot: (price: string) => void;
  onSetRoyaltyBps: (bps: number) => void;
  onAddRoyaltySplit: () => void;
  onUpdateRoyaltySplit: (id: string, patch: Partial<ReleaseRoyaltySplitDraft>) => void;
  onRemoveRoyaltySplit: (id: string) => void;
  onSetUploadToBulletinEnabled: (enabled: boolean) => void;
  onSetBulletinAccountIndex: (index: number) => void;
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
  accessMode,
  personhoodLevel,
  priceDot,
  nativePaymentSymbol,
  royaltyBps,
  additionalRoyaltySplits,
  uploadToBulletinEnabled,
  rightsStatus,
  isRegistering,
  canReviewRelease,
  artistName,
  connectedWallet,
  activeEvmAddress,
  artistRuntimeAddress,
  activeSubstrateAddress,
  bulletinAccountIndex,
  onSetReleaseStep,
  onGoToPreviousStep,
  onGoToNextStep,
  onHandleAudioFile,
  onHandleCoverFile,
  onSetTitle,
  onSetDescription,
  onSetAccessMode,
  onSetPersonhoodLevel,
  onSetPriceDot,
  onSetRoyaltyBps,
  onAddRoyaltySplit,
  onUpdateRoyaltySplit,
  onRemoveRoyaltySplit,
  onSetUploadToBulletinEnabled,
  onSetBulletinAccountIndex,
  onRegisterRights
}: NewReleaseTabProps) {
  const releaseStepIndex = RELEASE_STEPS.findIndex(step => step.id === releaseStep);
  const totalRoyaltyBps = royaltySplitTotal(royaltyBps, additionalRoyaltySplits);
  const remainingRoyaltyBps = royaltySplitRemaining(royaltyBps, additionalRoyaltySplits);
  const isFreeAccess = accessMode === 'free';
  const isListenerPassAccess = accessMode === 'human-free';
  const isDirectSupportAccess = accessMode === 'classic';
  const royaltyFieldsDisabled = artistStudioLocked || isFreeAccess;
  const royaltySplitError = releaseRoyaltySplitPreflightError(accessMode, royaltyBps, additionalRoyaltySplits);
  const releaseCanPublish = canReviewRelease && !royaltySplitError;
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
    runtimeAddress: artistRuntimeAddress,
    uploadToBulletinEnabled
  });
  const releaseTechnicalFacts = buildReleaseTechnicalFacts({
    artistRecipient: activeEvmAddress ?? '',
    runtimeAddress: artistRuntimeAddress,
    uploadToBulletinEnabled,
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
                <span>{fileHash ? shorten(fileHash, 18) : 'Upload an audio file to generate the release hash.'}</span>
              </div>
              <div>
                <strong>{coverSource.startsWith('blob:') ? 'Cover ready' : 'Generated cover'}</strong>
                <span>{coverCID ? shorten(coverCID, 18) : 'A custom cover can be added before publish.'}</span>
              </div>
            </div>
          </div>
        )}

        {releaseStep === 'metadata' && (
          <div className='wizard-panel fields-grid'>
            <label>
              <span>Title</span>
              <input
                className='field'
                data-testid='release-title-input'
                value={title}
                onChange={event => onSetTitle(event.target.value)}
                disabled={artistStudioLocked}
              />
            </label>
            <label>
              <span>Description</span>
              <textarea
                className='field textarea-field'
                data-testid='release-description-input'
                value={description}
                onChange={event => onSetDescription(event.target.value)}
                disabled={artistStudioLocked}
              />
            </label>
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
                  <option value='classic'>Direct support · priced</option>
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
                <span>Listener support in {nativePaymentSymbol}</span>
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
                  <strong>Where support goes</strong>
                  <span>
                    {isFreeAccess
                      ? 'This release collects no listener payment.'
                      : 'You receive the unassigned share. Add collaborators only when support should be shared.'}
                  </span>
                </div>
                <button className='secondary-action compact-action' type='button' onClick={onAddRoyaltySplit} disabled={royaltyFieldsDisabled}>
                  <Plus size={15} />
                  Add recipient
                </button>
              </div>
              <div className='royalty-primary-row'>
                <span>You receive</span>
                <strong>
                  {isFreeAccess
                    ? 'No payment collected'
                    : additionalRoyaltySplits.length === 0
                      ? '100%'
                      : formatRoyaltyPercent(royaltyBps + Math.max(0, remainingRoyaltyBps))}
                </strong>
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
                <span>Support allocation</span>
                <strong>
                  {isFreeAccess
                    ? 'No payment collected'
                    : remainingRoyaltyBps < 0
                      ? `${formatRoyaltyPercent(totalRoyaltyBps)} · over 100%`
                      : additionalRoyaltySplits.length === 0
                        ? 'You receive 100%'
                        : `${formatRoyaltyPercent(totalRoyaltyBps)} assigned · ${formatRoyaltyPercent(remainingRoyaltyBps)} returns to you`}
                </strong>
              </div>
            </div>
            <details className='artist-technical-disclosure release-technical-options'>
              <summary>Advanced publishing options</summary>
              <label className='toggle-row'>
                <input
                  type='checkbox'
                  checked={uploadToBulletinEnabled}
                  onChange={event => onSetUploadToBulletinEnabled(event.target.checked)}
                  disabled={artistStudioLocked}
                />
                <span>Also write the release record to the public Bulletin archive.</span>
              </label>
              {uploadToBulletinEnabled &&
                (connectedWallet ? (
                  <div className='technical-option-row'>
                    <span>Archive signer</span>
                    <code>{activeSubstrateAddress ? `${activeSubstrateAddress.slice(0, 8)}…` : 'No Substrate signer'}</code>
                  </div>
                ) : (
                  <label>
                    <span>Development archive signer</span>
                    <select
                      className='field'
                      value={bulletinAccountIndex}
                      onChange={event => onSetBulletinAccountIndex(Number(event.target.value))}
                      disabled={artistStudioLocked}
                    >
                      {devAccounts.map((account, index) => (
                        <option key={account.name} value={index}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
            </details>
            <div className='rights-status'>
              {accessMode === 'free'
                ? 'Everyone can listen without an account or payment.'
                : accessMode === 'human-free'
                  ? 'Listening is free after the configured human-verification service confirms the selected level.'
                  : 'Listeners see the amount and recipients before they confirm support.'}
            </div>
          </div>
        )}

        {releaseStep === 'review' && (
          <div className='wizard-panel release-review'>
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
                <h4>Where support goes</h4>
                <dl>
                  {releaseValueFlowRows.map(row => (
                    <div key={`${row.label}-${row.value}`}>
                      <dt>{row.label}</dt>
                      <dd>{row.value}</dd>
                    </div>
                  ))}
                </dl>
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
            <p className='rights-status'>Nothing is published until you approve it and Dotify confirms the release is visible in the catalog.</p>
            {!canReviewRelease && <p className='error-box'>Add an audio file and title before publishing.</p>}
            {royaltySplitError && <p className='error-box'>{royaltySplitError}</p>}
          </div>
        )}

        <div className='wizard-actions'>
          <button className='secondary-action compact-action' type='button' onClick={onGoToPreviousStep} disabled={releaseStepIndex === 0}>
            Back
          </button>
          {releaseStep === 'review' ? (
            <button
              className='primary-action compact-action'
              type='button'
              data-testid='publish-release-button'
              onClick={onRegisterRights}
              disabled={isRegistering || artistStudioLocked || !releaseCanPublish}
            >
              {isRegistering ? <Disc3 size={16} className='spin' /> : <BadgeCheck size={16} />}
              {isRegistering ? 'Publishing…' : publicationQuarantined ? 'Publishing paused' : artistStudioLocked ? 'Create profile first' : 'Publish release'}
            </button>
          ) : (
            <button className='primary-action compact-action' type='button' onClick={onGoToNextStep}>
              Continue
            </button>
          )}
        </div>

        <p className='rights-status'>{rightsStatus}</p>
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
