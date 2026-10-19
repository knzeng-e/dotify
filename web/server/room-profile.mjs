import { exactKeys } from '../shared/nearby-v2.mjs';
// Public invitation text is optional and ephemeral. Only the room host writes it.
export function roomProfile(value) {
  if (
    !exactKeys(value, ['name', 'introduction']) ||
    typeof value.name !== 'string' ||
    typeof value.introduction !== 'string' ||
    value.name.length > 60 ||
    value.introduction.length > 240
  )
    return null;
  const clean = text =>
    text
      .replace(/\p{Cc}/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  return { name: clean(value.name), introduction: clean(value.introduction) };
}
export function announcedArtistPresent(room) {
  const track = room.track;
  if (!track?.runtimeAddress || !track.hash) return false;
  return [...(room.lifeMembers?.values() ?? [])].some(
    member =>
      member.socketId &&
      room.listeners.has(member.socketId) &&
      member.artist &&
      member.artist.runtime.toLowerCase() === track.runtimeAddress.toLowerCase() &&
      member.artist.hash.toLowerCase() === track.hash.toLowerCase()
  );
}
