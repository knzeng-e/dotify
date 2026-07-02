// App navigation model - static view copy and the primary nav items.
//
// One source of truth for the four main views: their page copy and the nav
// entries (rendered as a desktop rail and a mobile tab bar). Handlers stay in
// App.tsx (they close over navigation/session), so this holds only the static
// shape - view id, label, and icon.

import { Disc3, Headphones, Radio, UserRound, type LucideIcon } from 'lucide-react';
import type { View } from '../types';

/** Page title + eyebrow for each main view. */
export const VIEW_COPY: Record<View, { title: string; eyebrow: string }> = {
  listen: { title: 'Now', eyebrow: 'Live rooms' },
  player: { title: 'Listen', eyebrow: 'Catalog and player' },
  rooms: { title: 'Rooms', eyebrow: 'Join or create' },
  you: { title: 'Account', eyebrow: 'Wallet and artist space' }
};

export type NavItem = { view: View; label: string; icon: LucideIcon };

/** Primary navigation entries, in display order. */
export const NAV_ITEMS: readonly NavItem[] = [
  { view: 'listen', label: 'Now', icon: Headphones },
  { view: 'player', label: 'Listen', icon: Disc3 },
  { view: 'rooms', label: 'Rooms', icon: Radio },
  { view: 'you', label: 'Account', icon: UserRound }
];
