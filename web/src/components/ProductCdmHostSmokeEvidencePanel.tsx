import { Clipboard, Download, RefreshCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useUiFeedback } from '../app/providers/UiFeedbackProvider';
import {
  PRODUCT_CDM_HOST_SMOKE_EVIDENCE_EVENT,
  PRODUCT_CDM_PAYMENT_SMOKE_EVENT,
  PRODUCT_HOST_KEY_SMOKE_EVENT,
  bindProductCdmHostSmokeCandidate,
  buildProductCdmHostSmokeEvidence,
  clearProductCdmHostSmokeEvents,
  getProductCdmHostSmokeSession,
  getProductCdmHostSmokeSessionCandidate,
  readProductCdmHostSmokeEvents,
  recordProductCdmHostApprovalObservation,
  serializeProductCdmHostSmokeEvidence,
  type ProductCdmHostSmokeContext,
  type ProductCdmHostSmokeEvent,
  type ProductCdmHostSmokeSessionCandidate
} from '../features/productHost/productCdmHostSmokeEvidence';
import { statusTextForTone } from '../features/observability/productionReadiness';
import { EndpointRow } from '../shared/ui/EndpointRow';
import { normalizeIpfsCid } from '../shared/utils/ipfsCid';

type ProductCdmHostSmokeEvidencePanelProps = {
  context: ProductCdmHostSmokeContext;
};

