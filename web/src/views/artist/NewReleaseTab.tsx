import { BadgeCheck, Disc3, FileAudio, Library, LockKeyhole, Upload } from 'lucide-react';
import { PanelTitle } from '../../shared/ui/PanelTitle';
import { EndpointRow } from '../../shared/ui/EndpointRow';
import { accessModeLabelFromState, shorten } from '../../shared/utils/format';
import { devAccounts } from '../../hooks/useDevAccounts';
import { RELEASE_STEPS } from '../../features/artist-studio/releaseForm';
import type { AccessMode, AssetAction, PersonhoodLevel, ReleaseStep } from '../../shared/types';
import type { ChangeEvent } from 'react';

type NewReleaseTabProps = {
  releaseStep: ReleaseStep;
  artistStudioLocked: boolean;
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
  onSetUploadToBulletinEnabled: (enabled: boolean) => void;
  onSetBulletinAccountIndex: (index: number) => void;
  onRegisterRights: () => void;
};

export function NewReleaseTab({
  releaseStep,
  artistStudioLocked,
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
  onSetUploadToBulletinEnabled,
  onSetBulletinAccountIndex,
  onRegisterRights
}: NewReleaseTabProps) {
  const releaseStepIndex = RELEASE_STEPS.findIndex(step => step.id === releaseStep);

  return (
    <section className='content-grid release-workbench-grid'>
      <div className='doc-panel studio-panel release-wizard'>
        <PanelTitle
          icon={FileAudio}
          title='New release'
          meta={artistStudioLocked ? 'create profile first' : (RELEASE_STEPS[releaseStepIndex]?.label ?? 'draft')}
        />

        <div className='release-stepper' aria-label='Release steps'>
          {RELEASE_STEPS.map((step, index) => (
            <button key={step.id} type='button' data-active={releaseStep === step.id} onClick={() => onSetReleaseStep(step.id)}>
              <span>{index + 1}</span>
              {step.label}
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
                <span>Listening door</span>
                <select
                  className='field'
                  data-testid='release-access-select'
                  value={accessMode}
                  onChange={event => onSetAccessMode(event.target.value as AccessMode)}
                  disabled={artistStudioLocked}
                >
                  <option value='free'>Free for everyone</option>
                  <option value='human-free'>Listener pass</option>
                  <option value='classic'>Paid unlock</option>
                </select>
              </label>
              <label>
                <span>Pass level</span>
                <select
                  className='field'
                  value={personhoodLevel}
                  onChange={event => onSetPersonhoodLevel(event.target.value as PersonhoodLevel)}
                  disabled={artistStudioLocked}
                >
                  <option value='DIM1'>Basic pass</option>
                  <option value='DIM2'>Extended pass</option>
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
                  disabled={artistStudioLocked}
                />
              </label>
              <label>
                <span>Royalty bps</span>
                <input
                  className='field'
                  type='number'
                  data-testid='release-royalty-input'
                  min={0}
                  max={10000}
                  step={25}
                  value={royaltyBps}
                  onChange={event => onSetRoyaltyBps(Number(event.target.value))}
                  disabled={artistStudioLocked}
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
                ? 'Free means anyone can play the full song, wallet or not. You can change the door later without re-uploading.'
                : accessMode === 'human-free'
                  ? 'Listener pass means the full song can open without ad-style profiles.'
                  : 'Paid unlock means listeners see the price first and support goes directly to the artist.'}
            </div>
          </div>
        )}

        {releaseStep === 'review' && (
          <div className='wizard-panel release-review'>
            <EndpointRow label='Track' value={title.trim() || 'Untitled'} />
            <EndpointRow label='Artist' value={artistName.trim() || 'Unknown artist'} />
            <EndpointRow
              label='Access'
              value={accessMode === 'classic' ? `${priceDot} DOT` : accessMode === 'free' ? 'Free for everyone' : `Human verified ${personhoodLevel}`}
            />
            <EndpointRow label='Royalty' value={`${royaltyBps} bps`} />
            <EndpointRow label='Metadata' value='IPFS canonical manifest' />
            <EndpointRow label='Archive' value={uploadToBulletinEnabled ? 'Bulletin enabled' : 'Off'} />
            {!canReviewRelease && <p className='error-box'>Add an audio file and title before publishing.</p>}
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
              disabled={isRegistering || artistStudioLocked || !canReviewRelease}
            >
              {isRegistering ? <Disc3 size={16} className='spin' /> : <BadgeCheck size={16} />}
              {isRegistering ? 'Publishing…' : artistStudioLocked ? 'Create profile first' : 'Publish release'}
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
            <img src={coverSource} alt='' crossOrigin='anonymous' />
          </div>
          <div className='release-preview-copy'>
            <span className='release-preview-artist'>{artistName || 'Artist'}</span>
            <h2>{title || 'Untitled'}</h2>
            <p>{description || 'Add a short release note to help listeners understand the world behind this track.'}</p>
            <div className='access-badges'>
              <span>{accessModeLabelFromState(accessMode)}</span>
              <span>{accessMode === 'classic' ? `${priceDot} DOT` : accessMode === 'free' ? 'Free' : 'Listener pass'}</span>
            </div>
          </div>
        </div>
        <div className='rights-status'>Audio, cover art, and release details stay portable instead of being locked inside one platform.</div>
      </div>
    </section>
  );
}
