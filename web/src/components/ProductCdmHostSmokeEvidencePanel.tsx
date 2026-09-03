import { Clipboard, Download, RefreshCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useUiFeedback } from '../app/providers/UiFeedbackProvider';
import {
  PRODUCT_CDM_HOST_SMOKE_EVIDENCE_EVENT,
  PRODUCT_CDM_PAYMENT_SMOKE_EVENT,
  PRODUCT_HOST_KEY_SMOKE_EVENT,
  buildProductCdmHostSmokeEvidence,
  clearProductCdmHostSmokeEvents,
  readProductCdmHostSmokeEvents,
  recordProductCdmHostApprovalObservation,
  serializeProductCdmHostSmokeEvidence,
  type ProductCdmHostSmokeContext,
  type ProductCdmHostSmokeEvent
} from '../features/productHost/productCdmHostSmokeEvidence';
import { statusTextForTone } from '../features/observability/productionReadiness';
import { EndpointRow } from '../shared/ui/EndpointRow';

type ProductCdmHostSmokeEvidencePanelProps = {
  context: ProductCdmHostSmokeContext;
};

export function ProductCdmHostSmokeEvidencePanel({ context }: ProductCdmHostSmokeEvidencePanelProps) {
  const { pushNotice } = useUiFeedback();
  const [events, setEvents] = useState<ProductCdmHostSmokeEvent[]>(() => readProductCdmHostSmokeEvents());
  const evidence = useMemo(() => buildProductCdmHostSmokeEvidence(context, events), [context, events]);
  const serializedEvidence = useMemo(() => serializeProductCdmHostSmokeEvidence(evidence), [evidence]);
  const hostApprovalObserved = latestHostApprovalObservation(events);

  useEffect(() => {
    const refreshEvents = () => setEvents(readProductCdmHostSmokeEvents());
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
    try {
      await navigator.clipboard.writeText(serializedEvidence);
      pushNotice({ tone: 'success', title: 'Smoke evidence copied', message: 'Product CDM host evidence JSON is on the clipboard.' });
    } catch {
      pushNotice({ tone: 'error', title: 'Copy failed', message: 'The browser blocked clipboard access. Download the JSON instead.' });
    }
  }

  function downloadEvidence() {
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
    setEvents([]);
    pushNotice({ tone: 'info', title: 'Smoke evidence reset', message: 'This browser session is ready for a fresh Product host smoke.' });
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

      <label className='product-smoke-observation'>
        <input type='checkbox' checked={hostApprovalObserved} onChange={event => toggleHostApproval(event.currentTarget.checked)} />
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
        <button className='secondary-action compact-action' type='button' onClick={() => void copyEvidence()}>
          <Clipboard size={15} />
          Copy JSON
        </button>
        <button className='secondary-action compact-action' type='button' onClick={downloadEvidence}>
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
