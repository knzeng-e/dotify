// Bound pre-description trickle ICE independently of server-side rate limits.
// This exceeds the current 24-listener default while keeping one page finite.
const MAX_PEERS = 64;
const MAX_PER_PEER = 128;
const MAX_TOTAL = 512;

export function queuePendingIce(pending: Map<string, RTCIceCandidateInit[]>, peerId: string, candidate: RTCIceCandidateInit): boolean {
  if (
    !candidate ||
    typeof candidate !== 'object' ||
    Array.isArray(candidate) ||
    typeof candidate.candidate !== 'string' ||
    candidate.candidate.length > 4096 ||
    (candidate.sdpMid != null && (typeof candidate.sdpMid !== 'string' || candidate.sdpMid.length > 256)) ||
    (candidate.sdpMLineIndex != null && (!Number.isInteger(candidate.sdpMLineIndex) || candidate.sdpMLineIndex < 0 || candidate.sdpMLineIndex > 65535)) ||
    (candidate.usernameFragment != null && (typeof candidate.usernameFragment !== 'string' || candidate.usernameFragment.length > 256))
  )
    return false;
  const list = pending.get(peerId) ?? [];
  if (
    (!pending.has(peerId) && pending.size >= MAX_PEERS) ||
    list.length >= MAX_PER_PEER ||
    [...pending.values()].reduce((sum, items) => sum + items.length, 0) >= MAX_TOTAL ||
    list.some(
      item =>
        item.candidate === candidate.candidate &&
        item.sdpMid === candidate.sdpMid &&
        item.sdpMLineIndex === candidate.sdpMLineIndex &&
        item.usernameFragment === candidate.usernameFragment
    )
  )
    return false;
  // Keep only bounded browser fields; never retain arbitrary socket properties.
  list.push({ candidate: candidate.candidate, sdpMid: candidate.sdpMid, sdpMLineIndex: candidate.sdpMLineIndex, usernameFragment: candidate.usernameFragment });
  pending.set(peerId, list);
  return true;
}
