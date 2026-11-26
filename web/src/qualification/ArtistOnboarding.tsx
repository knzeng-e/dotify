import { useEffect, useRef, useState } from 'react';
import { formatUnits } from 'viem';
import logo from '../../product-icon.svg';
import { useProductHostInfo } from '../features/productHost/useProductHostInfo';
import { registryOwnerGuardAttestation } from '../shared/config/deploymentSafety';
import { readQualificationAccount } from './account';
import { artistSteps, openArtistOnboarding, type ArtistPreview } from './artistOnboardingSession';
import { hasSupportedQualificationRuntime } from './report';
import './qualification.css';

const source = import.meta.env.VITE_DOTIFY_BUILD_SHA ?? 'local preview';
const version = import.meta.env.VITE_DOTIFY_PRODUCT_APP_VERSION ?? 'development';
const pendingKey = `dotify:artist-onboarding:${registryOwnerGuardAttestation.factory}`;

function savedStage(): number | null {
  const value = localStorage.getItem(pendingKey);
  if (value === null) return null;
  if (!/^[0-7]$/.test(value)) throw new Error('The local approval record could not be read.');
  return Number(value);
}

export function ArtistOnboarding() {
  const [hostRequested, setHostRequested] = useState(false);
  const host = useProductHostInfo(hostRequested);
  const [busy, setBusy] = useState(false);
  const [accountVerified, setAccountVerified] = useState(false);
  const [status, setStatus] = useState('');
  const [preview, setPreview] = useState<ArtistPreview>();
  const [lastHash, setLastHash] = useState<string>();
  const [unresolved, setUnresolved] = useState(false);
  const session = useRef<Awaited<ReturnType<typeof openArtistOnboarding>>>();
  const request = useRef<AbortController>();
  const inFlight = useRef(false);

  useEffect(
    () => () => {
      request.current?.abort();
      session.current?.close();
    },
    []
  );

  async function run(action: (signal: AbortSignal) => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setStatus('');
    try {
      await action(controller.signal);
    } catch (error) {
      if (!controller.signal.aborted) {
        setPreview(undefined);
        setStatus(error instanceof Error ? error.message : 'Could not verify the next step. Check again.');
      }
    } finally {
      inFlight.current = false;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  function show(value: ArtistPreview) {
    const previous = savedStage();
    const waiting = previous !== null && value.status === 'review' && value.state.stage <= previous;
    if (previous !== null && !waiting) localStorage.removeItem(pendingKey);
    setPreview(value);
    setUnresolved(waiting);
  }

  async function check(signal: AbortSignal) {
    if (!session.current) {
      const account = await readQualificationAccount(host, signal);
      if (signal.aborted) return;
      if (account?.status !== 'reported') throw new Error('Polkadot did not confirm the account. Reopen this screen to try again.');
      const opened = await openArtistOnboarding(account);
      if (signal.aborted) {
        opened.close();
        return;
      }
      session.current = opened;
      setAccountVerified(true);
    }
    const next = await session.current.preview();
    if (!signal.aborted) show(next);
  }

  async function approve(signal: AbortSignal) {
    if (!session.current || preview?.status !== 'review' || savedStage() !== null) return;
    const reviewed = preview;
    setPreview(undefined);
    const result = await session.current.approve(reviewed, () => {
      signal.throwIfAborted();
      if (savedStage() !== null) throw new Error('Another approval is unresolved. Check Polkadot before retrying.');
      localStorage.setItem(pendingKey, String(reviewed.state.stage));
    });
    if (signal.aborted) return;
    if (result.status === 'changed') {
      show(result.preview);
      setStatus('The on-chain estimate changed. Review the updated step before approving.');
      return;
    }
    setLastHash(result.hash);
    setStatus('Transaction finalized. Check Paseo to review the next step.');
  }

  const compatible = hasSupportedQualificationRuntime(host);
  const review = preview?.status === 'review' ? preview : undefined;
  return (
    <main className='qualification'>
      <header className='qualification-brand'>
        <img src={logo} width='38' height='38' alt='' />
        Dotify
      </header>
      <div className='qualification-layout'>
        <section className='qualification-intro'>
          <h1>Set up your artist space</h1>
          <p>Use the Dotify artist account you selected in Polkadot. Review each step and its storage deposit before opening the wallet.</p>
        </section>
        <section className='qualification-panel' aria-labelledby='artist-onboarding-title'>
          <h2 id='artist-onboarding-title'>Artist setup on Paseo</h2>
          {!hostRequested && (
            <button className='qualification-primary' type='button' onClick={() => setHostRequested(true)}>
              Check Polkadot Runtime
            </button>
          )}
          {hostRequested && !compatible && (
            <p role='status'>{!host || host.status === 'pending' ? 'Reading app information…' : 'Open this build in Polkadot with Runtime 0.31.x.'}</p>
          )}
          {compatible && preview?.status !== 'ready' && (
            <button className='qualification-secondary' type='button' disabled={busy} onClick={() => void run(check)}>
              {accountVerified ? 'Check finalized artist state' : 'Verify artist account and read Paseo'}
            </button>
          )}
          {busy && <p role='status'>Waiting for Polkadot…</p>}
          {status && <p role='status'>{status}</p>}
          {lastHash && (
            <p>
              Finalized transaction <code style={{ overflowWrap: 'anywhere' }}>{lastHash}</code>
            </p>
          )}
          {preview?.status === 'ready' && (
            <p role='status'>
              Artist space ready. <code style={{ overflowWrap: 'anywhere' }}>{preview.runtime}</code>
            </p>
          )}
          {review && (
            <>
              <h3>
                {artistSteps[review.state.stage]} ({review.state.stage + 1} of 8)
              </h3>
              <p>
                Peak storage deposit: <strong>{formatUnits(review.deposit, review.nativeDecimals)} PAS</strong>. Polkadot displays the network fee in its
                approval screen.
              </p>
              {review.available < review.deposit && <p>The available balance is below the required deposit.</p>}
              {unresolved && (
                <>
                  <p>The previous approval has no confirmed progress. Check Polkadot transaction activity before retrying.</p>
                  <button
                    type='button'
                    className='qualification-secondary'
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        localStorage.removeItem(pendingKey);
                        setUnresolved(false);
                        setPreview(undefined);
                      })
                    }
                  >
                    I checked Polkadot and no approval is pending
                  </button>
                </>
              )}
              <button
                className='qualification-primary'
                type='button'
                disabled={busy || unresolved || review.available < review.deposit}
                onClick={() => void run(approve)}
              >
                Review in Polkadot
              </button>
            </>
          )}
        </section>
      </div>
      <footer className='qualification-footer'>
        Product {version} · Source <code>{source.slice(0, 8)}</code>
      </footer>
    </main>
  );
}
