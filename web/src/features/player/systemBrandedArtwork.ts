import { dotifyClefPath, dotifyOrbit } from '../../shared/branding/dotifyMarkGeometry';

/** A cover-first signature that survives the small native player size. No room text. */
export function drawSystemBrandedArtwork(context: CanvasRenderingContext2D, cover: CanvasImageSource) {
  context.fillStyle = '#081c30';
  context.fillRect(0, 0, 640, 640);
  // Echo the six petals of the actual mark around an intact, inset cover.
  context.fillStyle = '#e6007a';
  for (const [cx, cy, rx, ry, angle] of dotifyOrbit) {
    const x = cx === 24 ? 320 : cx < 24 ? 46 : 594;
    const y = cy === 5 ? 37 : cy === 43 ? 603 : cy < 24 ? 170 : 470;
    context.beginPath();
    context.ellipse(x, y, rx * 6, ry * 6, (angle * Math.PI) / 180, 0, 2 * Math.PI);
    context.fill();
  }
  context.save();
  context.beginPath();
  context.roundRect(94, 94, 452, 452, 44);
  context.clip();
  context.drawImage(cover, 94, 94, 452, 452);
  context.restore();
  // A compact complete mark, rather than typography or changing room counts.
  context.save();
  context.translate(532, 532);
  context.fillStyle = '#081c30';
  context.beginPath();
  context.arc(0, 0, 45, 0, 2 * Math.PI);
  context.fill();
  context.translate(-34, -34);
  context.scale(68 / 48, 68 / 48);
  context.fillStyle = '#e6007a';
  for (const [cx, cy, rx, ry, angle] of dotifyOrbit) {
    context.beginPath();
    context.ellipse(cx, cy, rx, ry, (angle * Math.PI) / 180, 0, 2 * Math.PI);
    context.fill();
  }
  context.fillStyle = '#f1f7fb';
  context.translate(24, 24);
  context.scale(0.0059, 0.0059);
  context.translate(-1903.5, -7641);
  context.fill(new Path2D(dotifyClefPath));
  context.restore();
}
