import { queryBytes } from '@parity/product-sdk/cloud-storage';
import { isInsideContainer } from '@parity/product-sdk/host';
import { hostBlockReader } from '../reader.mjs';
import { bounded } from '../native-rpc.mjs';
import { addressingCases, readAddressingCase } from '../addressing-reader.mjs';
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const start = el<HTMLButtonElement>('start'), stop = el<HTMLButtonElement>('stop'), save = el<HTMLButtonElement>('export');
let controller: AbortController | undefined;
let report: any;
const display = () => { el('report').textContent = JSON.stringify(report, null, 2); };
start.onclick = async () => {
  controller?.abort();
  const control = controller = new AbortController();
  const mode = el<HTMLSelectElement>('transport').value;
  const attempt = report = {
    schema: 'dotify.bulletin.addressing-report.v1', startedAt: new Date().toISOString(),
    transport: mode === 'native' ? 'native-preimage' : 'local-control',
    environment: el<HTMLInputElement>('environment').value.slice(0, 240), userAgent: navigator.userAgent,
    lookupTimeoutMs: 10000, hostCache: 'unknown; not cleared', pageCache: 'no application cache',
    productionAccessTested: false, outcome: 'running', cases: []
  };
  start.disabled = true; stop.disabled = false; save.disabled = false;
  try {
    const response = await fetch('/addressing/session', { signal: control.signal, credentials: 'omit', cache: 'no-store' });
    if (!response.ok) throw new Error('Local public marker session unavailable');
    const session = await response.json();
    const cases = addressingCases(session);
    attempt.implementation = session.implementation;
    attempt.fixture = session;
    if (mode === 'native') {
      attempt.insideHost = await bounded(isInsideContainer(), control.signal, 10000);
      if (!attempt.insideHost) throw new Error('Native mode requires the installed Polkadot Host. No fallback was attempted.');
    }
    const native = mode === 'native' ? hostBlockReader({ fetchBytes: queryBytes }) : undefined;
    for (const item of cases) {
      control.signal.throwIfAborted();
      el('status').textContent = `Checking ${item.name}…`;
      const result: any = { ...item, outcome: 'running', reads: [] };
      attempt.cases.push(result); display();
      const began = performance.now();
      try {
        const read = async (cid: string) => {
          control.signal.throwIfAborted();
          const before = performance.now();
          const bytes = native ? await native(cid) : await (async () => {
            const r = await fetch(`/canary/block/${cid}`, { signal: control.signal, credentials: 'omit', cache: 'no-store' });
            if (!r.ok) throw new Error('Local marker block unavailable');
            return new Uint8Array(await r.arrayBuffer());
          })();
          control.signal.throwIfAborted();
          result.reads.push({ cid, bytes: bytes.length, elapsedMs: Math.round(performance.now() - before) });
          return bytes;
        };
        Object.assign(result, await bounded(readAddressingCase(read, session, item), control.signal, 25000));
        result.outcome = 'verified';
      } catch (error) {
        result.outcome = 'failed';
        result.errorName = error instanceof Error ? error.name : 'UnknownError';
        result.error = String(error instanceof Error ? error.message : error).slice(0, 400);
        if (control.signal.aborted) throw error;
      } finally { result.elapsedMs = Math.round(performance.now() - began); display(); }
    }
    attempt.outcome = 'completed';
    el('status').textContent = `Comparison finished: ${attempt.cases.filter((c: any) => c.outcome === 'verified').length}/${cases.length} verified. Download the report before leaving.`;
  } catch (error) {
    attempt.outcome = control.signal.aborted ? 'stopped' : 'failed';
    attempt.error = String(error instanceof Error ? error.message : error).slice(0, 400);
    el('status').textContent = attempt.error;
  } finally { start.disabled = false; stop.disabled = true; display(); }
};
stop.onclick = () => controller?.abort(new Error('Stopped by operator'));
save.onclick = () => {
  if (!report) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `bulletin-addressing-${Date.now()}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};
window.addEventListener('pagehide', () => controller?.abort());
