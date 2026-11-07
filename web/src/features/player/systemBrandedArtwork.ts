import { dotifyClefPath, dotifyOrbit } from '../../shared/branding/dotifyMarkGeometry';

/** A cover-first signature that survives the small native player size. No room text. */
export function drawSystemBrandedArtwork(context: CanvasRenderingContext2D, cover: CanvasImageSource) {
  context.fillStyle = '#081c30';
  context.fillRect(0, 0, 640, 640);
  context.save();
  context.beginPath();
  context.roundRect(24, 24, 592, 592, 40);
  context.clip();
  context.drawImage(cover, 24, 24, 592, 592);
  context.restore();
  // A larger complete mark on an opaque badge stays legible over light or busy covers.
  // Keep the original logo geometry; only the decorative outer petals are removed.
  context.save();
  context.translate(534, 534);
  context.fillStyle = '#081c30';
  context.beginPath();
  context.arc(0, 0, 78, 0, 2 * Math.PI);
  context.fill();
  context.strokeStyle = 'rgba(241, 247, 251, 0.28)';
  context.lineWidth = 2;
  context.stroke();
  context.translate(-60, -60);
  context.scale(120 / 48, 120 / 48);
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
