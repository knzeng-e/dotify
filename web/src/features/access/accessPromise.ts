import type { AccessGate, CatalogTrack, TransactionFeedback } from '../../shared/types';
import { shortenAddress } from '../../shared/utils/format';
import { nativeRuntimeAmountLabel, type DotifyNativeRuntimeAsset } from '../payments/paymentModel';

type RuntimeAssetShape = Pick<DotifyNativeRuntimeAsset, 'symbol'>;

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
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;
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
    supportAmount: nativeRuntimeAmountLabel(track.priceDot, nativePaymentAsset),
    terms: [
      {
        label: 'You receive',
        value: 'A paid Classic access record for this wallet'
      },
      {
        label: 'Playback condition',
        value: 'Full audio opens only while the release remains active and the runtime confirms access'
      },
      {
        label: 'Availability',
        value: 'No fixed expiry is written here, but this is not a perpetual media availability guarantee'
      }
    ],
    recipients,
    settlementNote: 'The artist-owned runtime applies this split when the support transaction is confirmed.'
  };
}

export function buildAccessGate(input: { track: CatalogTrack; connected: boolean; nativePaymentAsset: RuntimeAssetShape }): AccessGate {
  const { track, connected, nativePaymentAsset } = input;
  const supportAmount = nativeRuntimeAmountLabel(track.priceDot, nativePaymentAsset);

  if (track.active === false) {
    return {
      track,
      title: 'Release unavailable',
      message: `"${track.title}" is inactive in the artist runtime. A payment record is not a guarantee of perpetual media availability.`,
      hint: 'No payment will be sent. If the artist reactivates the release, Dotify can check access again.',
      actionType: 'none'
    };
  }

  if (!connected) {
    if (track.accessMode === 'classic') {
      return {
        track,
        title: 'Support and open this track',
        message: `"${track.title}" opens for ${supportAmount} after the runtime confirms access for this wallet.`,
        hint: 'Nothing is sent until you confirm.',
        actionType: 'signin'
      };
    }
    return {
      track,
      title: 'Verification needed',
      message: `"${track.title}" is free for verified humans.`,
      hint: 'Dotify only checks whether access should open.',
      actionType: 'signin'
    };
  }

  if (track.accessMode === 'human-free') {
    return {
      track,
      title: 'Verification needed',
      message: `"${track.title}" is free for verified humans while the release remains active.`,
      hint: 'No profile is created for this check.',
      actionType: 'personhood'
    };
  }

  return {
    track,
    title: 'Support and open this track',
    message: `"${track.title}" opens after ${supportAmount} of support and a fresh runtime access check.`,
    hint: 'The artist-owned runtime distributes the confirmed amount before Dotify opens protected audio.',
    actionType: 'payment'
  };
}

export function buildClassicAccessVerifiedFeedback(track: CatalogTrack, txHash: `0x${string}`): TransactionFeedback {
  return {
    tone: 'success',
    title: 'Access verified',
    message: `Payment confirmed. Full listening for "${track.title}" is available to this wallet while the release remains active and runtime policy continues to grant access.`,
    txHash
  };
}

export function buildIncludedPaymentUnverifiedMessage(input: { attempts: number; error: string; productCdm: boolean }): string {
  const base = `The payment transaction was included, but Dotify could not verify playable runtime access after ${input.attempts} read-back attempts: ${input.error} Your payment record may still exist, but Dotify will not open protected audio until the runtime confirms access.`;
  if (!input.productCdm) return base;
  return `${base} Keep Product writes disabled until native value forwarding and account mapping are verified in the Product host.`;
}
