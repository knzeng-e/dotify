import { useState, type FormEvent } from 'react';
import type { Hash } from 'viem';
import { useWalletContext } from '../../app/providers';
import { nativeRoyaltyReceipts } from '../../features/runtime/nativeRoyaltyReceipts';
import { nativeRoyaltyApiUrl } from '../../features/runtime/nativePaymentHistory';

export function NativeRoyaltyRecovery({ onSynced }: { onSynced: () => void }) {
  const { expectedChainId } = useWalletContext();
  const [hash, setHash] = useState('');
  const [block, setBlock] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const apiUrl = nativeRoyaltyApiUrl();
  if (expectedChainId !== 420420417 || !apiUrl) return null;
  async function verify(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    if (!/^0x[\da-f]{64}$/i.test(hash) || !/^\d+$/.test(block) || !Number.isSafeInteger(Number(block)) || Number(block) > 0xffff_ffff) {
      setMessage('Enter the native transaction hash and its block number from your account activity.');
      return;
    }
    setBusy(true);
    try {
      await nativeRoyaltyReceipts.recover(apiUrl!, hash as Hash, { number: Number(block) });
      setMessage('Native receipt verified and saved. Refreshing the known artist runtimes.');
      onSynced();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'This receipt could not be verified.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className='earnings-definition native-royalty-recovery'>
      <summary>Find an earlier native payment</summary>
      <p>Use its reference from Polkadot App or Subscan. This checks a finalized receipt and updates history; it sends no payment.</p>
      <form onSubmit={event => void verify(event)}>
        <label>
          Native transaction hash
          <input value={hash} onChange={event => setHash(event.target.value.trim())} disabled={busy} spellCheck={false} />
        </label>
        <label>
          Native block number
          <input value={block} onChange={event => setBlock(event.target.value)} disabled={busy} inputMode='numeric' />
        </label>
        <button type='submit' className='secondary-action' disabled={busy}>
          {busy ? 'Verifying receipt…' : 'Verify existing payment'}
        </button>
      </form>
      {message && <p role='status'>{message}</p>}
    </details>
  );
}
