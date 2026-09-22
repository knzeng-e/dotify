import { useEffect, type ReactNode } from 'react';
import { installRoomQualityTelemetry } from '../../features/rooms/roomQualityTelemetry';

export function RoomQualityTelemetryProvider({ children }: { children: ReactNode }) {
  useEffect(() => installRoomQualityTelemetry(), []);
  return <>{children}</>;
}
