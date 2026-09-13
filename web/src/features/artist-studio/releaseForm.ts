// Artist studio - release-form step machine and studio-state derivations.
//
// Pure rules pulled out of App.tsx (and de-duplicated with NewReleaseTab's local
// step list) so the wizard navigation and gating are testable in isolation.

import type { AccessMode, PersonhoodLevel, ReleaseRoyaltySplitDraft, ReleaseStep, TransactionFeedback, TransactionFeedbackFact } from '../../shared/types';
import { shortenAddress } from '../../shared/utils/format';

export const ROYALTY_BPS_DENOMINATOR = 10_000;

/** Ordered release wizard steps. Labels match what the studio renders. */
export const RELEASE_STEPS: Array<{ id: ReleaseStep; label: string }> = [
  { id: 'assets', label: 'Assets' },
  { id: 'metadata', label: 'Details' },
  { id: 'access', label: 'Access' },
  { id: 'review', label: 'Review' }
];

const PUBLICATION_ROADMAP_STEPS = [
  {
    id: 'assets',
    label: 'Protected assets',
    detail: 'Audio, cover, and the encrypted audio reference are ready for the artist runtime.'
  },
  {
    id: 'manifest',
    label: 'Rights manifest',
    detail: 'Release metadata, access policy, and payment split are pinned as the canonical manifest.'
  },
  {
    id: 'registry',
    label: 'Runtime registration',
    detail: 'The artist wallet writes this release into the artist-owned SmartRuntime.'
  },
  {
    id: 'catalog',
    label: 'Catalog read-back',
    detail: 'Dotify refreshes the registry before treating the release as visible.'
  }
] as const;

export type ReleasePublicationStage = (typeof PUBLICATION_ROADMAP_STEPS)[number]['id'] | 'complete';

export type ReleaseValueFlowRow = {
  label: string;
  value: string;
};

function stepIndex(step: ReleaseStep): number {
  const index = RELEASE_STEPS.findIndex(entry => entry.id === step);
  return index === -1 ? 0 : index;
}

/** The next step, clamped at the final step. */
export function nextReleaseStep(current: ReleaseStep): ReleaseStep {
  const next = RELEASE_STEPS[Math.min(RELEASE_STEPS.length - 1, stepIndex(current) + 1)];
  return next.id;
}

/** The previous step, clamped at the first step. */
export function previousReleaseStep(current: ReleaseStep): ReleaseStep {
  const previous = RELEASE_STEPS[Math.max(0, stepIndex(current) - 1)];
  return previous.id;
}

/** A release can reach review once it has a hashed audio file with a title. */
export function canReviewRelease(input: { fileHash: string; title: string; audioSource: string | null }): boolean {
  return Boolean(input.fileHash && input.title.trim() && input.audioSource);
}

/** Total configured royalty basis points, including the artist's primary share. */
export function royaltySplitTotal(primaryBps: number, additionalSplits: Pick<ReleaseRoyaltySplitDraft, 'bps'>[]): number {
  return [primaryBps, ...additionalSplits.map(split => split.bps)].reduce((total, bps) => total + (Number.isFinite(bps) ? Math.max(0, Math.trunc(bps)) : 0), 0);
}

/** Remaining room before the on-chain royalty split reaches 100%. */
export function royaltySplitRemaining(primaryBps: number, additionalSplits: Pick<ReleaseRoyaltySplitDraft, 'bps'>[]): number {
  return ROYALTY_BPS_DENOMINATOR - royaltySplitTotal(primaryBps, additionalSplits);
}

export function releaseRoyaltySplitPreflightError(
  accessMode: AccessMode,
  primaryBps: number,
  additionalSplits: Pick<ReleaseRoyaltySplitDraft, 'bps'>[]
): string | null {
  if (accessMode === 'free') return null;
  const totalBps = royaltySplitTotal(primaryBps, additionalSplits);
  if (totalBps <= 0) return 'Add at least 0.01% to the artist or another rights holder before publishing.';
  if (totalBps > ROYALTY_BPS_DENOMINATOR) return 'Reduce the payment split to 100% or less before publishing.';
  return null;
}

/** Convert on-chain basis points to the percentage users configure. */
export function royaltyBpsToPercent(bps: number): number {
  return Number.isFinite(bps) ? Math.max(0, Math.trunc(bps)) / 100 : 0;
}

/** Convert a user-entered percentage to the on-chain basis-point integer. */
export function royaltyPercentToBps(percent: number): number {
  return Number.isFinite(percent) ? Math.round(Math.max(0, percent) * 100) : 0;
}

export function formatRoyaltyPercent(bps: number): string {
  const percent = royaltyBpsToPercent(bps);
  return `${percent.toFixed(2).replace(/\.?0+$/, '')}%`;
}

export function releasePaymentAmountLabel(accessMode: AccessMode, priceDot: string, nativePaymentSymbol: string): string {
  return accessMode === 'classic' ? `${priceDot.trim() || '0'} ${nativePaymentSymbol}` : 'No listener payment';
}

export function releaseAccessConditionLabel(accessMode: AccessMode, priceDot: string, nativePaymentSymbol: string, personhoodLevel: PersonhoodLevel): string {
  if (accessMode === 'free') return 'Free for everyone; no payment or wallet check is required.';
  if (accessMode === 'human-free') {
    return personhoodLevel === 'DIM2' ? 'Free after extended human verification.' : 'Free after basic human verification.';
  }
  return `${releasePaymentAmountLabel(accessMode, priceDot, nativePaymentSymbol)} before protected audio opens.`;
}

