import { streamingMediaSource } from '../features/catalog/streamingMediaSource';
import { Check, Copy, Info, X } from 'lucide-react';
import { useState } from 'react';
import { AudioFailureDiagnostics } from './AudioFailureDiagnostics';
import { Dialog } from './Dialog';

function productVersion(): string | null {
  try {
    const parts: unknown = JSON.parse(import.meta.env.VITE_DOTIFY_PRODUCT_APP_VERSION ?? 'null');
    return Array.isArray(parts) && parts.length === 3 && parts.every(part => Number.isSafeInteger(part) && part >= 0) ? parts.join('.') : null;
  } catch {
    return null;
  }
}

function audioMode() {
  try {
    const capability = streamingMediaSource();
    return capability?.kind === 'managed' ? 'Progressive AAC (managed)' : capability ? 'Progressive AAC' : 'Compatibility AAC';
  } catch {
    return 'Not available';
  }
}

export function AboutDotify() {
  const [open, setOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const version = productVersion();
  const build = /^[a-f0-9]{40}$/i.test(import.meta.env.VITE_DOTIFY_BUILD_SHA ?? '') ? import.meta.env.VITE_DOTIFY_BUILD_SHA : 'Unavailable';
  const clean = import.meta.env.VITE_DOTIFY_BUILD_CLEAN === 'true';
  const details = [
    ['Dotify', version ? `Product ${version}` : 'Web'],
    ['Build', build],
    ['Source', clean ? 'Clean build' : 'Local or unverified changes'],
    ['Audio path', audioMode()],
    [
      'ManagedMediaSource',
      typeof window !== 'undefined' && typeof Reflect.get(window, 'ManagedMediaSource') === 'function'
        ? streamingMediaSource()?.kind === 'managed'
          ? 'Selected for AAC playback'
          : streamingMediaSource()?.kind === 'standard'
            ? 'Exposed, standard reader preferred'
            : 'Exposed, AAC unavailable'
        : 'Not exposed'
    ]
  ];
  // Only public build identifiers and media capabilities. Never serialize the
  // environment, wallet, URL, listening history or diagnostic event buffers.
  const diagnosticText = details.map(([label, value]) => `${label}: ${value}`).join('\n');

  async function copyDetails() {
    try {
      await navigator.clipboard.writeText(diagnosticText);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  }

  return (
    <>
      <button
        type='button'
        className='secondary-action compact-action about-dotify-trigger'
        onClick={event => {
          // Safari does not focus tapped buttons. Give Dialog an explicit
          // opening target to restore on Escape, Back or close.
          event.currentTarget.focus({ preventScroll: true });
          setCopyStatus('idle');
          setOpen(true);
        }}
        aria-haspopup='dialog'
      >
        <Info size={16} aria-hidden='true' />
        About Dotify
      </button>
      {open && (
        <Dialog historyDismiss size='compact' className='about-dotify' labelledBy='about-dotify-title' onClose={() => setOpen(false)}>
          <div className='modal-header'>
            <h2 id='about-dotify-title'>About Dotify</h2>
            <button type='button' className='modal-close' aria-label='Close About Dotify' onClick={() => setOpen(false)}>
              <X size={18} aria-hidden='true' />
            </button>
          </div>
          <p className='about-dotify-purpose'>Let the music connect the dots</p>
          <div className='about-dotify-version'>
            <span>{version ? 'Dotify version' : 'Dotify Web build'}</span>
            <strong>{version ?? (build === 'Unavailable' ? 'Unavailable' : build.slice(0, 8))}</strong>
          </div>
          {version && <p className='about-dotify-note'>This is Dotify’s version. Polkadot App has its own version, shown outside Dotify.</p>}
          <section className='about-dotify-support' aria-labelledby='about-dotify-support-title'>
            <h3 id='about-dotify-support-title'>Listening support</h3>
            <p className='about-dotify-note'>
              Sound or cover not behaving as expected? Copy a report before reloading or closing Dotify: recent listening details disappear when it restarts.
            </p>
            <AudioFailureDiagnostics prominent />
            <p className='about-dotify-note'>
              Only loading and playback timings, with the app build. No account, track name or audio. Nothing is sent automatically.
            </p>
          </section>
          <details className='about-dotify-details'>
            <summary>Technical details</summary>
            <dl>
              {details.slice(1).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <button type='button' className='secondary-action' onClick={() => void copyDetails()}>
              {copyStatus === 'copied' ? <Check size={16} aria-hidden='true' /> : <Copy size={16} aria-hidden='true' />}
              {copyStatus === 'copied' ? 'Copied' : 'Copy app details'}
            </button>
            <p className='about-dotify-note' role='status'>
              {copyStatus === 'failed'
                ? 'Copy is unavailable here. Select the details above or take a screenshot.'
                : copyStatus === 'copied'
                  ? 'App details copied. No account or listening information included.'
                  : 'Version and compatibility only. For a listening problem, use Copy support report above.'}
            </p>
          </details>
        </Dialog>
      )}
    </>
  );
}
