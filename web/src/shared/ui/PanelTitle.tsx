import type { LucideIcon } from 'lucide-react';

export function PanelTitle({ icon: Icon, title, meta }: { icon: LucideIcon; title: string; meta?: string }) {
  return (
    <div className='panel-title'>
      <span>
        <Icon size={17} />
        {title}
      </span>
      {meta && <small>{meta}</small>}
    </div>
  );
}
