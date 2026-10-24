// Nearby is part of both Web and Product by default. Explicit off (or an
// invalid value) disables it operationally; user location consent stays separate.
// The optional 3D choice is available by default; Radar remains the initial
// view. Explicit off/invalid disables 3D operationally. No URL/storage bypass.
export const roomExperienceFlags = {
  nearby: (import.meta.env.VITE_DOTIFY_NEARBY ?? 'on') === 'on',
  galaxy: (import.meta.env.VITE_DOTIFY_ROOM_GALAXY ?? 'on') === 'on'
};
