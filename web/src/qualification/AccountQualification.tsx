import { useEffect, useRef, useState } from 'react';
import { useProductHostInfo } from '../features/productHost/useProductHostInfo';
import { hasSupportedQualificationRuntime, type QualificationBuild } from './report';
import { readQualificationAccount, type AccountObservation } from './account';
import { accountQualificationReport } from './accountReport';
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

export function AccountQualification() {
  const [requestedAt, setRequestedAt] = useState<string>();
  const [account, setAccount] = useState<AccountObservation>();
  const [accountPending, setAccountPending] = useState(false);
  const [accountRequestedAt, setAccountRequestedAt] = useState<string>();
  const [ownerConfirmed, setOwnerConfirmed] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const controller = useRef<AbortController>();
  const attempted = useRef(false);
  const host = useProductHostInfo(Boolean(requestedAt));
  const compatible = hasSupportedQualificationRuntime(host);
  const hostSettled = host && host.status !== 'pending';
  const report =
    hostSettled && !accountPending && requestedAt
      ? JSON.stringify(accountQualificationReport(build, host, requestedAt, account, ownerConfirmed, accountRequestedAt), null, 2)
      : '';
  useEffect(() => () => controller.current?.abort(), []);

  async function readAccount() {
    if (!compatible || attempted.current) return;
    attempted.current = true;
    controller.current = new AbortController();
    setAccountPending(true);
    setAccountRequestedAt(new Date().toISOString());
    setCopyStatus('');
    const result = await readQualificationAccount(host, controller.current.signal);
    if (!controller.current.signal.aborted && result) {
      setAccount(result);
      setAccountPending(false);
    }
  }
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
        <span className='qualification-badge'>Account qualification</span>
      </header>
      <div className='qualification-layout'>
        <section className='qualification-intro' aria-labelledby='account-title'>
          <p className='qualification-eyebrow'>Before your new artist space</p>
          <h1 id='account-title'>
            Your account.
            <br />
            Your artist space.
          </h1>
          <p>Share your Dotify account from the Polkadot app, then check its public addresses before the next step.</p>
          <div className='qualification-next'>
            <span aria-hidden='true'>03</span>
            <p>Creating your artist space comes later, with its own wallet approvals.</p>
          </div>
        </section>
        <section className='qualification-panel' aria-labelledby='account-reading'>
          <div className='qualification-panel-heading'>
            <span className='qualification-step' aria-hidden='true'>
              02
            </span>
            <div>
              <p className='qualification-eyebrow'>Public addresses</p>
              <h2 id='account-reading'>Your Dotify account</h2>
            </div>
          </div>
          <p className='qualification-status' role='status' aria-live='polite'>
            {!requestedAt
              ? 'Start with your Polkadot app'
              : !hostSettled
                ? 'Reading app information…'
                : compatible
                  ? `Runtime ${host?.status === 'reported' ? host.runtimeVersion : ''} detected`
                  : 'Runtime needs review'}
          </p>
          <button className='qualification-secondary' disabled={Boolean(requestedAt)} onClick={() => setRequestedAt(new Date().toISOString())}>
            Read app information
          </button>
          <div className='qualification-result'>
            <p>This shares the public account for Dotify in your Polkadot app. It requests no signature, payment or personal profile.</p>
            <button className='qualification-primary' disabled={!compatible || Boolean(accountRequestedAt)} onClick={() => void readAccount()}>
              Share my Dotify account
            </button>
            <p className='qualification-copy-status' role='status'>
              {accountPending
                ? 'Waiting for the Polkadot app…'
                : account?.status === 'reported'
                  ? 'Account received. Check the addresses below.'
                  : account
                    ? 'Account check incomplete. Keep the report before reopening Dotify.'
                    : ''}
            </p>
            {account?.status === 'reported' ? (
              <>
                <dl className='qualification-facts'>
                  <div>
                    <dt>Substrate</dt>
                    <dd>{account.substrateAddress}</dd>
                  </div>
                  <div>
                    <dt>EVM</dt>
                    <dd>{account.evmAddress}</dd>
                  </div>
                </dl>
                <p>
                  These are two address formats for this Dotify account. Compare with the account you intend to use; a different app or account index can have
                  different addresses.
                </p>
                <label className='qualification-confirm'>
                  <input
                    type='checkbox'
                    checked={ownerConfirmed}
                    onChange={event => {
                      setOwnerConfirmed(event.target.checked);
                      setCopyStatus('');
                    }}
                  />
                  This is the account I want to use for my artist space.
                </label>
              </>
            ) : null}
            {report ? (
              <>
                <p>The report includes public addresses after you share an account. Review it before sharing it for support.</p>
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
              </>
            ) : null}
          </div>
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
