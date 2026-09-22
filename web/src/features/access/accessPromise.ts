import { formatEther } from 'viem';
import type { AccessGate, CatalogTrack, TransactionFeedback, TransactionFeedbackFact } from '../../shared/types';
import { shortenAddress } from '../../shared/utils/format';
import { nativeRuntimeAmountLabel, type DotifyNativeRuntimeAsset } from '../payments/paymentModel';

type RuntimeAssetShape = Pick<DotifyNativeRuntimeAsset, 'symbol'>;
type ClassicSupportStatus = 'pending' | 'confirmed' | 'included-unverified' | 'failed' | 'canceled';

export type ClassicReceiptRow = {
  label: string;
  value: string;
};

export type ClassicAccessReceipt = {
  supportAmount: string;
  terms: ClassicReceiptRow[];
  recipients: ClassicReceiptRow[];
  settlementNote: string;
};

function royaltyPercentLabel(bps: number): string {
  return `${(bps / 100).toFixed(2).replace(/\.?0+$/, '')}%`;
}

export function buildClassicAccessReceipt(track: CatalogTrack, nativePaymentAsset: RuntimeAssetShape): ClassicAccessReceipt {
  const configuredSplitBps = track.royaltySplits.reduce((total, split) => total + split.bps, 0);
  const artistRemainderBps = Math.max(0, 10_000 - configuredSplitBps);
  const recipients = track.royaltySplits.map((split, index) => ({
    label: split.label || `Collaborator ${index + 1}`,
    value: `${royaltyPercentLabel(split.bps)} to ${shortenAddress(split.recipient)}`
  }));

  if (artistRemainderBps > 0) {
    recipients.push({
      label: 'Original artist remainder',
      value: `${royaltyPercentLabel(artistRemainderBps)}${track.artistAddress ? ` to ${shortenAddress(track.artistAddress)}` : ''}`
    });
  }

  return {
    supportAmount: nativeRuntimeAmountLabel(track.pricePlanck === undefined ? track.priceDot : formatEther(track.pricePlanck), nativePaymentAsset),
    terms: [
      {
        label: 'You receive',
        value: 'A listening access record for this account'
      },
      {
        label: 'Playback condition',
        value: 'Full listening opens after payment is confirmed and the access check passes'
      },
      {
        label: 'Availability',
        value: 'The support record has no fixed expiry, but the artist may later withdraw the release'
      }
    ],
    recipients,
    settlementNote: 'Your support follows this split when confirmation completes.'
  };
}

export function buildClassicSupportFacts(
  track: CatalogTrack,
  nativePaymentAsset: RuntimeAssetShape,
  status: ClassicSupportStatus = 'pending'
): TransactionFeedbackFact[] {
  const receipt = buildClassicAccessReceipt(track, nativePaymentAsset);
  const recipients = receipt.recipients.map(row => `${row.label}: ${row.value}`).join('; ') || 'Artist’s published recipient list';
  const accessValue =
    status === 'confirmed'
      ? 'Listening access is verified for this account while the release remains available.'
      : status === 'included-unverified'
        ? 'Protected audio stays closed until the access check passes.'
        : 'Full listening opens only after the access check passes.';
  const settlementValue =
    status === 'confirmed'
      ? 'Support was accepted; each share is settled now or available for its recipient to claim.'
      : status === 'included-unverified'
        ? 'Payment may be recorded, but Dotify has not confirmed playable access.'
        : status === 'canceled'
          ? 'No support transaction was completed from this attempt.'
          : status === 'failed'
            ? 'No completed support is recorded by Dotify from this attempt.'
            : 'Pending until the transaction is included and verified.';

  return [
    { label: 'Amount', value: receipt.supportAmount },
    { label: 'Access', value: accessValue },
    { label: 'Recipients', value: recipients },
    { label: 'Settlement', value: settlementValue },
    { label: 'Confirmation fee', value: 'Shown before you approve.' }
  ];
}

export function buildAccessGate(input: { track: CatalogTrack; connected: boolean; nativePaymentAsset: RuntimeAssetShape }): AccessGate {
  const { track, connected, nativePaymentAsset } = input;
  const supportAmount = nativeRuntimeAmountLabel(track.pricePlanck === undefined ? track.priceDot : formatEther(track.pricePlanck), nativePaymentAsset);

  if (track.active === false) {
    return {
      track,
      title: 'Release unavailable',
      message: `"${track.title}" is currently unavailable. Previous support does not guarantee that a release remains online forever.`,
      hint: 'No payment will be sent. If the artist brings it back, Dotify can check your access again.',
      actionType: 'none'
    };
  }

  if (!connected) {
    if (track.accessMode === 'classic') {
      return {
        track,
        title: 'Support and open this track',
        message: `"${track.title}" opens after ${supportAmount} of support. Review who receives it, then choose how to confirm.`,
        hint: 'Nothing is sent until you confirm.',
        actionType: 'signin'
      };
    }
    return {
      track,
      title: 'Verification needed',
      message: `"${track.title}" is free for verified humans. Connect to check your eligibility.`,
      hint: 'No payment is required for this check.',
      actionType: 'signin'
    };
  }

  if (track.accessMode === 'human-free') {
    return {
      track,
      title: 'Verification needed',
      message: `"${track.title}" is free for verified humans while the release remains active.`,
      hint: 'No payment is required. Dotify only checks whether listening should open.',
      actionType: 'personhood'
    };
  }

  return {
    track,
    title: 'Support and open this track',
    message: `"${track.title}" opens after ${supportAmount} of support. Dotify checks your listening access again after confirmation.`,
    hint: 'Nothing is sent until you confirm.',
    actionType: 'payment'
  };
}

export function buildClassicAccessVerifiedFeedback(
  track: CatalogTrack,
  txHash: `0x${string}` | undefined,
  nativePaymentAsset: RuntimeAssetShape = { symbol: 'native token' }
): TransactionFeedback {
  return {
    tone: 'success',
    title: 'Access verified',
    message: `Payment confirmed. Full listening for "${track.title}" is available to this account while the release remains available and access continues to be granted.`,
    txHash,
    facts: buildClassicSupportFacts(track, nativePaymentAsset, 'confirmed')
  };
}

export function buildIncludedPaymentUnverifiedMessage(input: { attempts: number; error: string; productCdm: boolean }): string {
  const base = `The payment was included, but Dotify could not verify listening access after ${input.attempts} checks: ${input.error} Your payment record may still exist, but protected audio stays closed until access is confirmed.`;
  if (!input.productCdm) return base;
  return `${base} Check your account activity in Polkadot app before trying again.`;
}

export function isUserRejectedSupportError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /\b4001\b|user rejected|request rejected|denied|cancelled|canceled/i.test(message);
}
