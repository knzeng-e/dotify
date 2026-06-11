// ── Living Light background ─────────────────────────────────────────────────────
// Replaces the old node/starfield canvas. The whole screen is bathed in the light
// of whatever is playing: soft drifting aura halos driven by the --aura-* variables
// (set per track by the aura engine), plus a fine grain so the gradients never band.

export function AuraBackground() {
  return (
    <>
      <div className='aura-bg' aria-hidden='true' />
      <div className='grain' aria-hidden='true' />
    </>
  );
}