export function ProductCdmHostSmokeEvidencePanel({ context }: ProductCdmHostSmokeEvidencePanelProps) {
  const { pushNotice } = useUiFeedback();
  const [boundCandidate, setBoundCandidate] = useState<ProductCdmHostSmokeSessionCandidate | null>(() => getProductCdmHostSmokeSessionCandidate());
  const [captureStartedAt, setCaptureStartedAt] = useState<string | null>(() => getProductCdmHostSmokeSession()?.startedAt ?? null);
  const [events, setEvents] = useState<ProductCdmHostSmokeEvent[]>(() => readProductCdmHostSmokeEvents());
  const [deployedCid, setDeployedCid] = useState(() => getProductCdmHostSmokeSessionCandidate()?.deployedCid ?? context.deployedCid ?? '');
  const normalizedInputCid = normalizeIpfsCid(deployedCid);
  const candidateActive = Boolean(
    boundCandidate &&
    boundCandidate.gitSha === context.buildSha &&
    boundCandidate.productAppVersion === context.productAppVersion &&
    boundCandidate.deployedCid === normalizedInputCid
  );
  const evidenceContext = useMemo(
    () => ({ ...context, deployedCid: candidateActive ? (boundCandidate?.deployedCid ?? null) : null }),
    [boundCandidate, candidateActive, context]
  );
  const evidence = useMemo(
    () => buildProductCdmHostSmokeEvidence(evidenceContext, events, captureStartedAt ? new Date(captureStartedAt) : new Date(0)),
    [captureStartedAt, evidenceContext, events]
  );
  const serializedEvidence = useMemo(() => serializeProductCdmHostSmokeEvidence(evidence), [evidence]);
  const hostApprovalObserved = latestHostApprovalObservation(events);

  useEffect(() => {
    const refreshEvents = () => {
      const session = getProductCdmHostSmokeSession();
      setBoundCandidate(session?.candidate ?? null);
      setCaptureStartedAt(session?.startedAt ?? null);
      setEvents(readProductCdmHostSmokeEvents());
    };
    refreshEvents();

    window.addEventListener(PRODUCT_CDM_HOST_SMOKE_EVIDENCE_EVENT, refreshEvents);
    window.addEventListener(PRODUCT_CDM_PAYMENT_SMOKE_EVENT, refreshEvents);
    window.addEventListener(PRODUCT_HOST_KEY_SMOKE_EVENT, refreshEvents);
    return () => {
      window.removeEventListener(PRODUCT_CDM_HOST_SMOKE_EVIDENCE_EVENT, refreshEvents);
      window.removeEventListener(PRODUCT_CDM_PAYMENT_SMOKE_EVENT, refreshEvents);
      window.removeEventListener(PRODUCT_HOST_KEY_SMOKE_EVENT, refreshEvents);
    };
  }, []);

  async function copyEvidence() {
    if (!candidateActive) return;
    try {
      await navigator.clipboard.writeText(serializedEvidence);
      pushNotice({ tone: 'success', title: 'Smoke evidence copied', message: 'Product CDM host evidence JSON is on the clipboard.' });
    } catch {
      pushNotice({ tone: 'error', title: 'Copy failed', message: 'The browser blocked clipboard access. Download the JSON instead.' });
    }
  }

  function downloadEvidence() {
    if (!candidateActive) return;
    const blob = new Blob([serializedEvidence], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `dotify-product-cdm-host-smoke-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function resetEvidence() {
    clearProductCdmHostSmokeEvents();
    setBoundCandidate(null);
    setCaptureStartedAt(null);
    setEvents([]);
    pushNotice({ tone: 'info', title: 'Smoke evidence reset', message: 'This browser session is ready for a fresh Product host smoke.' });
  }

  function bindCandidate() {
    const canonicalCid = normalizeIpfsCid(deployedCid);
    if (!canonicalCid) {
      pushNotice({ tone: 'error', title: 'Invalid deployment CID', message: 'Paste the exact IPFS CID returned by the Product deployment.' });
      return;
    }
    const session = bindProductCdmHostSmokeCandidate({ ...context, deployedCid: canonicalCid });
    if (!session) {
      pushNotice({ tone: 'error', title: 'Candidate unavailable', message: 'This build needs a full git SHA, Product app version, and valid deployment CID.' });
      return;
    }
    setDeployedCid(session.candidate.deployedCid);
    setBoundCandidate(session.candidate);
    setCaptureStartedAt(session.startedAt);
    setEvents(session.events);
    pushNotice({
      tone: 'success',
      title: session.events.length > 0 ? 'Candidate restored' : 'Fresh capture ready',
      message: session.events.length > 0 ? 'Existing events belong to this exact deployment.' : 'Run the payment and key smoke for this deployment now.'
    });
  }

  function toggleHostApproval(checked: boolean) {
    recordProductCdmHostApprovalObservation(checked);
    setEvents(readProductCdmHostSmokeEvents());
  }

  return (
    <div className='product-smoke' aria-labelledby='product-smoke-title'>
      <div className='product-smoke-head'>
        <div>
          <strong id='product-smoke-title'>Product CDM host smoke</strong>
          <span>{events.length === 0 ? 'No captured events yet' : `${events.length} captured event${events.length === 1 ? '' : 's'}`}</span>
        </div>
        <span className='readiness-summary' data-tone={evidence.summary.tone}>
          {evidence.summary.label}
        </span>
      </div>

      <div className='product-smoke-context'>
        <code>{context.productId}</code>
        <span>{context.runtimeAdapterKind}</span>
        <span>{context.productHostStatus}</span>
      </div>

      <div className='product-smoke-candidate'>
        <label htmlFor='product-smoke-cid'>Deployed executable CID</label>
        <input
          id='product-smoke-cid'
          type='text'
          value={deployedCid}
          onChange={event => setDeployedCid(event.currentTarget.value)}
          placeholder='bafy…'
          autoCapitalize='none'
          autoCorrect='off'
          spellCheck={false}
        />
        <small>Paste the CID, bind this deployment, then run the payment and key smoke. Changing candidate clears captured events.</small>
        <button className='secondary-action compact-action' type='button' onClick={bindCandidate}>
          {candidateActive ? 'Deployment bound' : 'Use this deployment'}
        </button>
      </div>

      <label className='product-smoke-observation'>
        <input type='checkbox' checked={hostApprovalObserved} disabled={!candidateActive} onChange={event => toggleHostApproval(event.currentTarget.checked)} />
        <span>Host approval prompt captured</span>
      </label>

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

      <div className='product-smoke-actions'>
        <button className='secondary-action compact-action' type='button' disabled={!candidateActive} onClick={() => void copyEvidence()}>
          <Clipboard size={15} />
          Copy JSON
        </button>
        <button className='secondary-action compact-action' type='button' disabled={!candidateActive} onClick={downloadEvidence}>
          <Download size={15} />
          Download
        </button>
        <button className='secondary-action compact-action' type='button' onClick={resetEvidence}>
          <RefreshCcw size={15} />
          Reset
        </button>
      </div>
    </div>
  );
}

function latestHostApprovalObservation(events: ProductCdmHostSmokeEvent[]): boolean {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.kind === 'operator-observation' && event.observation === 'host-approval-explicit') return event.ok;
  }
  return false;
}
