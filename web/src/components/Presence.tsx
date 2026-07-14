// ── Presence avatars ──────────────────────────────────────────────────────────
// People in a room are shown as soft, per-person colored portraits (photo style).
// No real photos are used; each listener gets a stable hue from their name so the
// room feels populated and people stay distinguishable.

import type { CSSProperties } from 'react';
import { hashHue, initialsFor } from '../shared/utils/aura';

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
  const isAnonymous = !name;

  return (
    <span
      className={'ava' + (host ? ' ava-host' : '') + (you ? ' ava-you' : '') + (isAnonymous ? ' ava-anonymous' : '')}
      style={avatarVars(name, size)}
      title={name || undefined}
      aria-hidden='true'
    >
      {isAnonymous ? <span className='ava-anonymous-mark' /> : <span className='ava-initials'>{initialsFor(name)}</span>}
    </span>
  );
}

type AvatarStackProps = {
  names: string[];
  max?: number;
  size?: number;
};

// Room discovery exposes a real host name and a listener count, not a listener
// roster. Keep the count visually legible with anonymous marks instead of
// inventing people or initials that the signaling payload never supplied.
export function roomPresenceNames(hostName: string, listenerCount: number, _seed: string): string[] {
  const listeners = Array.from({ length: Math.max(0, listenerCount) }, () => '');
  return [hostName || 'Host', ...listeners];
}

export function AvatarStack({ names, max = 4, size = 28 }: AvatarStackProps) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <span className='ava-stack' aria-hidden='true'>
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
