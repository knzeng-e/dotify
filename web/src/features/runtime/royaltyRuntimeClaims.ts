import { getAddress } from 'viem';
import { runtimeAddressFromTrackId } from '../catalog/trackModel';
import type { CatalogTrack, RoyaltyRuntimeSummary } from '../../shared/types';

type RuntimeCandidate = Omit<RoyaltyRuntimeSummary, 'claimableWei'>;

export function listKnownRoyaltyRuntimeCandidates(
  tracks: CatalogTrack[],
  recipientAddress: `0x${string}`,
  ownRuntimeAddress: `0x${string}` | null
): RuntimeCandidate[] {
  const recipient = recipientAddress.toLowerCase();
  const ownRuntime = ownRuntimeAddress?.toLowerCase() ?? null;
  const candidates = new Map<string, RuntimeCandidate>();

  function ensureCandidate(runtimeAddress: `0x${string}`, patch: Partial<RuntimeCandidate> = {}): RuntimeCandidate {
    const normalizedRuntime = getAddress(runtimeAddress);
    const key = normalizedRuntime.toLowerCase();
    const current =
      candidates.get(key) ??
      ({
        runtimeAddress: normalizedRuntime,
        artistName: 'Unknown artist',
        trackCount: 0,
        trackTitles: []
      } satisfies RuntimeCandidate);

    const next = {
      ...current,
      ...patch,
      artistName: patch.artistName?.trim() || current.artistName,
      trackTitles: [...current.trackTitles]
    };
    candidates.set(key, next);
    return next;
  }

  if (ownRuntimeAddress) ensureCandidate(ownRuntimeAddress);

  for (const track of tracks) {
    const runtimeAddress = runtimeAddressFromTrackId(track);
    if (!runtimeAddress) continue;

    const isOwnRuntime = ownRuntime === runtimeAddress.toLowerCase();
    const isRecipient = track.royaltySplits.some(split => split.recipient.toLowerCase() === recipient);
    if (!isOwnRuntime && !isRecipient) continue;

    const candidate = ensureCandidate(runtimeAddress, {
      artistAddress: track.artistAddress,
      artistName: track.artist
    });
    candidate.trackCount += 1;
    if (!candidate.trackTitles.includes(track.title)) {
      candidate.trackTitles.push(track.title);
    }
  }

  return Array.from(candidates.values()).sort((left, right) => {
    const leftPendingSignals = left.trackCount > 0 ? 0 : 1;
    const rightPendingSignals = right.trackCount > 0 ? 0 : 1;
    if (leftPendingSignals !== rightPendingSignals) return leftPendingSignals - rightPendingSignals;
    return left.runtimeAddress.localeCompare(right.runtimeAddress);
  });
}
