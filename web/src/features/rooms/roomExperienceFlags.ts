// Nearby is part of both Web and Product by default. Explicit off (or an
// invalid value) disables it operationally; user location consent stays separate.
// Galaxy remains an experiment. No URL/localStorage override changes either.
export const roomExperienceFlags = {
  nearby: (import.meta.env.VITE_DOTIFY_NEARBY ?? 'on') === 'on',
  galaxy: import.meta.env.VITE_DOTIFY_ROOM_GALAXY === 'on'
};
