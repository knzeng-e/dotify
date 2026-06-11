// ── Presence avatars ──────────────────────────────────────────────────────────
// People in a room are shown as soft, per-person colored portraits (photo style).
// No real photos are used; each listener gets a stable hue from their name so the
// room feels populated and people stay distinguishable.

import type { CSSProperties } from 'react';
import { hashHue } from '../utils/aura';

type AvatarProps = {
  name: string;
  size?: number;
  host?: boolean;
  you?: boolean;
};

function avatarVars(name: string, size: number): CSSProperties {
  return { '--ava-hue': hashHue(name || 'guest'), '--ava-size': `${size}px` } as CSSProperties;
}

export function Avatar({ name, size = 34, host = false, you = false }: AvatarProps) {
  return (
    <span
      className={'ava' + (host ? ' ava-host' : '') + (you ? ' ava-you' : '')}
      style={avatarVars(name, size)}
      title={name}
      aria-hidden='true'
    >
      <span className='ava-initials'>{(name || '?').slice(0, 2).toUpperCase()}</span>
    </span>
  );
}

type AvatarStackProps = {
  names: string[];
  max?: number;
  size?: number;
};

// Decorative presence for room cards: only the listener count is real, these
// stand-in names seed the avatar hues so a busy room reads as populated.
const PRESENCE_POOL = ['Amara', 'Tobias', 'Lena', 'Kwame', 'Sofia', 'Noor', 'Diego', 'Mei', 'Yara', 'Idris', 'Faye', 'Ravi'];

export function roomPresenceNames(hostName: string, listenerCount: number, seed: string): string[] {
  const offset = hashHue(seed || hostName || 'room') % PRESENCE_POOL.length;
  const listeners = Array.from({ length: Math.max(0, listenerCount) }, (_, index) => PRESENCE_POOL[(offset + index) % PRESENCE_POOL.length]);
  return [hostName || 'Host', ...listeners];
}

export function AvatarStack({ names, max = 4, size = 28 }: AvatarStackProps) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <span className='ava-stack'>
      {shown.map((name, index) => (
        <Avatar key={`${name}-${index}`} name={name} size={size} />
      ))}
      {extra > 0 && (
        <span className='ava ava-more' style={{ '--ava-size': `${size}px` } as CSSProperties}>
          +{extra}
        </span>
      )}
    </span>
  );
}
