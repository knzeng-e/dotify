import { Check, Copy, Info, X } from 'lucide-react';
import { useState } from 'react';
import { Dialog } from './Dialog';

const AAC_TYPE = 'audio/mp4; codecs="mp4a.40.2"';

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
    return typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported(AAC_TYPE) ? 'Progressive AAC' : 'Compatibility AAC';
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
    ['ManagedMediaSource', typeof window !== 'undefined' && 'ManagedMediaSource' in window ? 'Exposed, not used by this build' : 'Not exposed']
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
        onClick={() => {
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
          <p className='about-dotify-purpose'>Music brings us together.</p>
          <div className='about-dotify-version'>
            <span>{version ? 'Dotify version' : 'Dotify Web build'}</span>
            <strong>{version ?? (build === 'Unavailable' ? 'Unavailable' : build.slice(0, 8))}</strong>
          </div>
          {version && <p className='about-dotify-note'>This is Dotify’s version. Polkadot App has its own version, shown outside Dotify.</p>}
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
          </details>
          <button type='button' className='secondary-action' onClick={() => void copyDetails()}>
            {copyStatus === 'copied' ? <Check size={16} aria-hidden='true' /> : <Copy size={16} aria-hidden='true' />}
            {copyStatus === 'copied' ? 'Copied' : 'Copy app details'}
          </button>
          <p className='about-dotify-note' role='status'>
            {copyStatus === 'failed'
              ? 'Copy is unavailable here. Open Technical details to select the text or take a screenshot.'
              : copyStatus === 'copied'
                ? 'App details copied. No account or listening information included.'
                : 'Only app details are copied. No account or listening information.'}
          </p>
        </Dialog>
      )}
    </>
  );
}
