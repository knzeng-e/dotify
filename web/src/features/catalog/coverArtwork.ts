import { auraForTrack } from '../../shared/utils/aura';

export const COVER_GATEWAY_TIMEOUT_MS = 1_200;

export function shouldArmCoverGatewayTimeout(loading: string | undefined, isInLoadRange: boolean): boolean {
  return loading !== 'lazy' || isInLoadRange;
}

function escapeSvgText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function createCoverFallbackDataUri(label = 'Dotify', seed = label): string {
  const displayLabel = label.trim() || 'Dotify';
  const aura = auraForTrack({ id: seed || displayLabel, title: displayLabel });
  const safeLabel = escapeSvgText(displayLabel);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640"><defs><radialGradient id="a" cx="26%" cy="18%" r="78%"><stop offset="0" stop-color="${aura.a}"/><stop offset=".58" stop-color="#071326"/><stop offset="1" stop-color="#050D1A"/></radialGradient><filter id="g"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter></defs><rect width="640" height="640" fill="url(#a)"/><circle cx="492" cy="122" r="220" fill="${aura.b}" opacity=".68"/><circle cx="154" cy="520" r="204" fill="${aura.accent}" opacity=".54"/><circle cx="322" cy="324" r="184" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="2"/><path d="M232 241c0-25 20-45 45-45h98v62h-70v132c0 34-28 62-62 62s-62-28-62-62 28-62 62-62c13 0 25 4 35 11v-98h-46Z" fill="#fff" opacity=".9"/><text x="48" y="112" fill="#fff" font-family="Hanken Grotesk,system-ui,sans-serif" font-size="42" font-weight="800">${safeLabel}</text><rect width="640" height="640" filter="url(#g)" opacity=".08"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
