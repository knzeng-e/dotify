// Primary navigation is rendered as calm inline navigation on desktop and a
// thumb-reachable bottom bar on mobile. Both variants share the same real view
// model and accessible names.

import { type LucideIcon } from 'lucide-react';
import type { View } from '../shared/types';

export type PrimaryNavItem = { view: View; label: string; icon: LucideIcon; onSelect: () => void };

export function DesktopNav({ items, activeView }: { items: readonly PrimaryNavItem[]; activeView: View }) {
  return (
    <div className='desktop-nav' aria-label='Main sections'>
      {items.map(item => (
        <button
          key={item.view}
          className='desktop-nav-item'
          type='button'
          data-active={activeView === item.view}
          aria-current={activeView === item.view ? 'page' : undefined}
          onClick={item.onSelect}
        >
          <item.icon size={17} aria-hidden='true' />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

export function BottomNav({ items, activeView }: { items: readonly PrimaryNavItem[]; activeView: View }) {
  return (
    <nav className='bottom-nav' aria-label='Main navigation'>
      {items.map(item => (
        <button
          key={item.view}
          className='bottom-nav-item'
          type='button'
          data-active={activeView === item.view}
          aria-current={activeView === item.view ? 'page' : undefined}
          onClick={item.onSelect}
        >
          <item.icon size={21} aria-hidden='true' />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
