import { CircleCheckBig, Coins, ExternalLink, HandHeart, LoaderCircle, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { formatEther, parseEther, parseAbi, zeroHash, type Address, type Hash } from 'viem';
import { musicRegistryAbi } from '../generated/contracts/musicRegistry';
import { contributionE2e } from '../e2e/contributionMock';
import { Dialog } from './Dialog';
import { useWalletContext, useSessionContext, useUiFeedback } from '../app/providers';
import type { CatalogTrack } from '../shared/types';
import { confirmSubmittedContribution, contributionReader, decodeContributions, newContributionContext } from '../features/donations/contributions';
import {
  readSavedContribution,
  recoverSavedContribution,
  saveNativeContributionBlock,
  runContribution,
  type ContributionIntent,
  type ContributionOutcome,
  type ContributionScope
} from '../features/donations/contributionFlow';
import { contributionReconciliationDelay, waitForContributionReconciliation } from '../features/donations/contributionReconciliation';
import { useContributionWriter } from '../features/donations/useContributionWriter';
import { nativeCurrencyForChain } from '../shared/config/contracts';
import { getTransactionProofUrl } from '../shared/utils/explorer';
import type { NativeContributionBlock } from '../features/runtime/runtimePorts';
import { SupportNotSubmittedError } from '../features/payments/supportPayment';

type ContributionButtonProps = { track: CatalogTrack; kind?: 'gift' | 'tip' };
export function ArtistDonationButton(props: ContributionButtonProps) {
  const wallet = useWalletContext();
  const session = useSessionContext();
  const chainScope = wallet.expectedChainId ?? wallet.connectedWallet?.chainId ?? 'pending';
  const scope = `${chainScope}:${wallet.ethRpcUrl}:${wallet.listenerEvmAddress}:${props.track.id}:${props.kind}:${session.roomId}`;
  return <ContributionButton key={scope} {...props} />;
}

function ContributionButton({ track, kind = 'gift' }: ContributionButtonProps) {
  const wallet = useWalletContext();
  const session = useSessionContext();
  const { openWalletModal, pushNotice } = useUiFeedback();
  const writer = useContributionWriter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [intent, setIntent] = useState<ContributionIntent>();
  const [outcome, setOutcome] = useState<ContributionOutcome>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [checkingFinality, setCheckingFinality] = useState(false);
  const [pendingHash, setPendingHash] = useState<Hash>();
  const [pendingDiagnostic, setPendingDiagnostic] = useState<ContributionOutcome>();
  const [needsNativeBlock, setNeedsNativeBlock] = useState(false);
  const [receiptBlock, setReceiptBlock] = useState('');
  const monitorTask = useRef<Promise<void>>();
  const [purpose, setPurpose] = useState('');
  const [available, setAvailable] = useState<bigint>();
  const account = useRef(wallet.listenerEvmAddress);
  const monitoring = useRef(false);
  const monitorAbort = useRef<AbortController>();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      monitorAbort.current?.abort();
    };
  }, []);
  useLayoutEffect(() => {
    account.current = wallet.listenerEvmAddress;
    return () => {
      account.current = null;
    };
  }, [wallet.listenerEvmAddress]);
  const label = kind === 'tip' ? 'Tip this track' : 'Send a gift';
  const confirmed = outcome?.status === 'confirmed' && Boolean(outcome.receipt);
  const actionLabel = confirmed ? (kind === 'tip' ? 'Tip sent. View receipt' : 'Gift sent. View receipt') : label;
  const visibleActionLabel = confirmed ? (kind === 'tip' ? 'Tip sent' : 'Gift sent') : label;
  const ContributionIcon = kind === 'tip' ? Coins : HandHeart;
  const ActionIcon = confirmed ? CircleCheckBig : ContributionIcon;
  const symbol = (wallet.expectedChainId ? nativeCurrencyForChain(wallet.expectedChainId, wallet.ethRpcUrl).symbol : '') || 'PAS';
  const network = wallet.expectedChainId ?? wallet.connectedWallet?.chainId;
  const contributionScope: ContributionScope | undefined =
    wallet.listenerEvmAddress && network
      ? {
          network,
          sender: wallet.listenerEvmAddress,
          runtime: track.id.split(':')[0] as Address,
          context: { contentHash: kind === 'tip' ? (track.hash as Hash) : zeroHash }
        }
      : undefined;
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
  async function monitor(prepared?: ContributionIntent) {
    if (monitoring.current || !contributionScope) return;
    const abort = new AbortController();
    monitorAbort.current = abort;
    monitoring.current = true;
    setPending(true);
    setCheckingFinality(false);
    if (prepared) setPendingHash(undefined);
    setOutcome(undefined);
    setPendingDiagnostic(undefined);
    setError('');
    try {
      const reader = contributionReader(wallet.ethRpcUrl);
      let first = true;
      let retry = 0;
      while (mounted.current && !abort.signal.aborted) {
        const scope = prepared ?? contributionScope;
        const check = {
          confirm: (hash: Hash, id: Hash, nativeBlock?: NativeContributionBlock) =>
            confirmSubmittedContribution({
              mode: writer.contributionConfirmationMode,
              runtime: scope.runtime,
              hash,
              id,
              reader,
              nativeReceipt: async () => {
                if (!nativeBlock)
                  throw new Error(
                    'This older Product transaction needs its receipt block. Open the network receipt and enter its block number under Technical details. No new payment is needed.'
                  );
                if (contributionE2e && new URLSearchParams(location.search).get('e2eGift') !== 'native-api-recovery')
                  return reader.finalizedReceipt(scope.runtime, id);
                if (!writer.readFinalizedContributionLogs) throw new Error('Native contribution receipts are unavailable for this wallet.');
                const logs = await writer.readFinalizedContributionLogs(hash, nativeBlock);
                const receipt = decodeContributions(scope.runtime, logs).find(row => row.id === id);
                return receipt ? { ...receipt, proofKind: 'substrate-extrinsic' as const } : undefined;
              },
              polling: writer.contributionConfirmationMode === 'finalized-event' ? { attempts: 1 } : undefined
            }),
          recover: (id: Hash) => {
            if (writer.contributionConfirmationMode === 'finalized-event')
              throw new Error('The host returned no native transaction reference. Check account activity before paying again.');
            return reader.finalizedReceipt(scope.runtime, id);
          },
          currentAccount: () => account.current?.toLowerCase() === scope.sender.toLowerCase()
        };
        const result =
          prepared && first
            ? await runContribution({
                intent: prepared,
                storage: localStorage,
                ...check,
                send: async () => {
                  try {
                    if ((await reader.client.getChainId()) !== prepared.network) throw new Error('The network changed.');
                    const latest = await reader.quote(prepared.runtime, prepared.context, prepared.amount);
                    if (latest.digest !== prepared.quote.digest) throw new Error('The distribution changed. Review it again before sending.');
                    if (account.current?.toLowerCase() !== prepared.sender.toLowerCase())
                      throw new Error('The account or listening context changed. Prepare this contribution again.');
                    if (!writer.contributionCall) throw new Error('This wallet cannot submit contributions.');
                  } catch (failure) {
                    throw new SupportNotSubmittedError(failure);
                  }
                  let nativeBlock: NativeContributionBlock | undefined;
                  const hash = await writer.contributionCall!(
                    prepared.runtime,
                    'musicGiftContribute',
                    [prepared.context, prepared.quote.digest, prepared.proof],
                    prepared.amount,
                    block => {
                      nativeBlock = block;
                    }
                  );
                  return { hash, nativeBlock };
                }
              })
            : await recoverSavedContribution({ scope, storage: localStorage, ...check });
        first = false;
        if (!mounted.current) return;
        setPendingHash(result.hash);
        if (result.status === 'uncertain') {
          setPendingDiagnostic(result);
          setNeedsNativeBlock(
            writer.contributionConfirmationMode === 'finalized-event' &&
              Boolean(result.hash) &&
              readSavedContribution(scope, localStorage)?.nativeBlock?.index === undefined
          );
          const delay = contributionReconciliationDelay(retry);
          if (delay === undefined) {
            setOutcome({
              ...result,
              message:
                'Automatic checks are paused to protect shared network capacity. Check this saved contribution again when you are ready; no new payment will be sent.'
            });
            setPending(false);
            break;
          }
          retry += 1;
          setCheckingFinality(true);
          if (!(await waitForContributionReconciliation(delay, abort.signal))) return;
          continue;
        }
        setOutcome(result);
        setPending(false);
        if (result.status !== 'confirmed' || !result.receipt) break;
        pushNotice({
          tone: 'success',
          title: kind === 'tip' ? 'Tip sent' : 'Gift sent',
          message:
            kind === 'tip'
              ? `${formatEther(result.receipt.amount)} ${symbol} for “${track.title}”. The finalized receipt is ready.`
              : `${formatEther(result.receipt.amount)} ${symbol} for ${track.artist}. The finalized receipt is ready.`
        });
        if (result.receipt.room !== zeroHash)
          session.socketRef.current?.request(
            'room:tip-notify',
            { runtime: scope.runtime, hash: result.receipt.transactionHash },
            { timeoutMs: 15000 },
            () => {}
          );
        break;
      }
    } catch (failure) {
      if (mounted.current) {
        setError(failure instanceof Error ? failure.message : 'Could not check the contribution.');
        setPending(false);
      }
    } finally {
      if (monitorAbort.current === abort) monitorAbort.current = undefined;
      monitoring.current = false;
    }
  }
  function startMonitoring(prepared?: ContributionIntent) {
    if (monitoring.current) return;
    monitorTask.current = monitor(prepared);
    void monitorTask.current;
  }
  async function checkReceiptBlock() {
    if (!contributionScope) return;
    try {
      if (!/^\d+$/.test(receiptBlock)) throw new Error('Enter the block number from the network receipt.');
      saveNativeContributionBlock(contributionScope, Number(receiptBlock), localStorage);
      monitorAbort.current?.abort();
      await monitorTask.current;
      setNeedsNativeBlock(false);
      startMonitoring();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not check the receipt block.');
    }
  }
  const nativeRecovery = needsNativeBlock && (
    <form
      onSubmit={event => {
        event.preventDefault();
        void checkReceiptBlock();
      }}
    >
      <p>Older Product transactions need their receipt block once. Use the block shown in the network receipt linked above.</p>
      <label>
        Receipt block number
        <input className='field' inputMode='numeric' value={receiptBlock} onChange={event => setReceiptBlock(event.target.value)} required />
      </label>
      <button className='secondary-action'>Check receipt block</button>
    </form>
  );
  return (
    <>
      <button
        className='secondary-action contribution-action'
        data-kind={kind}
        data-confirmed={confirmed || undefined}
        type='button'
        aria-label={actionLabel}
        aria-haspopup='dialog'
        onClick={event => {
          event.currentTarget.focus();
          setOpen(true);
          if (!contributionScope) return;
          try {
            const saved = readSavedContribution(contributionScope, localStorage);
            if (saved) {
              setIntent(undefined);
              setPendingHash(saved.hash);
              startMonitoring();
            }
          } catch (failure) {
            setError(failure instanceof Error ? failure.message : 'Could not read the saved contribution.');
          }
        }}
      >
        <ActionIcon size={18} aria-hidden='true' />
        <span className='contribution-action-label'>{visibleActionLabel}</span>
        {kind === 'tip' && (
          <span className='contribution-action-short' aria-hidden='true'>
            {confirmed ? 'Sent' : 'Tip'}
          </span>
        )}
      </button>
      {open && (
        <Dialog historyDismiss className='artist-gift-dialog' size='compact' labelledBy='contribution-title' onClose={() => setOpen(false)}>
          <div className='modal-header'>
            <div>
              <p className='eyebrow contribution-purpose'>
                <ContributionIcon size={18} aria-hidden='true' />
                {kind === 'tip' ? 'Tip this track' : 'A personal gift'}
              </p>
              <h2 id='contribution-title'>{kind === 'tip' ? track.title : `Gift to ${track.artist}`}</h2>
            </div>
            <button className='modal-close' aria-label='Close contribution' onClick={() => setOpen(false)}>
              <X size={18} />
            </button>
          </div>
          {pending && (
            <div className='contribution-pending' role='status' aria-live='polite'>
              <LoaderCircle className='spin' size={23} aria-hidden='true' />
              <div>
                <strong>
                  {checkingFinality
                    ? pendingHash
                      ? writer.contributionConfirmationMode === 'finalized-event'
                        ? 'Checking contribution receipt'
                        : 'Checking network finality'
                      : 'Checking payment status'
                    : 'Waiting for confirmation'}
                </strong>
                <p>
                  {checkingFinality
                    ? pendingHash
                      ? 'We will keep checking the finalized contribution receipt without sending another payment.'
                      : 'The wallet result is incomplete. We will keep checking this saved contribution without sending another payment.'
                    : 'Approve in your wallet if asked. You can close this window while Dotify checks the result.'}
                </p>
                {pendingHash && (
                  <a
                    href={getTransactionProofUrl(
                      pendingHash,
                      writer.contributionConfirmationMode === 'finalized-event' ? 'substrate-extrinsic' : 'evm-transaction'
                    )}
                    target='_blank'
                    rel='noreferrer'
                  >
                    View transaction <ExternalLink size={14} aria-hidden='true' />
                  </a>
                )}
                {pendingDiagnostic && (
                  <details className='transaction-technical contribution-technical'>
                    <summary>Technical details</summary>
                    {pendingDiagnostic.technicalMessage && <code>{pendingDiagnostic.technicalMessage}</code>}
                    {pendingDiagnostic.latestCheckMessage && (
                      <p>
                        Latest check: <code>{pendingDiagnostic.latestCheckMessage}</code>
                      </p>
                    )}
                    <p>
                      Contribution reference: <code>{pendingDiagnostic.id}</code>
                    </p>
                    {pendingHash && (
                      <p>
                        Wallet transaction reference: <code>{pendingHash}</code>
                      </p>
                    )}
                    {nativeRecovery}
                  </details>
                )}
              </div>
            </div>
          )}
          {!intent && !outcome && !pending && (
            <form
              onSubmit={event => {
                event.preventDefault();
                void review();
              }}
            >
              <p>
                {kind === 'tip'
                  ? 'A voluntary tip for this track and its contributors. Listening access stays unchanged.'
                  : 'A voluntary gift to the artist or their chosen beneficiaries. It does not unlock listening access.'}
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
          {intent && !outcome && !pending && (
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
                <button className='primary-action' disabled={busy} onClick={() => startMonitoring(intent)}>
                  Confirm {kind} · {formatEther(intent.amount)} {symbol}
                </button>
              </div>
            </>
          )}
          {outcome && (
            <div className='contribution-result' data-status={outcome.status} role='status' aria-live='polite'>
              {outcome.status === 'confirmed' && outcome.receipt ? (
                <div className='contribution-result-head'>
                  <span className='contribution-result-mark' aria-hidden='true'>
                    <CircleCheckBig size={24} />
                  </span>
                  <div>
                    <h3>{kind === 'tip' ? 'Tip sent' : 'Gift sent'}</h3>
                    <p>
                      {formatEther(outcome.receipt.amount)} {symbol} {kind === 'tip' ? `for “${track.title}”` : `for ${track.artist}`}. Finalized and recorded.
                    </p>
                  </div>
                </div>
              ) : (
                <p>{outcome.message}</p>
              )}
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
              {((outcome.technicalMessage && outcome.technicalMessage !== outcome.message) || outcome.id) && (
                <details className='transaction-technical contribution-technical'>
                  <summary>Technical details</summary>
                  {outcome.technicalMessage && <code>{outcome.technicalMessage}</code>}
                  {outcome.latestCheckMessage && (
                    <p>
                      Latest check: <code>{outcome.latestCheckMessage}</code>
                    </p>
                  )}
                  {outcome.id && (
                    <p>
                      Contribution reference: <code>{outcome.id}</code>
                    </p>
                  )}
                  {nativeRecovery}
                </details>
              )}
              <div className='contribution-result-actions'>
                {outcome.hash && (
                  <a
                    className='secondary-action contribution-transaction-link'
                    href={getTransactionProofUrl(
                      outcome.hash,
                      outcome.receipt?.proofKind ?? (writer.contributionConfirmationMode === 'finalized-event' ? 'substrate-extrinsic' : 'evm-transaction')
                    )}
                    target='_blank'
                    rel='noreferrer'
                  >
                    <ExternalLink size={16} aria-hidden='true' />
                    View transaction
                  </a>
                )}
                {outcome.status === 'uncertain' ? (
                  <button
                    className='primary-action'
                    onClick={() => {
                      setOutcome(undefined);
                      startMonitoring();
                    }}
                  >
                    Check status again
                  </button>
                ) : (
                  <button
                    className='secondary-action'
                    onClick={() => {
                      setOutcome(undefined);
                      setIntent(undefined);
                      setAmount('');
                      setPendingHash(undefined);
                    }}
                  >
                    Send another {kind}
                  </button>
                )}
              </div>
            </div>
          )}
          {error && <p role='alert'>{error}</p>}
        </Dialog>
      )}
    </>
  );
}
