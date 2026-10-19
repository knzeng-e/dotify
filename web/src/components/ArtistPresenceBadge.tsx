import { BadgeCheck } from 'lucide-react';
export function ArtistPresenceBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? 'room-artist-seal' : 'room-artist-presence'} title='The artist of this track has announced their presence'>
      <BadgeCheck size={compact ? 14 : 16} aria-hidden='true' />
      <span className={compact ? 'sr-only' : undefined}>Artist here</span>
    </span>
  );
}