export function buildReleaseValueFlowRows(input: {
  accessMode: AccessMode;
  artistRecipient: string;
  primaryBps: number;
  additionalSplits: ReleaseRoyaltySplitDraft[];
}): ReleaseValueFlowRow[] {
  const artistLabel = input.artistRecipient ? shortenAddress(input.artistRecipient) : 'artist wallet';

  if (input.accessMode === 'free') {
    return [
      {
        label: 'Artist wallet',
        value: `${artistLabel} controls the release; no listener payment is collected.`
      }
    ];
  }

  const rows: ReleaseValueFlowRow[] = [];
  if (input.primaryBps > 0) {
    rows.push({
      label: 'Artist share',
      value: `${formatRoyaltyPercent(input.primaryBps)} to ${artistLabel}`
    });
  }

  for (const split of input.additionalSplits) {
    const hasDraft = split.label.trim() || split.recipient.trim() || split.bps > 0;
    if (!hasDraft) continue;
    rows.push({
      label: split.label.trim() || 'Rights holder',
      value: `${formatRoyaltyPercent(split.bps)} to ${split.recipient.trim() ? shortenAddress(split.recipient.trim()) : 'address needed'}`
    });
  }

  const totalBps = royaltySplitTotal(input.primaryBps, input.additionalSplits);
  if (totalBps <= 0) {
    return [
      {
        label: 'Payment split',
        value: 'Add at least 0.01% to the artist or another rights holder before publishing.'
      }
    ];
  }
  const remainderBps = ROYALTY_BPS_DENOMINATOR - totalBps;
  if (remainderBps > 0) {
    rows.push({
      label: 'Artist remainder',
      value: `${formatRoyaltyPercent(remainderBps)} also returns to ${artistLabel}`
    });
  }
  if (totalBps > ROYALTY_BPS_DENOMINATOR) {
    rows.push({
      label: 'Split issue',
      value: 'Reduce shares to 100% or less before publishing.'
    });
  }

  return rows.length > 0
    ? rows
    : [
        {
          label: 'Payment split',
          value: 'Add at least one positive share before publishing.'
        }
      ];
}

export function buildReleasePublicationFacts(input: {
  accessMode: AccessMode;
  priceDot: string;
  nativePaymentSymbol: string;
  personhoodLevel: PersonhoodLevel;
  artistRecipient: string;
  runtimeAddress: string | null;
  uploadToBulletinEnabled: boolean;
}): TransactionFeedbackFact[] {
  return [
    {
      label: 'Controller',
      value: input.artistRecipient ? `Artist wallet ${shortenAddress(input.artistRecipient)}` : 'Connect the artist wallet'
    },
    {
      label: 'Runtime',
      value: input.runtimeAddress ? shortenAddress(input.runtimeAddress) : 'Artist runtime required before publish',
      code: Boolean(input.runtimeAddress)
    },
    {
      label: 'Access',
      value: releaseAccessConditionLabel(input.accessMode, input.priceDot, input.nativePaymentSymbol, input.personhoodLevel)
    },
    {
      label: 'Total support',
      value: releasePaymentAmountLabel(input.accessMode, input.priceDot, input.nativePaymentSymbol)
    },
    {
      label: 'Network fee',
      value: 'Shown by the wallet or Product host before signing.'
    },
    {
      label: 'Catalog visibility',
      value: 'Only after the registry transaction and catalog read-back confirm the release.'
    },
    {
      label: 'Public archive',
      value: input.uploadToBulletinEnabled ? 'Bulletin archival enabled' : 'Bulletin archival off'
    }
  ];
}

export function buildReleasePublicationRoadmap(stage: ReleasePublicationStage, txHash?: `0x${string}`): TransactionFeedback['steps'] {
  const activeIndex = stage === 'complete' ? PUBLICATION_ROADMAP_STEPS.length : PUBLICATION_ROADMAP_STEPS.findIndex(step => step.id === stage);
  const boundedIndex = activeIndex < 0 ? 0 : activeIndex;

  return PUBLICATION_ROADMAP_STEPS.map((step, index) => {
    const isComplete = stage === 'complete' || index < boundedIndex;
    const isActive = index === boundedIndex;
    const status = isComplete ? 'complete' : isActive && step.id === 'registry' && txHash ? 'submitted' : isActive ? 'active' : 'upcoming';

    return {
      label: step.label,
      detail: step.detail,
      status,
      txHash: step.id === 'registry' && (isComplete || status === 'submitted') ? txHash : undefined
    };
  });
}

export function buildReleaseRegistrationFailureMessage(input: { error: string; submittedTxHash?: `0x${string}`; registrationConfirmed?: boolean }): string {
  if (input.submittedTxHash && input.registrationConfirmed) {
    return `The registration transaction was submitted, but Dotify did not confirm catalog visibility yet: ${input.error} Keep this transaction hash and refresh the catalog before retrying. Dotify will not mark the release as published until catalog read-back includes it.`;
  }
  if (input.submittedTxHash) {
    return `The registration transaction was submitted, but Dotify did not confirm finality: ${input.error} Keep this transaction hash and verify the runtime registration before retrying. Dotify will not mark the release as published until runtime registration and catalog read-back both confirm it.`;
  }
  return `No release was published. Asset uploads and manifest pinning can be retried from this draft without changing the artist runtime: ${input.error}`;
}

export type ArtistSetupState = 'Ready' | 'Registration needed' | 'Wallet needed';

/** Artist onboarding state: needs a wallet, then a runtime, then ready. */
export function artistSetupState(hasWallet: boolean, hasRuntime: boolean): ArtistSetupState {
  if (!hasWallet) return 'Wallet needed';
  return hasRuntime ? 'Ready' : 'Registration needed';
}

/**
 * The studio is locked (publishing disabled) when registration is available but
 * the connected wallet has no artist runtime yet.
 */
export function artistStudioLocked(registrationAvailable: boolean, hasRuntime: boolean): boolean {
  return registrationAvailable && !hasRuntime;
}
