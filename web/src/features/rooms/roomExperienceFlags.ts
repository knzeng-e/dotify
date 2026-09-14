// Build-time opt-ins. Unset, misspelled, and "off" values keep experiments out
// of the shipped experience; no URL or localStorage switch enables them.
export const roomExperienceFlags = {
  galaxy: import.meta.env.VITE_DOTIFY_ROOM_GALAXY === 'on',
  hostLineup: import.meta.env.VITE_DOTIFY_HOST_LINEUP === 'on'
};
