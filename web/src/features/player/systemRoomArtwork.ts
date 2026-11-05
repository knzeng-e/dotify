import { dotifyClefPath, dotifyOrbit } from '../../shared/branding/dotifyMarkGeometry';
import type { SystemRoomContext } from './systemRoomContext';

function fitText(context: CanvasRenderingContext2D, input: string, width: number): string {
  if (context.measureText(input).width <= width) return input;
  const characters = Array.from(input);
  while (characters.length && context.measureText(characters.join('') + '…').width > width) characters.pop();
  return characters.join('') + '…';
}

/** Native artwork is square. Frame the full cover; put context in a separate footer. */
export function drawSystemRoomArtwork(context: CanvasRenderingContext2D, cover: CanvasImageSource, room: SystemRoomContext) {
  context.fillStyle = '#081c30';
  context.fillRect(0, 0, 640, 640);
  // Full square cover as prepared by the existing artwork resolver. The footer
  // does not paint over artist artwork and never changes the original asset.
  context.drawImage(cover, 64, 12, 512, 512);
  context.save();
  context.translate(26, 542);
  context.scale(1.15, 1.15);
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
  context.textAlign = 'left';
  context.fillStyle = '#f1f7fb';
  context.font = '700 42px sans-serif';
  context.fillText('Dotify', 96, 582);
  context.textAlign = 'right';
  context.fillStyle = '#69e0d0';
  context.font = '600 30px sans-serif';
  context.fillText(fitText(context, room.presence, 260), 612, 582);
  context.textAlign = 'left';
  context.fillStyle = '#c8d8e7';
  context.font = '500 23px sans-serif';
  context.fillText(fitText(context, `${room.label} · ${room.attribution}`, 584), 28, 620);
}
