import { ExternalLink } from 'lucide-react';
import { useState, type MouseEvent } from 'react';
import { openProductHostExternalUrl, usesProductHostNavigation } from '../features/productHost/productHost';
import type { TransactionFeedbackFact } from '../shared/types';

export function TransactionFactValue({ fact }: { fact: TransactionFeedbackFact }) {
  const [failedHref, setFailedHref] = useState<string>();
  const value = fact.code ? <code>{fact.value}</code> : fact.value;
  if (!fact.href) return <span className='transaction-fact-value'>{value}</span>;

  const href = fact.href;
  async function openInHost(event: MouseEvent<HTMLAnchorElement>) {
    if (!usesProductHostNavigation()) return;
    event.preventDefault();
    setFailedHref(undefined);
    try {
      const result = await openProductHostExternalUrl(href);
      if (!result.ok) setFailedHref(href);
    } catch {
      setFailedHref(href);
    }
  }

  return (
    <span className='transaction-fact-value'>
      <a className='transaction-fact-link' href={href} target='_blank' rel='noreferrer' onClick={event => void openInHost(event)}>
        {value} <ExternalLink size={12} aria-hidden='true' />
      </a>
      {failedHref === href && <small role='status'>Polkadot could not open this link. You can copy it from the link menu.</small>}
    </span>
  );
}
