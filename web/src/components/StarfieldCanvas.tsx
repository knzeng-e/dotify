import { useEffect, useRef } from 'react';

// Warp-field backdrop inspired by the Luma POC online event pages: fine, long
// light-rays radiate from a vanishing point and accelerate outward, so it feels
// like flying INTO the field rather than watching it drift past. Rays are faint
// and short near the centre (far away) and grow long, bright, and fast toward
// the edges (rushing past the viewer). Rendered in the Dotify palette.
//
// Two variants:
//   - 'player':  dense and immersive, origin tucked behind the cover, and the
//                warp accelerates while a track is playing.
//   - 'ambient': restrained and slow, centred. Sits behind the whole app.
//
// Decorative only (aria-hidden). Honors prefers-reduced-motion by drawing a
// single still field with no animation loop.

type StarfieldVariant = 'ambient' | 'player';

type StarfieldCanvasProps = {
  variant?: StarfieldVariant;
  active?: boolean;
  className?: string;
};

type Particle = {
  angle: number;
  radius: number;
  jitter: number;
  color: string;
};

// Brand-palette ray colours, weighted so white/cyan dominate and pink/gold/green
// appear as occasional colour pops (the way Luma sprinkles colour through white).
const COLOR_WEIGHTS: Array<[string, number]> = [
  ['#ffffff', 0.44],
  ['#29e87a', 0.24],
  ['#c8ff4d', 0.14],
  ['#e6007a', 0.1],
  ['#e8c86a', 0.08]
];

type VariantConfig = {
  density: number;
  maxParticles: number;
  growth: number;
  baseStep: number;
  speedMul: number;
  activeSpeedMul: number;
  widthBase: number;
  alpha: number;
  originX: number;
  originY: number;
};

const VARIANTS: Record<StarfieldVariant, VariantConfig> = {
  ambient: { density: 0.00018, maxParticles: 190, growth: 0.025, baseStep: 0.35, speedMul: 0.5, activeSpeedMul: 0.5, widthBase: 1, alpha: 0.8, originX: 0.5, originY: 0.42 },
  player: { density: 0.0005, maxParticles: 440, growth: 0.032, baseStep: 0.5, speedMul: 0.95, activeSpeedMul: 1.8, widthBase: 1.15, alpha: 1, originX: 0.2, originY: 0.42 }
};

function hexToRgba(hex: string, alpha: number) {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function pickColor() {
  const roll = Math.random();
  let acc = 0;
  for (const [color, weight] of COLOR_WEIGHTS) {
    acc += weight;
    if (roll <= acc) return color;
  }
  return '#ffffff';
}

export function StarfieldCanvas({ variant = 'ambient', active = false, className }: StarfieldCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cfg = VARIANTS[variant];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let cx = 0;
    let cy = 0;
    let maxR = 1;
    let speedMul = cfg.speedMul;
    let particles: Particle[] = [];
    let raf = 0;

    const resetParticle = (p: Particle, initial: boolean) => {
      p.angle = Math.random() * Math.PI * 2;
      // On first seed, spread across the whole field so it is full immediately;
      // on recycle, send the ray back near the vanishing point.
      p.radius = initial ? Math.random() * maxR : Math.random() * maxR * 0.04 + 1;
      p.jitter = 0.7 + Math.random() * 0.7;
      p.color = pickColor();
    };

    const seed = () => {
      const count = Math.min(cfg.maxParticles, Math.max(40, Math.round(width * height * cfg.density)));
      particles = Array.from({ length: count }, () => {
        const p: Particle = { angle: 0, radius: 0, jitter: 1, color: '#ffffff' };
        resetParticle(p, true);
        return p;
      });
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = width * cfg.originX;
      cy = height * cfg.originY;
      // Reach the farthest corner from the (possibly off-centre) vanishing point.
      maxR = Math.hypot(Math.max(cx, width - cx), Math.max(cy, height - cy)) * 1.04;
      seed();
    };

    const drawParticle = (p: Particle) => {
      const dirX = Math.cos(p.angle);
      const dirY = Math.sin(p.angle);
      const depth = Math.min(1, p.radius / maxR);
      // A long fine ray: tail trails back toward the centre, so the streak grows
      // longer as it travels outward (short near the vanishing point, long at the edge).
      const tailR = p.radius * 0.25;
      const hx = cx + dirX * p.radius;
      const hy = cy + dirY * p.radius;
      const tx = cx + dirX * tailR;
      const ty = cy + dirY * tailR;

      const alpha = Math.min(1, depth * 1.6) * cfg.alpha;
      const lineWidth = cfg.widthBase * (0.5 + depth * 0.9);

      const grad = ctx.createLinearGradient(tx, ty, hx, hy);
      grad.addColorStop(0, hexToRgba(p.color, 0));
      grad.addColorStop(1, hexToRgba(p.color, alpha));
      ctx.strokeStyle = grad;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(hx, hy);
      ctx.stroke();

      // White-hot point leading the ray.
      ctx.beginPath();
      ctx.arc(hx, hy, lineWidth * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba('#ffffff', alpha);
      ctx.fill();
    };

    resize();

    if (reducedMotion) {
      ctx.clearRect(0, 0, width, height);
      // Additive blending makes overlapping rays glow at the vanishing point.
      ctx.globalCompositeOperation = 'lighter';
      particles.forEach(drawParticle);
      ctx.globalCompositeOperation = 'source-over';
      return () => undefined;
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';

      const targetSpeed = activeRef.current ? cfg.activeSpeedMul : cfg.speedMul;
      // Ease the warp speed toward its target so play/pause ramps smoothly.
      speedMul += (targetSpeed - speedMul) * 0.04;

      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        p.radius += (p.radius * cfg.growth + cfg.baseStep) * speedMul * p.jitter;
        drawParticle(p);
        if (p.radius > maxR) resetParticle(p, false);
      }

      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(draw);
    };
    draw();

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [variant]);

  return <canvas ref={ref} className={className ?? 'starfield-canvas'} aria-hidden='true' />;
}
