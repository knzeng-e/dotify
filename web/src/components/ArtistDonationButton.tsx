import { Heart, X } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { formatEther, parseEther, parseAbi, zeroHash, type Address, type Hash } from 'viem';
import { musicRegistryAbi } from '../generated/contracts/musicRegistry';
import { contributionE2e } from '../e2e/contributionMock';
import { Dialog } from './Dialog';
import { useWalletContext, useSessionContext, useUiFeedback } from '../app/providers';
import type { CatalogTrack } from '../shared/types';
import { contributionReader, newContributionContext } from '../features/donations/contributions';
import { runContribution, type ContributionIntent, type ContributionOutcome } from '../features/donations/contributionFlow';
import { useContributionWriter } from '../features/donations/useContributionWriter';
import { nativeCurrencyForChain } from '../shared/config/contracts';
import { getBlockscoutTxUrl } from '../shared/utils/explorer';
import { SupportNotSubmittedError } from '../features/payments/supportPayment';

type ContributionButtonProps = { track: CatalogTrack; kind?: 'gift' | 'tip'; iconOnly?: boolean };
export function ArtistDonationButton(props: ContributionButtonProps) {
  const wallet = useWalletContext();
  const session = useSessionContext();
  const chainScope = wallet.expectedChainId ?? wallet.connectedWallet?.chainId ?? 'pending';
  const scope = `${chainScope}:${wallet.ethRpcUrl}:${wallet.listenerEvmAddress}:${props.track.id}:${props.kind}:${session.roomId}`;
  return <ContributionButton key={scope} {...props} />;
}

