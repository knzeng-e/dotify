import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function PanelTitle({ icon: Icon, title, meta, action }: { icon: LucideIcon; title: string; meta?: string; action?: ReactNode }) {
  return (
    <div className='panel-title'>
      <span>
        <Icon size={17} />
        {title}
      </span>
      {action ? (
        <div className='panel-title-end'>
          {meta && <small>{meta}</small>}
          {action}
        </div>
      ) : (
        meta && <small>{meta}</small>
      )}
    </div>
  );
}
