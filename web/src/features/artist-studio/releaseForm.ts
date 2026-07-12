// Artist studio - release-form step machine and studio-state derivations.
//
// Pure rules pulled out of App.tsx (and de-duplicated with NewReleaseTab's local
// step list) so the wizard navigation and gating are testable in isolation.

import type { ReleaseRoyaltySplitDraft, ReleaseStep } from '../../shared/types';

export const ROYALTY_BPS_DENOMINATOR = 10_000;

/** Ordered release wizard steps. Labels match what the studio renders. */
export const RELEASE_STEPS: Array<{ id: ReleaseStep; label: string }> = [
  { id: 'assets', label: 'Assets' },
  { id: 'metadata', label: 'Details' },
  { id: 'access', label: 'Access' },
  { id: 'review', label: 'Review' }
];

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
  return `${percent.toFixed(percent % 1 === 0 ? 0 : 2)}%`;
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