function ContributionButton({ track, kind = 'gift', iconOnly = false }: ContributionButtonProps) {
  const wallet = useWalletContext();
  const session = useSessionContext();
  const { openWalletModal } = useUiFeedback();
  const writer = useContributionWriter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [intent, setIntent] = useState<ContributionIntent>();
  const [outcome, setOutcome] = useState<ContributionOutcome>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [purpose, setPurpose] = useState('');
  const [available, setAvailable] = useState<bigint>();
  const account = useRef(wallet.listenerEvmAddress);
  useLayoutEffect(() => {
    account.current = wallet.listenerEvmAddress;
    return () => {
      account.current = null;
    };
  }, [wallet.listenerEvmAddress]);
  const label = kind === 'tip' ? 'Support this track' : 'Give to the artist';
  const symbol = (wallet.expectedChainId ? nativeCurrencyForChain(wallet.expectedChainId, wallet.ethRpcUrl).symbol : '') || 'PAS';
  async function review() {
    if (busy) return;
    const reader = contributionReader(wallet.ethRpcUrl);
    const expectedChainId = wallet.expectedChainId ?? wallet.connectedWallet?.chainId ?? (contributionE2e ? await reader.client.getChainId() : null);
    if (!wallet.listenerEvmAddress || !expectedChainId) {
      openWalletModal('support');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (!/^\d+(\.\d{1,18})?$/.test(amount.replace(',', '.'))) throw new Error('Enter a positive amount with at most 18 decimals.');
      const value = parseEther(amount.replace(',', '.'));
      if (value <= 0n) throw new Error('Choose an amount greater than zero.');
      const runtime = track.id.split(':')[0] as Address;
      if ((await reader.client.getChainId()) !== expectedChainId) throw new Error('The network changed. Reconnect before contributing.');
      if (!contributionE2e) {
        const [record] = await reader.client.readContract({
          address: runtime,
          abi: musicRegistryAbi,
          functionName: 'musicRegGetTrack',
          args: [track.hash as Hash]
        });
        if (!record.active || (track.artistAddress && record.artist.toLowerCase() !== track.artistAddress.toLowerCase()))
          throw new Error('The receiving artist changed. Refresh the release.');
        if (kind === 'gift') {
          const owner = await reader.client.readContract({
            address: runtime,
            abi: parseAbi(['function owner() view returns (address)']),
            functionName: 'owner'
          });
          if (owner.toLowerCase() !== record.artist.toLowerCase())
            throw new Error('This profile no longer controls the receiving runtime. Refresh the artist profile.');
        }
        for (const storage of [localStorage, sessionStorage]) {
          for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (key?.startsWith('dotify.gift.v1:') && key.toLowerCase().includes(`:${wallet.listenerEvmAddress.toLowerCase()}:`))
              throw new Error('An earlier direct gift is unresolved. Check it in your wallet before starting a new contribution.');
          }
        }
        const balance = await reader.client.getBalance({ address: wallet.listenerEvmAddress }).catch(() => undefined);
        setAvailable(balance);
        if (balance !== undefined && balance < value)
          throw new Error(`Insufficient funds: ${formatEther(balance)} ${symbol} available; ${formatEther(value)} ${symbol} requested, plus network fees.`);
      }
      const context = newContributionContext(kind === 'tip' ? (track.hash as Hash) : zeroHash);
      let proof: Hash = '0x';
      if (kind === 'tip' && session.roomId) {
        const socket = session.socketRef.current;
        if (!socket?.connected) throw new Error('Reconnect to the room before preparing a room tip.');
        const reply = await new Promise<import('../features/rooms/roomRealtimePort').RoomContributionReply>((resolve, reject) => {
          socket.request(
            'room:tip-quote',
            { runtime, contentHash: context.contentHash, sender: wallet.listenerEvmAddress!, intentId: context.intentId, amount: value.toString() },
            { timeoutMs: 15000 },
            (err, result) => (err ? reject(err) : result ? resolve(result) : reject(new Error('The room did not respond.')))
          );
        });
        if (!reply.ok) throw new Error(reply.error);
        context.host = reply.host;
        context.room = reply.room;
        context.expiresAt = BigInt(reply.expiresAt);
        proof = reply.proof;
      }
      let quote;
      try {
        quote = await reader.quote(runtime, context, value);
      } catch (failure) {
        throw new Error(
          `Contributions could not be prepared. This artist may need to update their runtime. ${failure instanceof Error ? failure.message.split('\n')[0] : ''}`
        );
      }
      if (account.current !== wallet.listenerEvmAddress) throw new Error('Your account changed. Prepare the contribution again.');
      const policy = await reader.policy(runtime, context.contentHash);
      if ((await reader.quote(runtime, context, value)).digest !== quote.digest) throw new Error('The contribution settings changed. Review them again.');
      const now = BigInt(Math.floor(Date.now() / 1000));
      setPurpose(now >= policy.startsAt && (!policy.endsAt || now < policy.endsAt) ? policy.description : '');
      setIntent({ network: expectedChainId, sender: wallet.listenerEvmAddress, runtime, amount: value, context, quote, proof });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not prepare this contribution.');
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    if (!intent || busy) return;
    setBusy(true);
    setError('');
    const reader = contributionReader(wallet.ethRpcUrl);
    try {
      const result = await runContribution({
        intent,
        storage: localStorage,
        currentAccount: () => account.current?.toLowerCase() === intent.sender.toLowerCase(),
        send: async () => {
          try {
            if ((await reader.client.getChainId()) !== intent.network) throw new Error('The network changed.');
            const latest = await reader.quote(intent.runtime, intent.context, intent.amount);
            if (latest.digest !== intent.quote.digest) throw new Error('The distribution changed. Review it again before sending.');
            if (account.current?.toLowerCase() !== intent.sender.toLowerCase())
              throw new Error('The account or listening context changed. Prepare this contribution again.');
            if (!writer.contributionCall) throw new Error('This wallet cannot submit contributions.');
          } catch (failure) {
            throw new SupportNotSubmittedError(failure);
          }
          return writer.contributionCall!(intent.runtime, 'musicGiftContribute', [intent.context, intent.quote.digest, intent.proof], intent.amount);
        },
        confirm: async (hash, id) => {
          try {
            return await reader.receipt(intent.runtime, hash, id);
          } catch (error) {
            // Product can return a native extrinsic hash. The finalized event's
            // intent identity also recovers its EVM receipt without another write.
            const receipt = (await reader.history(intent.runtime)).find(row => row.id === id);
            if (receipt) return receipt;
            throw error;
          }
        },
        recover: async id => (await reader.history(intent.runtime)).find(row => row.id === id)
      });
      setOutcome(result);
      if (result.receipt && result.receipt.room !== zeroHash)
        session.socketRef.current?.request(
          'room:tip-notify',
          { runtime: intent.runtime, hash: result.receipt.transactionHash },
          { timeoutMs: 15000 },
          () => {}
        );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not check the contribution.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className={iconOnly ? 'transport-secondary' : 'secondary-action'}
        aria-label={label}
        title={label}
        onClick={event => {
          event.currentTarget.focus();
          setOpen(true);
        }}
      >
        <Heart size={18} />
        {!iconOnly && label}
      </button>
      {open && (
        <Dialog historyDismiss className='artist-gift-dialog' size='compact' labelledBy='contribution-title' onClose={() => setOpen(false)}>
          <div className='modal-header'>
            <div>
              <p className='eyebrow'>{kind === 'tip' ? track.artist : 'A personal gift'}</p>
              <h2 id='contribution-title'>{kind === 'tip' ? track.title : `Give to ${track.artist}`}</h2>
            </div>
            <button className='modal-close' aria-label='Close contribution' onClick={() => setOpen(false)}>
              <X size={18} />
            </button>
          </div>
          {!intent && !outcome && (
            <form
              onSubmit={event => {
                event.preventDefault();
                void review();
              }}
            >
              <p>
                {kind === 'tip'
                  ? 'Support this work and its contributors. Listening access stays unchanged.'
                  : 'Support the artist or the beneficiaries they have chosen.'}
              </p>
              <div className='gift-amount-options' role='group' aria-label='Suggested amounts'>
                {['0.1', '0.5', '1'].map(value => (
                  <button type='button' key={value} aria-pressed={amount === value} onClick={() => setAmount(value)}>
                    {value} {symbol}
                  </button>
                ))}
              </div>
              <label>
                {kind === 'gift' ? 'Gift' : 'Tip'} amount ({symbol})
                <input className='field' inputMode='decimal' value={amount} onChange={event => setAmount(event.target.value)} required />
              </label>
              <button className='primary-action' disabled={busy}>
                {busy ? 'Checking distribution…' : 'Review contribution'}
              </button>
            </form>
          )}
          {intent && !outcome && (
            <>
              <dl className='transaction-facts'>
                <div>
                  <dt>Total</dt>
                  <dd>
                    {formatEther(intent.amount)} {symbol}
                  </dd>
                </div>
                <div>
                  <dt>Paying account</dt>
                  <dd>
                    <code>{intent.sender}</code>
                  </dd>
                </div>
              </dl>
              <h3>Where your contribution goes</h3>
              {purpose && <p>{purpose}</p>}
              {available !== undefined && (
                <p>
                  Available balance: {formatEther(available)} {symbol}
                </p>
              )}
              <ul className='contribution-destinations'>
                {intent.quote.recipients.map(
                  (recipient, i) =>
                    intent.quote.amounts[i] > 0n && (
                      <li key={`${recipient}:${i}`}>
                        <span>
                          {['Artist / chosen beneficiary', 'Collaborator', 'Room host'][intent.quote.roles[i]]}
                          <small>{recipient}</small>
                        </span>
                        <strong>
                          {formatEther(intent.quote.amounts[i])} {symbol}
                        </strong>
                      </li>
                    )
                )}
              </ul>
              <p>Network fees are additional and shown by your wallet.</p>
              {intent.quote.campaign !== zeroHash && (
                <details>
                  <summary>Campaign reference</summary>
                  <code>{intent.quote.campaign}</code>
                </details>
              )}
              <div className='modal-actions'>
                <button className='secondary-action' disabled={busy} onClick={() => setIntent(undefined)}>
                  Change amount
                </button>
                <button className='primary-action' disabled={busy} onClick={() => void send()}>
                  {busy ? 'Awaiting confirmation…' : `Confirm ${kind} · ${formatEther(intent.amount)} ${symbol}`}
                </button>
              </div>
            </>
          )}
          {busy && <p role='status'>You can close this window. Closing does not cancel a transaction.</p>}
          {outcome && (
            <div role='status'>
              <p>{outcome.message}</p>
              {outcome.receipt && (
                <>
                  <time dateTime={new Date(outcome.receipt.timestamp).toISOString()}>{new Date(outcome.receipt.timestamp).toLocaleString()}</time>
                  <ul className='contribution-destinations'>
                    {outcome.receipt.shares.map((share, i) => (
                      <li key={i}>
                        <span>
                          <small>{share.recipient}</small>
                          {share.paid || share.claimed ? 'Received' : 'Available to claim'}
                        </span>
                        <strong>
                          {formatEther(share.amount)} {symbol}
                        </strong>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {outcome.hash && (
                <a href={getBlockscoutTxUrl(outcome.hash)} target='_blank' rel='noreferrer'>
                  View transaction
                </a>
              )}
              {outcome.status === 'uncertain' ? (
                <button className='secondary-action' disabled={busy} onClick={() => void send()}>
                  Check status · no new payment
                </button>
              ) : (
                <button
                  className='secondary-action'
                  onClick={() => {
                    setOutcome(undefined);
                    setIntent(undefined);
                    setAmount('');
                  }}
                >
                  Prepare another contribution
                </button>
              )}
            </div>
          )}
          {error && <p role='alert'>{error}</p>}
        </Dialog>
      )}
    </>
  );
}
