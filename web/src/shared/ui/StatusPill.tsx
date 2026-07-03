import type { LucideIcon } from 'lucide-react';

export function StatusPill({ icon: Icon, label, tone }: { icon: LucideIcon; label: string; tone: 'green' | 'pink' | 'muted' }) {
  return (
    <div className='status-pill' data-tone={tone}>
      <Icon size={14} />
      <span>{label}</span>
    </div>
  );
}
