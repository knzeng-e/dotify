import type { HostSoftwareObservation } from '../features/productHost/productHostInfo';
import { useState } from 'react';
import { getAudioStartupTelemetrySnapshot, serializeAudioDiagnostics } from '../features/catalog/audioStartupTelemetry';

/** Explicit, local support export. The shared serializer omits account/track identifiers and keys. */
export function AudioFailureDiagnostics({ hostSoftware }: { hostSoftware?: HostSoftwareObservation }) {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState('');

  async function copy() {
    const report = serializeAudioDiagnostics(getAudioStartupTelemetrySnapshot(), import.meta.env.VITE_DOTIFY_BUILD_SHA, hostSoftware);
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setFallback('');
    } catch {
      setCopied(false);
      setFallback(report);
    }
  }

  return (
    <div className='audio-support-report'>
      <button className='text-action' type='button' onClick={() => void copy()}>
        Copy support report
      </button>
      <span role='status'>{copied ? 'Report copied' : fallback ? 'Select and copy the report below.' : ''}</span>
      {fallback && (
        <label className='field'>
          <span>Audio support report</span>
          <textarea readOnly value={fallback} rows={4} />
        </label>
      )}
    </div>
  );
}
