import { Clipboard, Play, RefreshCw, Square, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { celerityCapture, type CaptureMetadata } from '../features/rooms/celerityCapture';
import { celeritySnapshot } from '../features/rooms/celerityDiagnostics';
import { normalizeIpfsCid } from '../shared/utils/ipfsCid';

const phases = ['baseline', 'background', 'network-change', 'reconnect', 'expiry'] as const;

export function CelerityCapturePanel() {
  const [snapshot, setSnapshot] = useState(celeritySnapshot);
  const [now, setNow] = useState(Date.now);
  const [metadata, setMetadata] = useState<CaptureMetadata>(
    () =>
      celerityCapture.snapshot()?.metadata ?? {
        run: '',
        client: 'B',
        cid: '',
        device: '',
        hostVersion: '',
        network: 'unknown'
      }
  );
  const [phase, setPhase] = useState<(typeof phases)[number]>(
    () => (celerityCapture.snapshot()?.markers.slice(-1)[0]?.phase as (typeof phases)[number]) ?? 'baseline'
  );
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [exportJson, setExportJson] = useState('');
  const [exportKind, setExportKind] = useState<'capture' | 'diagnostics'>('capture');
  const [confirmClear, setConfirmClear] = useState(false);
  const capture = snapshot.capture;
  const active = capture?.endedAt === null;
  const enabled = snapshot.mode === 'dual' || snapshot.mode === 'observe';
  const counts =
    capture?.frames.reduce<Record<string, number>>((result, frame) => {
      const key = `${frame.kind}/${frame.stage}`;
      result[key] = (result[key] ?? 0) + 1;
      return result;
    }, {}) ?? {};

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSnapshot(celeritySnapshot());
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function command(action: () => Promise<unknown>) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Capture operation failed.');
    } finally {
      working.current = false;
      setBusy(false);
      setSnapshot(celeritySnapshot());
      setNow(Date.now());
    }
  }

  async function start() {
    if (celerityCapture.snapshot()) throw new Error('Clear the previous capture before starting another run.');
    const cid = normalizeIpfsCid(metadata.cid);
    if (!cid) throw new Error('A valid deployed executable CID is required.');
    await celerityCapture.start({ ...metadata, cid });
    setMetadata(current => ({ ...current, cid }));
    setPhase('baseline');
    setExportJson('');
  }

  async function copy(kind: 'capture' | 'diagnostics') {
    const current = celeritySnapshot();
    if (kind === 'capture' && (!current.capture || current.capture.endedAt === null || current.capture.pending > 0)) return;
    const { capture: _capture, ...diagnostics } = current;
    const json = JSON.stringify(kind === 'capture' ? current.capture : diagnostics, null, 2);
    setExportJson(json);
    setExportKind(kind);
    setNotice('');
    try {
      await navigator.clipboard.writeText(json);
      setNotice(kind === 'capture' ? 'Capture JSON copied.' : 'Diagnostics JSON copied.');
    } catch {
      setNotice('Clipboard unavailable. JSON is available below.');
    }
  }

  function clear() {
    if (celerityCapture.snapshot()?.endedAt === null || working.current) return;
    celerityCapture.clear();
    setSnapshot(celeritySnapshot());
    setConfirmClear(false);
    setExportJson('');
    setError('');
    setNotice('Capture cleared.');
  }

  return (
    <div className='product-smoke celerity-capture' aria-labelledby='celerity-capture-title'>
      <div className='product-smoke-head'>
        <div>
          <strong id='celerity-capture-title'>Celerity capture</strong>
          <span>{!enabled ? 'Disabled in this build' : active ? 'Recording' : capture ? 'Stopped' : 'Not recording'}</span>
        </div>
        <span className='readiness-summary'>{snapshot.mode}</span>
      </div>
      <dl className='celerity-capture-facts'>
        <dt>Authority</dt>
        <dd>Socket.IO</dd>
        <dt>Build SHA</dt>
        <dd>{snapshot.buildSha ?? 'Unknown'}</dd>
        <dt>Product version</dt>
        <dd>{snapshot.productAppVersion ?? 'Unknown'}</dd>
        <dt>Presence</dt>
        <dd>{snapshot.observations.filter(event => !event.channel).slice(-1)[0]?.event ?? 'Not started'}</dd>
        <dt>Private channel</dt>
        <dd>{snapshot.observations.filter(event => event.channel === 'private').slice(-1)[0]?.event ?? 'Not started'}</dd>
      </dl>
      <fieldset className='celerity-capture-fields' disabled={busy || Boolean(capture) || !enabled}>
        <legend>Operator metadata</legend>
        {(['run', 'cid', 'device', 'hostVersion'] as const).map(key => (
          <label className='product-smoke-candidate' key={key}>
            {{ run: 'Paired run ID', cid: 'Deployed executable CID', device: 'Device and OS', hostVersion: 'Product Host version' }[key]}
            <input
              value={metadata[key]}
              maxLength={key === 'run' ? 64 : 160}
              autoCapitalize='none'
              autoCorrect='off'
              spellCheck={false}
              onChange={event => setMetadata(current => ({ ...current, [key]: event.target.value }))}
            />
          </label>
        ))}
        <label className='product-smoke-candidate'>
          Client
          <select value={metadata.client} onChange={event => setMetadata(current => ({ ...current, client: event.target.value as 'A' | 'B' }))}>
            <option value='A'>A</option>
            <option value='B'>B</option>
          </select>
        </label>
        <label className='product-smoke-candidate'>
          Network
          <select value={metadata.network} onChange={event => setMetadata(current => ({ ...current, network: event.target.value }))}>
            {['unknown', 'wifi', 'cellular', 'ethernet', 'mixed'].map(value => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      <div className='product-smoke-actions'>
        <button type='button' className='secondary-action compact-action' disabled={!enabled || busy || Boolean(capture)} onClick={() => void command(start)}>
          <Play size={15} />
          Start capture
        </button>
        <button type='button' className='secondary-action compact-action' disabled={!active || busy} onClick={() => void command(() => celerityCapture.stop())}>
          <Square size={15} />
          Stop capture
        </button>
        <button
          type='button'
          className='secondary-action compact-action'
          disabled={!active || busy}
          onClick={() => void command(() => celerityCapture.calibrate())}
        >
          <RefreshCw size={15} />
          Calibrate clock
        </button>
      </div>
      <label className='product-smoke-candidate'>
        Test phase
        <select
          value={phase}
          disabled={!active || busy}
          onChange={event => {
            const next = event.target.value as (typeof phases)[number];
            celerityCapture.phase(next);
            setPhase(next);
            setSnapshot(celeritySnapshot());
          }}
        >
          {phases.map(value => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      {capture && (
        <>
          <dl className='celerity-capture-facts'>
            <dt>Elapsed</dt>
            <dd>{Math.max(0, Math.floor(((capture.endedAt ?? now) - capture.startedAt) / 1000))} s</dd>
            <dt>Dropped records</dt>
            <dd>{capture.dropped}</dd>
            <dt>Pending hashes</dt>
            <dd>{capture.pending}</dd>
            <dt>Last clock uncertainty</dt>
            <dd>{capture.clocks.slice(-1)[0]?.uncertaintyMs ?? 'Unknown'} ms</dd>
            <dt>Clock sample age</dt>
            <dd>{Math.max(0, Math.floor((now - capture.clocks[capture.clocks.length - 1].at) / 1000))} s</dd>
            {Object.entries(counts).map(([key, value]) => (
              <div className='celerity-capture-count' key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {capture.dropped > 0 && <p role='alert'>Incomplete capture: records were dropped.</p>}
          {active && now - capture.startedAt >= 300_000 && <p role='alert'>Five-minute limit reached. Stop this capture.</p>}
        </>
      )}
      {error && <p role='alert'>{error}</p>}
      {notice && <p role='status'>{notice}</p>}
      <div className='product-smoke-actions'>
        <button
          type='button'
          className='secondary-action compact-action'
          disabled={!capture || active || busy || capture.pending > 0}
          onClick={() => void copy('capture')}
        >
          <Clipboard size={15} />
          Copy capture
        </button>
        <button type='button' className='secondary-action compact-action' onClick={() => void copy('diagnostics')}>
          <Clipboard size={15} />
          Copy diagnostics
        </button>
        <button type='button' className='secondary-action compact-action' disabled={!capture || active || busy} onClick={() => setConfirmClear(true)}>
          <Trash2 size={15} />
          Clear capture
        </button>
      </div>
      {confirmClear && (
        <div className='product-smoke-actions'>
          <button type='button' className='secondary-action compact-action' onClick={clear}>
            Confirm clear capture
          </button>
          <button type='button' className='secondary-action compact-action' onClick={() => setConfirmClear(false)}>
            Cancel
          </button>
        </div>
      )}
      {exportJson && (
        <div className='product-smoke-candidate'>
          <label htmlFor='celerity-capture-export'>{exportKind === 'capture' ? 'Capture JSON' : 'Diagnostics JSON'}</label>
          <textarea id='celerity-capture-export' className='celerity-capture-export' readOnly value={exportJson} rows={8} spellCheck={false} />
        </div>
      )}
    </div>
  );
}
