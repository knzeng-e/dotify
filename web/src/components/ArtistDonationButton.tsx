import { Heart, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { formatUnits } from 'viem';
import { Dialog } from './Dialog';
import { useCatalogContext } from '../app/providers/CatalogProvider';
import { useWalletContext } from '../app/providers/WalletProvider';
import { useUiFeedback } from '../app/providers/UiFeedbackProvider';
import { createDonationFlow, type DonationResult } from '../features/donations/donationFlow';
import { parseDonationAmount, type DonationArtist, type DonationPort } from '../features/donations/donationModel';
import { createViemDonationPort } from '../features/donations/viemDonation';
import { resolveRuntimeAdapterConfig } from '../features/runtime/runtimeAdapterConfig';
import { resolveProductHostConfig } from '../features/productHost/productHost';
import { E2E_CLASSIC_TRACK, isClassicUnlockE2e } from '../e2e/classicUnlockMock';
import { donationE2ePort } from '../e2e/donationMock';
import type { CatalogTrack } from '../shared/types';

type Quote = { artist: DonationArtist; port: DonationPort; account: string; sender: `0x${string}` };
export function ArtistDonationButton({ track }: { track: CatalogTrack }) {
  const catalog = useCatalogContext();
  const wallet = useWalletContext();
  const { openWalletModal } = useUiFeedback();
  const [flow] = useState(() => createDonationFlow(() => sessionStorage));
  const [open, setOpen] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [amount, setAmount] = useState('');
  const [reviewAmount, setReviewAmount] = useState<bigint | null>(null);
  const [result, setResult] = useState<DonationResult | null>(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const generation = useRef(0);
  const portRef = useRef<DonationPort | null>(null);
  const sendingRef = useRef(false);
  const account = `${wallet.connectedWallet?.method}:${wallet.listenerEvmAddress?.toLowerCase()}`;
  const accountRef = useRef(account);
  useLayoutEffect(() => {
    accountRef.current = account;
  }, [account]);
  useEffect(
    () => () => {
      generation.current++;
      if (!sendingRef.current) portRef.current?.destroy();
    },
    []
  );

  function close() {
    if (sendingRef.current) return;
    generation.current++;
    portRef.current?.destroy();
    portRef.current = null;
    setOpen(false);
    setQuote(null);
  }
  async function start() {
    if (!wallet.connectedWallet || !wallet.listenerEvmAddress) {
      openWalletModal('support');
      return;
    }
    const current = ++generation.current;
    setOpen(true);
    setQuote(null);
    setAmount('');
    setReviewAmount(null);
    setResult(null);
    setError('');
    let port: DonationPort | undefined;
    try {
      const artist = await catalog.resolveArtistForDonation(track);
      if (isClassicUnlockE2e && track.id === E2E_CLASSIC_TRACK.id) port = donationE2ePort();
      else if (wallet.connectedWallet.method === 'product-host') {
        if (resolveRuntimeAdapterConfig(import.meta.env).kind !== 'product-cdm')
          throw new Error('This version cannot approve gifts in Polkadot App. Use the native-support version or connect a browser wallet.');
        const signer = wallet.connectedWallet.keyRequestSigner;
        const { createProductDonationPort } = await import('../features/donations/productDonation');
        port = await createProductDonationPort({
          productId: resolveProductHostConfig(import.meta.env).productId,
          evmAddress: wallet.listenerEvmAddress,
          publicKey: signer && 'productPublicKey' in signer ? signer.productPublicKey : undefined
        });
      } else port = await createViemDonationPort(wallet.ethRpcUrl, wallet.listenerEvmAddress, wallet.getActiveWalletClient);
      if (generation.current !== current || accountRef.current !== account) {
        port.destroy();
        if (generation.current === current) setError('Your account changed. Close this window and prepare the gift again.');
        return;
      }
      portRef.current = port;
      setQuote({ artist, port, account, sender: wallet.listenerEvmAddress });
    } catch (failure) {
      port?.destroy();
      if (generation.current === current) setError(failure instanceof Error ? failure.message : 'The gift could not be prepared.');
    }
  }
  function review() {
    if (!quote) return;
    try {
      setReviewAmount(parseDonationAmount(amount, quote.port.asset.decimals));
      setError('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Check the amount.');
    }
  }
  async function give() {
    if (!quote || reviewAmount === null || sendingRef.current) return;
    const current = generation.current;
    sendingRef.current = true;
    setSending(true);
    setError('');
    try {
      const outcome = await flow.run({
        port: quote.port,
        sender: quote.sender,
        recipient: quote.artist.recipient,
        amount: reviewAmount,
        currentAccount: () => accountRef.current === quote.account
      });
      if (generation.current === current) setResult(outcome);
    } catch {
      if (generation.current === current) setError('The gift status could not be checked. Check your account activity before trying again.');
    } finally {
      sendingRef.current = false;
      if (generation.current === current) setSending(false);
      else quote.port.destroy();
    }
  }
  const symbol = quote?.port.asset.symbol ?? '';
  return (
    <>
      <button
        className='secondary-action'
        type='button'
        onClick={event => {
          // Safari does not focus a button on pointer activation. Give the
          // dialog an explicit return target before it moves focus inside.
          event.currentTarget.focus({ preventScroll: true });
          void start();
        }}
      >
        <Heart size={18} /> Give to the artist
      </button>
      {open && (
        <Dialog className='artist-gift-dialog' size='compact' labelledBy='artist-gift-title' onClose={close} dismissible={!sending}>
          <div className='modal-header'>
            <h2 id='artist-gift-title'>{result?.status === 'confirmed' ? 'Gift confirmed' : `Give to ${quote?.artist.name || track.artist}`}</h2>
            {!sending && (
              <button className='modal-close' aria-label='Close gift' type='button' onClick={close}>
                <X size={18} />
              </button>
            )}
          </div>
          {!quote && !error && <p role='status'>Checking the artist’s receiving account…</p>}
          {quote && !result && (
            <>
              <p>A direct gift to the artist. It does not unlock paid tracks or follow a release’s royalty split.</p>
              {reviewAmount === null ? (
                <form
                  onSubmit={event => {
                    event.preventDefault();
                    review();
                  }}
                >
                  <label htmlFor='artist-gift-amount'>Gift amount ({symbol})</label>
                  <input
                    className='field'
                    id='artist-gift-amount'
                    inputMode='decimal'
                    autoComplete='off'
                    placeholder='Choose an amount'
                    value={amount}
                    onChange={event => setAmount(event.target.value)}
                    aria-describedby={error ? 'artist-gift-error' : undefined}
                  />
                  <button className='primary-action' type='submit'>
                    Review gift
                  </button>
                </form>
              ) : (
                <>
                  <dl className='transaction-facts'>
                    <div>
                      <dt>Your gift</dt>
                      <dd>
                        {formatUnits(reviewAmount, quote.port.asset.decimals)} {symbol}
                      </dd>
                    </div>
                    <div>
                      <dt>Recipient</dt>
                      <dd>{quote.artist.name}</dd>
                    </div>
                    <div>
                      <dt>Network fees</dt>
                      <dd>Additional fees may apply. Review the confirmation in your wallet or Polkadot App.</dd>
                    </div>
                  </dl>
                  <details>
                    <summary>Receiving account</summary>
                    <p>Artist registered for “{quote.artist.releaseTitle}”</p>
                    <code>{quote.artist.recipient}</code>
                  </details>
                  {sending ? (
                    <p role='status'>Confirm the gift in your wallet or Polkadot App. Waiting for the network…</p>
                  ) : (
                    <div className='modal-actions'>
                      <button className='secondary-action' type='button' onClick={() => setReviewAmount(null)}>
                        Change amount
                      </button>
                      <button
                        className='primary-action'
                        type='button'
                        onClick={() => {
                          void give();
                        }}
                      >
                        Confirm gift · {formatUnits(reviewAmount, quote.port.asset.decimals)} {symbol}
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
          {result && quote && (
            <div role='status'>
              <p>{result.message}</p>
              <p>
                {formatUnits(result.amount, quote.port.asset.decimals)} {symbol} · {quote.artist.name}
              </p>
              {result.hash && (
                <details>
                  <summary>Gift reference</summary>
                  <code>{result.hash}</code>
                </details>
              )}
              {result.status === 'uncertain' && <p>Check your account activity before making another gift.</p>}
              {result.status === 'uncertain' && result.hash && quote.port.canCheckReceipt !== false && (
                <button
                  className='secondary-action'
                  type='button'
                  disabled={sending}
                  onClick={() => {
                    void give();
                  }}
                >
                  Check gift status
                </button>
              )}
              {(result.status === 'canceled' || result.status === 'failed') && (
                <button
                  className='secondary-action'
                  type='button'
                  onClick={() => {
                    setResult(null);
                    setReviewAmount(null);
                  }}
                >
                  Review again
                </button>
              )}
            </div>
          )}
          {error && (
            <p id='artist-gift-error' role='alert'>
              {error}
            </p>
          )}
        </Dialog>
      )}
    </>
  );
}
