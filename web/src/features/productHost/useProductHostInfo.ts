import { useEffect, useState } from 'react';
import { readProductHostInfo, type HostSoftwareObservation } from './productHostInfo';

const pending: HostSoftwareObservation = { status: 'pending' };

/** Only About's explicit open enables this bounded, non-account Host read. */
export function useProductHostInfo(enabled: boolean): HostSoftwareObservation | undefined {
  const [observation, setObservation] = useState<HostSoftwareObservation>();
  useEffect(() => {
    if (!enabled) {
      setObservation(undefined);
      return;
    }
    const controller = new AbortController();
    setObservation(pending);
    void readProductHostInfo(controller.signal).then(result => {
      if (!controller.signal.aborted && result) setObservation(result);
    });
    return () => controller.abort();
  }, [enabled]);
  return enabled ? (observation ?? pending) : undefined;
}
