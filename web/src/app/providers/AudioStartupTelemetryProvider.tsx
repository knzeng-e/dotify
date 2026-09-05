import { useEffect, type ReactNode } from 'react';
import { installAudioStartupTelemetry } from '../../features/catalog/audioStartupTelemetry';

export function AudioStartupTelemetryProvider({ children }: { children: ReactNode }) {
  useEffect(() => installAudioStartupTelemetry(), []);
  return <>{children}</>;
}
