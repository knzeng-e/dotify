import { useEffect, useState } from 'react';
import { useWalletContext } from '../../app/providers';
import { getPublicClient } from '../../shared/config/contracts';
import { resolvePayoutAccount } from '../../features/artist-studio/payoutAccount';

export function PayoutAccount() {
  const { listenerEvmAddress: account, expectedChainId, ethRpcUrl } = useWalletContext();
  const scope = `${ethRpcUrl}:${expectedChainId}:${account}`;
  const [result, setResult] = useState<{ scope: string; address?: string; error?: string }>();
  useEffect(() => {
    let current = true;
    if (account && expectedChainId === 420420417) {
      void resolvePayoutAccount(getPublicClient(ethRpcUrl), account).then(
        address => {
          if (current) setResult({ scope, address });
        },
        () => {
          if (current) setResult({ scope, error: 'Native payout account unavailable. Check the beneficiary in its transaction receipt.' });
        }
      );
    }
    return () => {
      current = false;
    };
  }, [account, expectedChainId, ethRpcUrl, scope]);
  if (!account) return null;
  const latest = result?.scope === scope ? result : undefined;
  return (
    <details className='earnings-definition payout-account'>
      <summary>Payout account{expectedChainId === 420420417 ? ' · PAS on Paseo Asset Hub' : ''}</summary>
      <p>
        These earnings belong to <code>{account}</code>.
      </p>
      {expectedChainId === 420420417 && (
        <>
          <p>
            Native account: <code>{latest?.address ?? (latest?.error ? 'Unavailable' : 'Checking…')}</code>
          </p>
          {latest?.error && <p role='status'>{latest.error}</p>}
          <p>Check PAS on this account. CASH, DOT on other networks and another Host account have separate balances.</p>
        </>
      )}
    </details>
  );
}
