// Capture/duration updates and canonical runtime enrichment are not new songs.
export function sameRoomTrack(a, b) {
  if (!a || !b) return false;
  const sameRelease = a.hash ? a.hash.toLowerCase() === b.hash?.toLowerCase() : a.title === b.title && a.artist === b.artist;
  return Boolean(sameRelease && (!a.runtimeAddress || !b.runtimeAddress || a.runtimeAddress.toLowerCase() === b.runtimeAddress.toLowerCase()));
}
