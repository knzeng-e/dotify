// Normalize zoom before comparing visible height with the pre-edit layout.
// A pinch zoom alone must not look like a software keyboard.
export const roomComposerSelector = '.room-chat-form input, .room-chat-form textarea, .room-request-search-form input, .host-lineup input';

export function keyboardOccludesRoom(baselineHeight: number, visibleHeight: number, scale: number): boolean {
  if (![baselineHeight, visibleHeight, scale].every(Number.isFinite) || scale <= 0) return false;
  return baselineHeight - visibleHeight * scale > 120;
}
