// Nearby is available by default. Operational rollback is separate from consent.
export const roomExperienceFlags = {
  nearby: (import.meta.env.VITE_DOTIFY_NEARBY ?? 'on') === 'on'
};
