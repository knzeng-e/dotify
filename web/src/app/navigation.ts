// App navigation model - static view copy and the primary nav items.
//
// One source of truth for the four main views: their page copy and the nav
// entries (rendered as a desktop rail and a mobile tab bar). Handlers stay in
// App.tsx (they close over navigation/session), so this holds only the static
// shape - view id, label, and icon.

import { Headphones, Radio, UserRound, type LucideIcon } from 'lucide-react';
import type { View } from '../shared/types';

/** Page title + eyebrow for each main view. */
export const VIEW_COPY: Record<View, { title: string; eyebrow: string }> = {
  listen: { title: 'Now', eyebrow: 'Open moments' },
  player: { title: 'Listen', eyebrow: 'Work and room' },
  rooms: { title: 'Rooms', eyebrow: 'Enter or welcome' },
  you: { title: 'You', eyebrow: 'Music and privacy' }
};

export type NavItem = { view: View; label: string; icon: LucideIcon };

/** Primary navigation entries, in display order. */
export const NAV_ITEMS: readonly NavItem[] = [
  { view: 'listen', label: 'Now', icon: Headphones },
  { view: 'rooms', label: 'Rooms', icon: Radio },
  { view: 'you', label: 'You', icon: UserRound }
];
