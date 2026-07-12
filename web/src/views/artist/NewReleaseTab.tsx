import { BadgeCheck, Disc3, FileAudio, Library, LockKeyhole, Plus, Trash2, Upload } from 'lucide-react';
import { CoverImage } from '../../components/CoverImage';
import { PanelTitle } from '../../shared/ui/PanelTitle';
import { EndpointRow } from '../../shared/ui/EndpointRow';
import { accessModeLabelFromState, shorten } from '../../shared/utils/format';
import { devAccounts } from '../../hooks/useDevAccounts';
import {
  formatRoyaltyPercent,
  RELEASE_STEPS,
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
  royaltyBps: number;
  additionalRoyaltySplits: ReleaseRoyaltySplitDraft[];
  uploadToBulletinEnabled: boolean;
  rightsStatus: string;
  isRegistering: boolean;
  canReviewRelease: boolean;
  artistName: string;
  connectedWallet: { label: string } | null;
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
  royaltyBps,
  additionalRoyaltySplits,
  uploadToBulletinEnabled,
  rightsStatus,
  isRegistering,
  canReviewRelease,
  artistName,
  connectedWallet,
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
  const releaseCanPublish = canReviewRelease && (isFreeAccess || remainingRoyaltyBps >= 0);

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
            <button key={step.id} type='button' data-active={releaseStep === step.id} onClick={() => onSetReleaseStep(step.id)}>
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
                <span>Access</span>
                <select
                  className='field'
                  data-testid='release-access-select'
                  value={accessMode}
                  onChange={event => onSetAccessMode(event.target.value as AccessMode)}
                  disabled={artistStudioLocked}
                >
                  <option value='free'>Free for everyone</option>
                  <option value='human-free'>Free for verified humans</option>
                  <option value='classic'>Direct support</option>
                </select>
              </label>
              <label>
                <span>Humanity verified level required</span>
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
                <span>Price in DOT</span>
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
                <span>Artist share (%)</span>
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
              {uploadToBulletinEnabled &&
                (connectedWallet ? (
                  <label>
                    <span>Archive signer</span>
                    <div className='field wallet-field'>
                      <LockKeyhole size={14} />
                      {activeSubstrateAddress ? `${activeSubstrateAddress.slice(0, 8)}…` : 'No Substrate signer'}
                    </div>
                  </label>
                ) : (
                  <label>
                    <span>Archive signer</span>
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
            </div>
            <div className='royalty-split-editor' data-disabled={royaltyFieldsDisabled}>
              <div className='royalty-split-head'>
                <div>
                  <strong>Payment split</strong>
                  <span>
                    {isFreeAccess
                      ? 'No payment split is needed for free access.'
                      : 'Add collaborators, producers, labels, or other addresses paid when listeners support this track.'}
                  </span>
                </div>
                <button className='secondary-action compact-action' type='button' onClick={onAddRoyaltySplit} disabled={royaltyFieldsDisabled}>
                  <Plus size={15} />
                  Add holder
                </button>
              </div>
              <div className='royalty-primary-row'>
                <span>Artist wallet</span>
                <strong>{isFreeAccess ? 'Not used for free access' : formatRoyaltyPercent(royaltyBps)}</strong>
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
                        <span>EVM address</span>
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
                <span>Total split</span>
                <strong>
                  {isFreeAccess
                    ? 'Not needed'
                    : `${formatRoyaltyPercent(totalRoyaltyBps)} / 100%${
                        remainingRoyaltyBps < 0 ? ' · over limit' : ` · ${formatRoyaltyPercent(remainingRoyaltyBps)} left`
                      }`}
                </strong>
              </div>
            </div>
            <label className='toggle-row'>
              <input
                type='checkbox'
                checked={uploadToBulletinEnabled}
                onChange={event => onSetUploadToBulletinEnabled(event.target.checked)}
                disabled={artistStudioLocked}
              />
              <span>Keep a public release archive</span>
            </label>
            <div className='rights-status'>
              {accessMode === 'free'
                ? 'Free opens the full song immediately. Price, verification, and payment split are not used.'
                : accessMode === 'human-free'
                  ? 'Free for verified humans uses proof of personhood. Basic is the default check; extended is stricter.'
                  : 'Direct support shows price and split before confirmation.'}
            </div>
          </div>
        )}

        {releaseStep === 'review' && (
          <div className='wizard-panel release-review'>
            <EndpointRow label='Track' value={title.trim() || 'Untitled'} />
            <EndpointRow label='Artist' value={artistName.trim() || 'Unknown artist'} />
            <EndpointRow
              label='Access'
              value={
                accessMode === 'classic'
                  ? `${priceDot} DOT`
                  : accessMode === 'free'
                    ? 'Free for everyone'
                    : personhoodLevel === 'DIM2'
                      ? 'Free for verified humans · extended'
                      : 'Free for verified humans · basic'
              }
            />
            <EndpointRow
              label='Payment split'
              value={isFreeAccess ? 'Not used for free access' : `${formatRoyaltyPercent(totalRoyaltyBps)} across ${additionalRoyaltySplits.length + 1} holder(s)`}
            />
            <EndpointRow label='Metadata' value='IPFS canonical manifest' />
            <EndpointRow label='Archive' value={uploadToBulletinEnabled ? 'Bulletin enabled' : 'Off'} />
            {!canReviewRelease && <p className='error-box'>Add an audio file and title before publishing.</p>}
            {!isFreeAccess && remainingRoyaltyBps < 0 && <p className='error-box'>Reduce the payment split to 100% or less before publishing.</p>}
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
            <CoverImage src={coverSource} alt='' />
          </div>
          <div className='release-preview-copy'>
            <span className='release-preview-artist'>{artistName || 'Artist'}</span>
            <h2>{title || 'Untitled'}</h2>
            <p>{description || 'Add a short release note to help listeners understand the world behind this track.'}</p>
            <div className='access-badges'>
              <span>{accessModeLabelFromState(accessMode)}</span>
              <span>{accessMode === 'classic' ? `${priceDot} DOT` : accessMode === 'free' ? 'Free' : 'Free for verified humans'}</span>
            </div>
          </div>
        </div>
        <div className='rights-status'>Audio, cover art, and release details stay portable instead of being locked inside one platform.</div>
      </div>
    </section>
  );
}
