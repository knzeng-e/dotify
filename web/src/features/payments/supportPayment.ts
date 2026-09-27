import { formatEther, type Hash } from 'viem';
import type { RuntimeReadPort, RuntimeWritePort } from '../runtime/runtimePorts';
import { assertNativeAccessPayment, type ExecutableTrackAccessPaymentIntent, type PaymentAccountState } from './paymentModel';
import type { PaymentLock } from './paymentJournal';
import { readRuntimeAccessPayment, verifyRuntimeAccessPayment, type RuntimeAccessPaymentVerificationResult } from './paymentReadback';

// This error is only for failures before a writer has attempted submission.
export class SupportNotSubmittedError extends Error {
  readonly cause: unknown;
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : 'The payment could not be prepared.');
    this.cause = cause;
    this.name = 'SupportNotSubmittedError';
  }
}

export function supportNeedsFunding(error: unknown): boolean {
  for (let depth = 0; error && typeof error === 'object' && depth < 8; depth += 1) {
    const item = error as { message?: string; cause?: unknown };
    if (/TransferFailed|insufficient[ _]?(?:balance|funds)|FundsUnavailable|balance too low/i.test(item.message ?? '')) return true;
    error = item.cause;
  }
  return false;
}

export function supportWasCanceled(error: unknown): boolean {
  for (let depth = 0; error && typeof error === 'object' && depth < 8; depth++) {
    const item = error as { name?: string; code?: number; message?: string; cause?: unknown };
    if (item.code === 4001 || item.name === 'TxSigningRejectedError' || item.name === 'UserRejectedRequestError' || /user rejected/i.test(item.message ?? ''))
      return true;
    error = item.cause;
  }
  return false;
}

type Attempt = { version: 1; amountPlanck: string; symbol: string; txHash?: Hash };
export type SupportProgress = 'checking' | 'approval' | 'confirming' | 'processing' | 'finalized' | 'verifying';
export type SupportResult = {
  status: 'verified' | 'existing-access' | 'unverified' | 'uncertain' | 'canceled' | 'failed';
  failureKind?: 'funding-required';
  txHash?: Hash;
  message?: string;
  errorDetail?: string;
  accountState?: PaymentAccountState;
  verification?: RuntimeAccessPaymentVerificationResult;
  hasPaid?: boolean;
  amountPlanck?: bigint;
  assetSymbol?: string;
};
type SupportInput = {
  network: string;
  intent: ExecutableTrackAccessPaymentIntent;
  listenerAddress: `0x${string}`;
  reader: RuntimeReadPort;
  writer: RuntimeWritePort;
  currentAccount: () => boolean;
  onProgress: (stage: SupportProgress, txHash?: Hash, accountState?: PaymentAccountState) => void;
  readOnly?: boolean;
  verificationOptions?: { attempts?: number; delayMs?: number };
};

class PaymentLockUnavailableError extends Error {
  readonly cause: unknown;
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : 'Payment tracking is unavailable.');
    this.cause = cause;
    this.name = 'PaymentLockUnavailableError';
  }
}

