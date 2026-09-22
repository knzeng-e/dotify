// Artist studio - release-form step machine and studio-state derivations.
//
// Pure rules pulled out of App.tsx (and de-duplicated with NewReleaseTab's local
// step list) so the wizard navigation and gating are testable in isolation.

import type { AccessMode, PersonhoodLevel, ReleaseRoyaltySplitDraft, ReleaseStep, TransactionFeedback, TransactionFeedbackFact } from '../../shared/types';
import { shortenAddress } from '../../shared/utils/format';

export const ROYALTY_BPS_DENOMINATOR = 10_000;

/** Ordered release wizard steps. Labels match what the studio renders. */
export const RELEASE_STEPS: Array<{ id: ReleaseStep; label: string }> = [
  { id: 'assets', label: 'Music' },
  { id: 'metadata', label: 'Details' },
  { id: 'access', label: 'Listening' },
  { id: 'review', label: 'Review' }
];

const PUBLICATION_ROADMAP_STEPS = [
  {
    id: 'assets',
    label: 'Music ready',
    detail: 'Audio and cover are protected and ready.'
  },
  {
    id: 'manifest',
    label: 'Release details',
    detail: 'The title, listening access, and support split are saved with the release.'
  },
  {
    id: 'registry',
    label: 'Publication approval',
    detail: 'Your connected artist account approves the release.'
  },
  {
    id: 'catalog',
    label: 'Visible in Dotify',
    detail: 'Dotify checks the catalog before showing the release as published.'
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
  if (input.accessMode === 'free') {
    return [
      {
        label: 'Support',
        value: 'No listener payment is collected for this release.'
      }
    ];
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
  const rows: ReleaseValueFlowRow[] = [];
  const artistEffectiveBps = input.primaryBps + Math.max(0, remainderBps);
  if (artistEffectiveBps > 0) {
    rows.push({
      label: 'You receive',
      value: formatRoyaltyPercent(artistEffectiveBps)
    });
  }
  for (const split of input.additionalSplits) {
    const hasDraft = split.label.trim() || split.recipient.trim() || split.bps > 0;
    if (!hasDraft) continue;
    rows.push({
      label: split.label.trim() || 'Rights holder',
      value: split.bps > 0 ? `${formatRoyaltyPercent(split.bps)} receives support` : 'Add a share before publishing'
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
      label: 'Listening access',
      value: releaseAccessConditionLabel(input.accessMode, input.priceDot, input.nativePaymentSymbol, input.personhoodLevel)
    },
    {
      label: 'Total support',
      value: releasePaymentAmountLabel(input.accessMode, input.priceDot, input.nativePaymentSymbol)
    },
    {
      label: 'Network fee',
      value: 'Shown on your confirmation screen before approval.'
    },
    {
      label: 'Published when',
      value: 'Your approval is confirmed and Dotify can see the release in the catalog.'
    }
  ];
}

export function buildReleaseTechnicalFacts(input: {
  artistRecipient: string;
  runtimeAddress: string | null;
  uploadToBulletinEnabled: boolean;
  additionalSplits?: ReleaseRoyaltySplitDraft[];
}): TransactionFeedbackFact[] {
  const facts: TransactionFeedbackFact[] = [
    {
      label: 'Artist account',
      value: input.artistRecipient ? shortenAddress(input.artistRecipient) : 'Connect the artist account',
      code: Boolean(input.artistRecipient)
    },
    {
      label: 'Artist space record',
      value: input.runtimeAddress ? shortenAddress(input.runtimeAddress) : 'Required before publication',
      code: Boolean(input.runtimeAddress)
    },
    {
      label: 'Release storage',
      value: 'Protected audio and release details use IPFS-backed references.'
    },
    {
      label: 'Public archive',
      value: input.uploadToBulletinEnabled ? 'Bulletin archival enabled' : 'Bulletin archival off'
    }
  ];

  for (const split of input.additionalSplits ?? []) {
    if (!split.recipient.trim()) continue;
    facts.push({
      label: `${split.label.trim() || 'Rights holder'} address`,
      value: shortenAddress(split.recipient.trim()),
      code: true
    });
  }

  return facts;
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
    return `Your publication approval was confirmed, but Dotify cannot see the release in the catalog yet: ${input.error} Keep the proof reference and refresh before retrying. Dotify will not call the release published until it appears in the catalog.`;
  }
  if (input.submittedTxHash) {
    return `Your publication approval was submitted, but confirmation did not finish: ${input.error} Keep the proof reference and check your account activity before retrying. Dotify will not submit another release automatically.`;
  }
  return `No release was published. Your music and draft are still here, so you can retry: ${input.error}`;
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
