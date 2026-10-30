import payload from 'virtual:generated-fixture';
import { mountPlayer } from '../host/player';
import { reportJournal } from './reports.mjs';
import './style.css';
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const saved = element<HTMLSelectElement>('saved');
const savedOutput = element<HTMLTextAreaElement>('saved-output');
const journal = reportJournal(
  {
    getItem: (key: string) => localStorage.getItem(key),
    setItem: (key: string, value: string) => localStorage.setItem(key, value),
    removeItem: (key: string) => localStorage.removeItem(key)
  },
  () => {
    element('storage-status').textContent = 'Local saving is unavailable. Copy the report before leaving this page.';
  }
);
function showSaved() {
  const report = journal.list().find((item: any) => item.id === saved.value);
  savedOutput.value = report ? JSON.stringify(report, null, 2) : '';
}
function refresh(preferred?: string) {
  const selected = preferred ?? saved.value;
  saved.replaceChildren(
    ...journal
      .list()
      .reverse()
      .map((report: any) => {
        const option = document.createElement('option');
        option.value = report.id;
        option.textContent = `${report.transport} · ${report.outcome} · ${report.startedAt}`;
        return option;
      })
  );
  if ([...saved.options].some(option => option.value === selected)) saved.value = selected;
  showSaved();
}
saved.onchange = showSaved;
element('select-report').onclick = () => {
  savedOutput.focus();
  savedOutput.select();
  savedOutput.setSelectionRange(0, savedOutput.value.length);
};
element('clear-reports').onclick = () => {
  if (confirm('Delete the saved diagnostic reports on this device?')) {
    journal.clear();
    refresh();
  }
};
element('source').textContent = `${payload.session.implementation.sha.slice(0, 8)}${payload.session.implementation.dirty ? ' · local changes' : ''}`;
refresh();
let currentAttemptId: string | undefined;
mountPlayer({
  loadSession: async signal => {
    signal.throwIfAborted();
    return structuredClone(payload.session);
  },
  readControlBlock: async (cid, signal) => {
    signal.throwIfAborted();
    const { default: blocks } = await import('virtual:decoder-blocks');
    signal.throwIfAborted();
    const block = blocks[cid];
    if (!block) throw new Error('Block is outside the generated decoder control');
    return Uint8Array.from(atob(block), character => character.charCodeAt(0));
  },
  controlTransport: 'bundled-decoder-control',
  onReport: report => {
    const fresh = currentAttemptId !== report.id;
    currentAttemptId = report.id;
    journal.save(report);
    refresh(fresh ? report.id : undefined);
  }
});
