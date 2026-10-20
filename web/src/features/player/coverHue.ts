// Quantized chromatic pixels keep neutral borders and transparent artwork from
// overwhelming the cover's color. This affects decoration, never text colors.
export function dominantCoverHue(pixels: ArrayLike<number>): number | null {
  const bins = new Array<number>(24).fill(0);
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 192) continue;
    const r = pixels[i] / 255;
    const g = pixels[i + 1] / 255;
    const b = pixels[i + 2] / 255;
    const max = Math.max(r, g, b);
    const delta = max - Math.min(r, g, b);
    if (max < 0.12 || delta / max < 0.15) continue;
    const sector = max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
    const hue = (sector * 60 + 360) % 360;
    bins[Math.round(hue / 15) % 24] += delta;
  }
  const strongest = Math.max(...bins);
  return strongest > 0 ? bins.indexOf(strongest) * 15 : null;
}
