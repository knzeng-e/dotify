import { useState } from 'react';
import { useProductHostInfo } from '../features/productHost/useProductHostInfo';
import { hasSupportedQualificationRuntime, qualificationReport, type QualificationBuild } from './report';
import logo from '../../product-icon.svg';
import './qualification.css';

const build: QualificationBuild = {
  source: import.meta.env.VITE_DOTIFY_BUILD_SHA ?? 'unknown',
  clean: import.meta.env.VITE_DOTIFY_BUILD_CLEAN === 'true',
  configDigest: import.meta.env.VITE_DOTIFY_BUILD_CONFIG_DIGEST ?? 'unknown',
  productId: 'dotify-test01.dot',
  appVersion: import.meta.env.VITE_DOTIFY_PRODUCT_APP_VERSION ?? 'development',
  sdk: JSON.parse(import.meta.env.VITE_DOTIFY_QUALIFICATION_SDK ?? '{"product":"development","host":"development","truapi":"development"}')
};

export function HostQualification() {
  const [requestedAt, setRequestedAt] = useState<string>();
  const [copyStatus, setCopyStatus] = useState('');
  const host = useProductHostInfo(Boolean(requestedAt));
  const settled = Boolean(host && host.status !== 'pending');
  const compatible = hasSupportedQualificationRuntime(host);
  const report = settled && requestedAt ? JSON.stringify(qualificationReport(build, host, requestedAt), null, 2) : '';
  const status = !requestedAt
    ? 'Ready to read'
    : !settled
      ? 'Reading app information…'
      : compatible
        ? 'Runtime 0.31 detected'
        : host?.status === 'timeout'
          ? 'The Host did not answer in time'
          : 'Runtime needs review';

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(report);
      setCopyStatus('Support report copied.');
    } catch {
      setCopyStatus('Select and copy the report below.');
    }
  }

  return (
    <main className='qualification'>
      <header className='qualification-brand'>
        <img src={logo} width='38' height='38' alt='' />
        <span>Dotify</span>
        <span className='qualification-badge'>Host qualification</span>
      </header>
      <div className='qualification-layout'>
        <section className='qualification-intro' aria-labelledby='qualification-title'>
          <p className='qualification-eyebrow'>Before your new artist space</p>
          <h1 id='qualification-title'>
            One small check.
            <br />A clear next step.
          </h1>
          <p>Read the Polkadot app’s Runtime, then share its support report. This first check only reads public app information.</p>
          <div className='qualification-next'>
            <span aria-hidden='true'>02</span>
            <p>Next, we’ll confirm your artist account in Polkadot before creating your new space.</p>
          </div>
        </section>
        <section className='qualification-panel' aria-labelledby='host-reading'>
          <div className='qualification-panel-heading'>
            <span className='qualification-step' aria-hidden='true'>
              01
            </span>
            <div>
              <p className='qualification-eyebrow'>Read only</p>
              <h2 id='host-reading'>Your Polkadot app</h2>
            </div>
          </div>
          <p className={`qualification-status${compatible ? ' qualification-status-ok' : ''}`} role='status' aria-live='polite'>
            {status}
          </p>
          <dl className='qualification-facts'>
            <div>
              <dt>Application</dt>
              <dd>{host?.status === 'reported' ? host.name : '—'}</dd>
            </div>
            <div>
              <dt>App version</dt>
              <dd>{host?.status === 'reported' ? host.version : '—'}</dd>
            </div>
            <div>
              <dt>Runtime</dt>
              <dd>{host?.status === 'reported' ? (host.runtimeVersion ?? 'Not reported') : '—'}</dd>
            </div>
          </dl>
          <button className='qualification-primary' disabled={Boolean(requestedAt)} onClick={() => setRequestedAt(new Date().toISOString())}>
            Read app information
          </button>
          {settled ? (
            <div className='qualification-result'>
              <p>
                {compatible
                  ? 'The version reading passed. Keep this report for the account check.'
                  : 'Keep this report before another attempt. The reported Runtime has not passed this check.'}
              </p>
              <button className='qualification-secondary' onClick={() => void copyReport()}>
                Copy support report
              </button>
              <p className='qualification-copy-status' role='status'>
                {copyStatus}
              </p>
              <details>
                <summary>View support report</summary>
                <textarea aria-label='Support report' readOnly value={report} rows={12} spellCheck={false} />
              </details>
            </div>
          ) : null}
        </section>
      </div>
      <footer className='qualification-footer'>
        <span>Artist-owned. Human-centered.</span>
        <span>
          Source <code>{build.source === 'unknown' ? 'local preview' : build.source.slice(0, 8)}</code> · {build.clean ? 'clean build' : 'development preview'}
        </span>
      </footer>
    </main>
  );
}