// A journal is never proof of access: fresh contract
// reads gate playback. Never store a signing key, username or media key here.
export function createSupportPaymentFlow(
  storage: () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  lock: PaymentLock = (_key, operation) => operation()
) {
  const running = new Map<string, Promise<SupportResult>>();
  const memory = new Map<string, Attempt>();
  function keyFor(input: SupportInput) {
    return `dotify.support.v1:${input.network}:${input.listenerAddress.toLowerCase()}:${input.intent.runtimeAddress.toLowerCase()}:${input.intent.contentHash.toLowerCase()}`;
  }
  function read(key: string): Attempt | undefined {
    const raw = storage().getItem(key);
    if (!raw) return memory.get(key);
    const value = JSON.parse(raw) as Attempt;
    if (
      value?.version !== 1 ||
      typeof value.amountPlanck !== 'string' ||
      !/^[1-9]\d*$/.test(value.amountPlanck) ||
      typeof value.symbol !== 'string' ||
      !value.symbol.trim() ||
      (value.txHash !== undefined && !/^0x[\da-f]{64}$/i.test(value.txHash))
    )
      throw new Error('The saved payment reference could not be read. Check your account activity before trying again.');
    // Preserve a hash observed in this tab if its durable update failed.
    const saved = { ...value, txHash: value.txHash ?? memory.get(key)?.txHash };
    memory.set(key, saved);
    return saved;
  }
  function remember(key: string, attempt: Attempt) {
    memory.set(key, attempt);
    storage().setItem(key, JSON.stringify(attempt));
  }
  async function withJournalLock<T>(key: string, operation: () => T | Promise<T>): Promise<T> {
    let entered = false;
    try {
      return await lock(key, async () => {
        entered = true;
        return operation();
      });
    } catch (error) {
      if (!entered) throw new PaymentLockUnavailableError(error);
      throw error;
    }
  }
  async function execute(input: SupportInput, key: string): Promise<SupportResult> {
    let attempt: Attempt | undefined;
    let submitted = false;
    let sending = false;
    let accountState: PaymentAccountState | undefined;
    let finalized = false;
    let journalReadFailed = false;
    const readJournal = (journalKey: string) => {
      try {
        return read(journalKey);
      } catch (error) {
        journalReadFailed = true;
        throw error;
      }
    };
    try {
      assertNativeAccessPayment(input.intent);
      input.onProgress('checking');
      attempt = await withJournalLock(key, () => readJournal(key));
      const before = await readRuntimeAccessPayment(input);
      if (before.canAccess) {
        return { status: before.hasPaid && attempt ? 'verified' : 'existing-access', hasPaid: before.hasPaid, txHash: attempt?.txHash };
      }
      if (before.hasPaid) {
        return {
          status: 'unverified',
          hasPaid: true,
          txHash: attempt?.txHash,
          message: 'Your support is recorded. Listening is currently unavailable for this release. No new payment was sent.'
        };
      }
      if (!input.currentAccount()) throw new Error('Your connected account changed. Reopen this track with the account you want to use.');
      if (!attempt && !input.readOnly) {
        accountState = await input.writer.inspectPayment?.(input.intent);
        if (!input.currentAccount()) throw new Error('Your connected account changed. Reopen this track with the account you want to use.');
        const knownTotal = input.intent.amountPlanck + (accountState?.estimatedFee ?? 0n);
        if (accountState?.availableBalance !== undefined && accountState.availableBalance < knownTotal) {
          return {
            status: 'failed',
            failureKind: 'funding-required',
            accountState,
            message: `Your available balance is ${formatEther(accountState.availableBalance)} ${input.intent.asset.symbol}. This payment needs at least ${formatEther(knownTotal)} ${input.intent.asset.symbol}${accountState.estimatedFee === undefined ? ', plus the network fee' : ' including the estimated network fee'}. Add funds to the paying account. No payment was sent.`
          };
        }
        let reservedHere = false;
        const reserved = await withJournalLock(key, () => {
          const saved = readJournal(key);
          if (saved) return { attempt: saved, created: false };
          const next: Attempt = { version: 1, amountPlanck: input.intent.amountPlanck.toString(), symbol: input.intent.asset.symbol };
          // Reserve the attempt before asking for a signature. If storage is
          // unavailable, stop here: a reload must not offer a duplicate payment.
          remember(key, next);
          return { attempt: next, created: true };
        });
        attempt = reserved.attempt;
        reservedHere = reserved.created;
        if (reservedHere) {
          sending = true;
          input.onProgress('approval', undefined, accountState);
          const txHash = await input.writer.payForAccess(input.intent, (status, hash) => {
            if (status === 'broadcasting' || status === 'in-block' || status === 'finalized') submitted = true;
            if (status === 'finalized') finalized = true;
            if (hash) {
              submitted = true;
              attempt = { version: 1, txHash: hash, amountPlanck: input.intent.amountPlanck.toString(), symbol: input.intent.asset.symbol };
              remember(key, attempt);
            }
            if (status !== 'error')
              input.onProgress(status === 'signing' ? 'approval' : status === 'finalized' ? 'finalized' : 'processing', hash ?? attempt?.txHash, accountState);
          });
          submitted = true;
          attempt = { version: 1, txHash, amountPlanck: input.intent.amountPlanck.toString(), symbol: input.intent.asset.symbol };
          remember(key, attempt);
        }
      }
      if (attempt?.txHash && !input.readOnly) {
        input.onProgress(finalized ? 'finalized' : 'confirming', attempt.txHash, accountState);
        await input.writer.waitForTransaction(attempt.txHash);
      }
      if (!attempt) {
        return { status: 'unverified', message: 'No paid access is visible yet. No payment was sent by this check.' };
      }
      input.onProgress('verifying', attempt.txHash, accountState);
      const verification = await verifyRuntimeAccessPayment({ ...input, ...input.verificationOptions });
      return {
        status: verification.ok ? 'verified' : attempt.txHash ? 'unverified' : 'uncertain',
        txHash: attempt.txHash,
        verification,
        errorDetail: verification.ok ? undefined : verification.error,
        message: verification.ok ? undefined : 'Listening is not verified yet. Check again without sending another payment.'
      };
    } catch (error) {
      if (!sending && !attempt) memory.delete(key);
      const canceled = !submitted && sending && supportWasCanceled(error);
      const safeToRetry = !submitted && sending && (canceled || error instanceof SupportNotSubmittedError);
      const fundingRequired = safeToRetry && error instanceof SupportNotSubmittedError && supportNeedsFunding(error);
      if (safeToRetry) {
        memory.delete(key);
        try {
          storage().removeItem(key);
        } catch {
          /* Persisted reservation still prevents a new attempt after reload. */
        }
      }
      return {
        status: canceled
          ? 'canceled'
          : error instanceof PaymentLockUnavailableError || journalReadFailed || (!safeToRetry && (sending || attempt))
            ? 'uncertain'
            : 'failed',
        failureKind: fundingRequired ? 'funding-required' : undefined,
        txHash: attempt?.txHash ?? memory.get(key)?.txHash,
        accountState,
        errorDetail: paymentErrorDetail(error),
        message: canceled
          ? 'No payment was sent. You can try again when you are ready.'
          : fundingRequired
            ? `This payment account could not cover the support and network fee. Add ${input.intent.asset.symbol} to the paying account, then try again. No payment was sent.`
            : journalReadFailed
              ? 'The saved payment reference could not be read. Check your account activity before paying again. No new payment was sent.'
              : !safeToRetry && (sending || attempt)
                ? 'Payment confirmation was interrupted. Check access and account activity before paying again.'
                : 'Payment could not be prepared. Check your account connection and try again. No payment was sent.'
      };
    }
  }
  return {
    run(input: SupportInput): Promise<SupportResult> {
      const key = keyFor(input);
      const inFlight = running.get(key);
      if (inFlight) return inFlight;
      const operation = execute(input, key)
        .catch(
          (error): SupportResult => ({
            status: 'uncertain',
            message: 'Payment tracking is unavailable. Check your account activity before paying again.',
            errorDetail: paymentErrorDetail(error)
          })
        )
        .then(result => {
          const saved = memory.get(key);
          return { ...result, amountPlanck: saved ? BigInt(saved.amountPlanck) : undefined, assetSymbol: saved?.symbol };
        })
        .finally(() => running.delete(key));
      running.set(key, operation);
      return operation;
    }
  };
}

export function paymentErrorDetail(error: unknown): string {
  const messages: string[] = [];
  for (let depth = 0; error && depth < 8; depth += 1) {
    let message: string;
    try {
      message = error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error);
    } catch {
      message = String(error);
    }
    if (message && !messages.includes(message)) messages.push(message);
    error = typeof error === 'object' ? (error as { cause?: unknown }).cause : undefined;
  }
  return messages.join('\n');
}
