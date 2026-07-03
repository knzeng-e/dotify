// Primary navigation - the shared nav rendered two ways from one item list:
// a collapsible left rail on desktop and a bottom tab bar on mobile. Extracted
// from App.tsx, where the two renders were duplicated inline.

import { PanelLeftClose, PanelLeftOpen, type LucideIcon } from 'lucide-react';
import type { View } from '../shared/types';

export type PrimaryNavItem = { view: View; label: string; icon: LucideIcon; onSelect: () => void };

export function SideRail({
  items,
  activeView,
  collapsed,
  onToggleCollapsed
}: {
  items: readonly PrimaryNavItem[];
  activeView: View;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  return (
    <nav className='side-rail' data-collapsed={collapsed} aria-label='Library navigation'>
      <button
        className='side-rail-toggle'
        type='button'
        onClick={onToggleCollapsed}
        aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        title={collapsed ? 'Expand' : 'Collapse'}
      >
        {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
      </button>
      <div className='side-rail-items'>
        {items.map(item => (
          <button key={item.view} className='side-rail-item' type='button' data-active={activeView === item.view} onClick={item.onSelect} title={item.label}>
            <item.icon size={20} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

export function BottomNav({ items, activeView }: { items: readonly PrimaryNavItem[]; activeView: View }) {
  return (
    <nav className='bottom-nav' aria-label='Main navigation'>
      {items.map(item => (
        <button key={item.view} className='bottom-nav-item' type='button' data-active={activeView === item.view} onClick={item.onSelect}>
          <item.icon size={22} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
