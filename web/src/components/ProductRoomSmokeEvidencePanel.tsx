import { Clipboard, Download, RefreshCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useUiFeedback } from '../app/providers/UiFeedbackProvider';
import {
  bindCurrentProductRoom,
  bindProductRoomSmokeCandidate,
  buildProductRoomSmokeEvidence,
  clearProductRoomSmokeDraft,
  productRoomSmokeComplete,
  readProductRoomSmokeDraft,
  serializeProductRoomSmokeEvidence,
  updateProductRoomSmokeDraft,
  type ProductRoomHostSurface,
  type ProductRoomSmokeContext,
  type ProductRoomSmokeDraft
} from '../features/productHost/productRoomSmokeEvidence';
import { getRoomQualityTelemetrySnapshot, type RoomQualityTelemetrySnapshot } from '../features/rooms/roomQualityTelemetry';
import { statusTextForTone } from '../features/observability/productionReadiness';
import { EndpointRow } from '../shared/ui/EndpointRow';
import { normalizeIpfsCid } from '../shared/utils/ipfsCid';

type ProductRoomSmokeEvidencePanelProps = {
  context: ProductRoomSmokeContext;
};

export function ProductRoomSmokeEvidencePanel({ context }: ProductRoomSmokeEvidencePanelProps) {
  const { pushNotice } = useUiFeedback();
  const [draft, setDraft] = useState<ProductRoomSmokeDraft | null>(() => readProductRoomSmokeDraft());
  const [deployedCid, setDeployedCid] = useState(() => readProductRoomSmokeDraft()?.candidate.deployedCid ?? '');
  const [snapshot, setSnapshot] = useState<RoomQualityTelemetrySnapshot>(() => getRoomQualityTelemetrySnapshot());
  const normalizedInputCid = normalizeIpfsCid(deployedCid);
  const candidateActive = Boolean(
    draft &&
    draft.candidate.gitSha === context.buildSha &&
    draft.candidate.productAppVersion === context.productAppVersion &&
    draft.candidate.deployedCid === normalizedInputCid
  );
  const evidence = useMemo(() => (draft ? buildProductRoomSmokeEvidence(context, draft, snapshot) : null), [context, draft, snapshot]);
  const serializedEvidence = useMemo(() => (evidence ? serializeProductRoomSmokeEvidence(evidence) : ''), [evidence]);
  const complete = evidence ? productRoomSmokeComplete(evidence) : false;

  useEffect(() => {
    const refresh = () => setSnapshot(getRoomQualityTelemetrySnapshot());
    window.addEventListener('dotify:room-quality', refresh);
    return () => window.removeEventListener('dotify:room-quality', refresh);
  }, []);

  function bindCandidate() {
    const next = bindProductRoomSmokeCandidate(context, deployedCid);
    if (!next) {
      pushNotice({ tone: 'error', title: 'Candidate unavailable', message: 'Use the full build SHA, Product app version, and exact deployment CID.' });
      return;
    }
    setDraft(next);
    setDeployedCid(next.candidate.deployedCid);
    pushNotice({
      tone: 'success',
      title: next.roomId ? 'Room capture restored' : 'Candidate ready',
      message: next.roomId ? `Continuing evidence for room ${next.roomId}.` : 'Start a room, then bind it below.'
    });
  }

  function bindRoom() {
    const next = bindCurrentProductRoom(context.roomId);
    if (!next) {
      pushNotice({ tone: 'error', title: 'No hosted room', message: 'Create a room in this Product host before starting the capture.' });
      return;
    }
    setDraft(next);
    setSnapshot(getRoomQualityTelemetrySnapshot());
    pushNotice({ tone: 'success', title: 'Room capture started', message: `Room ${next.roomId} is bound to this evidence session.` });
  }

  function update(patch: Parameters<typeof updateProductRoomSmokeDraft>[0]) {
    const next = updateProductRoomSmokeDraft(patch);
    if (next) setDraft(next);
  }

  async function copyEvidence() {
    if (!serializedEvidence) return;
    try {
      await navigator.clipboard.writeText(serializedEvidence);
      pushNotice({ tone: 'success', title: 'Room evidence copied', message: 'The candidate-bound room JSON is on the clipboard.' });
    } catch {
      pushNotice({ tone: 'error', title: 'Copy failed', message: 'The host blocked clipboard access. Download the JSON instead.' });
    }
  }

  function downloadEvidence() {
    if (!serializedEvidence) return;
    const blob = new Blob([serializedEvidence], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `dotify-product-room-smoke-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function resetEvidence() {
    clearProductRoomSmokeDraft();
    setDraft(null);
    setDeployedCid('');
    setSnapshot(getRoomQualityTelemetrySnapshot());
    pushNotice({ tone: 'info', title: 'Room evidence reset', message: 'Bind a deployment to begin a fresh Product room smoke.' });
  }

  return (
    <div className='product-smoke' aria-labelledby='product-room-smoke-title'>
      <div className='product-smoke-head'>
        <div>
          <strong id='product-room-smoke-title'>Product room smoke</strong>
          <span>{draft?.roomId ? `Room ${draft.roomId}` : 'No room capture active'}</span>
        </div>
        <span className='readiness-summary' data-tone={complete ? 'ok' : 'warning'}>
          {complete ? 'Evidence complete' : 'Capture pending'}
        </span>
      </div>

      <div className='product-smoke-context'>
        <code>{context.productId}</code>
        <span>{context.productHostStatus}</span>
        <span>{context.mode === 'host' && context.roomId ? `${context.listenerCount} listening` : 'Host a room first'}</span>
      </div>

      <div className='product-smoke-candidate'>
        <label htmlFor='product-room-smoke-cid'>Deployed executable CID</label>
        <input
          id='product-room-smoke-cid'
          type='text'
          value={deployedCid}
          onChange={event => setDeployedCid(event.currentTarget.value)}
          placeholder='bafy…'
          autoCapitalize='none'
          autoCorrect='off'
          spellCheck={false}
        />
        <small>Use the same Product deployment CID as the payment/key smoke.</small>
        <button className='secondary-action compact-action' type='button' onClick={bindCandidate}>
          {candidateActive ? 'Deployment bound' : 'Use this deployment'}
        </button>
      </div>

      <div className='product-smoke-candidate'>
        <label htmlFor='product-room-host-surface'>Product host surface</label>
        <select
          id='product-room-host-surface'
          value={draft?.hostSurface ?? ''}
          disabled={!candidateActive}
          onChange={event => update({ hostSurface: (event.currentTarget.value || null) as ProductRoomHostSurface | null })}
        >
          <option value=''>Choose the tested surface</option>
          <option value='product-desktop'>Product Desktop</option>
          <option value='product-web-gateway'>Product Web gateway</option>
        </select>
        <label htmlFor='product-room-host-version'>Visible host version</label>
        <input
          id='product-room-host-version'
          type='text'
          value={draft?.hostVersion ?? ''}
          disabled={!candidateActive}
          onChange={event => update({ hostVersion: event.currentTarget.value })}
          placeholder='Product Desktop 0.1.0'
        />
        <label htmlFor='product-room-guest-origin'>Guest browser origin</label>
        <input
          id='product-room-guest-origin'
          type='url'
          value={draft?.guestOrigin ?? ''}
          disabled={!candidateActive}
          onChange={event => update({ guestOrigin: event.currentTarget.value })}
          placeholder='https://muzinga.netlify.app'
          autoCapitalize='none'
          autoCorrect='off'
          spellCheck={false}
        />
        <button
          className='secondary-action compact-action'
          type='button'
          disabled={!candidateActive || context.mode !== 'host' || !context.roomId}
          onClick={bindRoom}
        >
          {draft?.roomId === context.roomId && context.roomId ? `Room ${context.roomId} bound` : 'Use current hosted room'}
        </button>
      </div>

      <div className='product-smoke-observations' aria-label='Guest device observations'>
        <label className='product-smoke-observation'>
          <input
            type='checkbox'
            checked={draft?.hostSharedCanonicalUrl ?? false}
            disabled={!candidateActive || !draft?.roomId}
            onChange={event => update({ hostSharedCanonicalUrl: event.currentTarget.checked })}
          />
          <span>I shared the canonical room link</span>
        </label>
        <label className='product-smoke-observation'>
          <input
            type='checkbox'
            checked={draft?.guestWalletlessObserved ?? false}
            disabled={!candidateActive || !draft?.roomId}
            onChange={event => update({ guestWalletlessObserved: event.currentTarget.checked })}
          />
          <span>The guest joined without an account</span>
        </label>
        <label className='product-smoke-observation'>
          <input
            type='checkbox'
            checked={draft?.guestHeardAudio ?? false}
            disabled={!candidateActive || !draft?.roomId}
            onChange={event => update({ guestHeardAudio: event.currentTarget.checked })}
          />
          <span>The guest heard the shared audio</span>
        </label>
        <label className='product-smoke-observation'>
          <input
            type='checkbox'
            checked={draft?.guestInSync ?? false}
            disabled={!candidateActive || !draft?.roomId}
            onChange={event => update({ guestInSync: event.currentTarget.checked })}
          />
          <span>The guest player showed In sync</span>
        </label>
      </div>

      {evidence && (
        <div className='readiness-list product-smoke-checks' aria-live='polite'>
          {evidence.checks.map(check => (
            <EndpointRow
              key={check.id}
              label={check.label}
              value={
                <div className='readiness-check-value'>
                  <span className='readiness-check-state' data-tone={check.tone}>
                    {statusTextForTone(check.tone)}
                  </span>
                  <p>{check.detail}</p>
                </div>
              }
            />
          ))}
        </div>
      )}

      <div className='product-smoke-actions'>
        <button className='secondary-action compact-action' type='button' disabled={!candidateActive || !evidence} onClick={() => void copyEvidence()}>
          <Clipboard size={15} />
          Copy JSON
        </button>
        <button className='secondary-action compact-action' type='button' disabled={!candidateActive || !evidence} onClick={downloadEvidence}>
          <Download size={15} />
          Download JSON
        </button>
        <button className='secondary-action compact-action' type='button' onClick={resetEvidence}>
          <RefreshCcw size={15} />
          Reset
        </button>
      </div>
    </div>
  );
}
