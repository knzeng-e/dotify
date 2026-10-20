import { Globe, Radar } from 'lucide-react';

/** A familiar globe for worldwide invitations, radar for local discovery. */
export function RoomScopeIcon({ worldwide, size = 14 }: { worldwide: boolean; size?: number }) {
  const Icon = worldwide ? Globe : Radar;
  return <Icon size={size} aria-hidden='true' />;
}
