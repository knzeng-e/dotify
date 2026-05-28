import { useEffect, useRef } from 'react';

type Node = {
  x: number;
  y: number;
  r: number;
  color: string;
  phase: number;
};

const NODES: Node[] = [
  { x: 0.5,  y: 0.22, r: 18, color: '#2bb3ff', phase: 0   },
  { x: 0.2,  y: 0.56, r: 12, color: '#c8ff4d', phase: 1.2 },
  { x: 0.8,  y: 0.56, r: 12, color: '#c8ff4d', phase: 2.4 },
  { x: 0.5,  y: 0.75, r: 11, color: '#e8c86a', phase: 3.1 },
];

const CONNECTIONS: [number, number][] = [
  [0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3],
];

export function AmbientCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    let raf: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const { width: W, height: H } = canvas;
      ctx.clearRect(0, 0, W, H);

      const cx = W * 0.5;
      const cy = H * 0.42;
      const spread = Math.min(W, H) * 0.28;

      const pos = NODES.map(n => ({
        x: cx + (n.x - 0.5) * spread * 2.2,
        y: cy + (n.y - 0.5) * spread * 1.6,
      }));

      // Connection lines
      CONNECTIONS.forEach(([i, j]) => {
        const a = NODES[i]; const b = NODES[j];
        const isArtist = a.color === '#e8c86a' || b.color === '#e8c86a';
        ctx.beginPath();
        ctx.moveTo(pos[i].x, pos[i].y);
        ctx.lineTo(pos[j].x, pos[j].y);
        ctx.strokeStyle = isArtist ? 'rgba(232,200,106,0.18)' : 'rgba(43,179,255,0.14)';
        ctx.lineWidth = isArtist ? 1 : 1.5;
        ctx.stroke();
      });

      // Nodes
      NODES.forEach((n, i) => {
        const pulse = 1 + Math.sin(frame * 0.022 + n.phase) * 0.08;
        const { x, y } = pos[i];
        const r = n.r * pulse;

        // Outer glow ring
        ctx.beginPath();
        ctx.arc(x, y, r * 1.9, 0, Math.PI * 2);
        ctx.fillStyle = n.color + '12';
        ctx.fill();

        // Node body
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.shadowColor = n.color;
        ctx.shadowBlur = 14;
        ctx.fillStyle = n.color + '22';
        ctx.fill();
        ctx.shadowBlur = 0;

        // Centre dot
        ctx.beginPath();
        ctx.arc(x, y, r * 0.38, 0, Math.PI * 2);
        ctx.fillStyle = n.color + '55';
        ctx.fill();

        // Orbiting particle
        const angle = (frame * 0.016 + n.phase) % (Math.PI * 2);
        const pr = n.r * 1.65;
        ctx.beginPath();
        ctx.arc(x + Math.cos(angle) * pr, y + Math.sin(angle) * pr, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = n.color + '88';
        ctx.fill();
      });

      frame++;
      raf = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} className='ambient-canvas' aria-hidden='true' />;
}
