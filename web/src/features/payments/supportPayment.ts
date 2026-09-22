import type { Hash } from 'viem';
import type { RuntimeReadPort, RuntimeWritePort } from '../runtime/runtimePorts';
import type { ExecutableTrackAccessPaymentIntent } from './paymentModel';
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
    if (/TransferFailed|insufficient (?:balance|funds)/i.test(item.message ?? '')) return true;
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
export type SupportProgress = 'checking' | 'approval' | 'confirming' | 'verifying';
export type SupportResult = {
  status: 'verified' | 'existing-access' | 'unverified' | 'uncertain' | 'canceled' | 'failed';
  failureKind?: 'funding-required';
  txHash?: Hash;
  message?: string;
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
  onProgress: (stage: SupportProgress, txHash?: Hash) => void;
  readOnly?: boolean;
  verificationOptions?: { attempts?: number; delayMs?: number };
};

// Tab-local recovery only. A journal is never proof of access: fresh contract
// reads gate playback. Never store a signing key, username or media key here.
export function createSupportPaymentFlow(storage: () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>) {
  const running = new Map<string, Promise<SupportResult>>();
  const memory = new Map<string, Attempt>();
  function keyFor(input: SupportInput) {
    return `dotify.support.v1:${input.network}:${input.listenerAddress.toLowerCase()}:${input.intent.runtimeAddress.toLowerCase()}:${input.intent.contentHash.toLowerCase()}`;
  }
  function read(key: string): Attempt | undefined {
    if (memory.has(key)) return memory.get(key);
    const raw = storage().getItem(key);
    if (!raw) return undefined;
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
    memory.set(key, value);
    return value;
  }
  function remember(key: string, attempt: Attempt) {
    memory.set(key, attempt);
    storage().setItem(key, JSON.stringify(attempt));
  }
  async function execute(input: SupportInput, key: string): Promise<SupportResult> {
    let attempt: Attempt | undefined;
    let submitted = false;
    let sending = false;
    try {
      input.onProgress('checking');
      attempt = read(key);
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
        // Reserve the attempt before asking for a signature. If storage is
        // unavailable, stop here: a reload must not offer a duplicate payment.
        remember(key, { version: 1, amountPlanck: input.intent.amountPlanck.toString(), symbol: input.intent.asset.symbol });
        sending = true;
        input.onProgress('approval');
        const txHash = await input.writer.payForAccess(input.intent);
        submitted = true;
        attempt = { version: 1, txHash, amountPlanck: input.intent.amountPlanck.toString(), symbol: input.intent.asset.symbol };
        remember(key, attempt);
      }
      if (attempt?.txHash && !input.readOnly) {
        input.onProgress('confirming', attempt.txHash);
        await input.writer.waitForTransaction(attempt.txHash);
      }
      if (!attempt) {
        return { status: 'unverified', message: 'No paid access is visible yet. No payment was sent by this check.' };
      }
      input.onProgress('verifying', attempt.txHash);
      const verification = await verifyRuntimeAccessPayment({ ...input, ...input.verificationOptions });
      return {
        status: verification.ok ? 'verified' : attempt.txHash ? 'unverified' : 'uncertain',
        txHash: attempt.txHash,
        verification,
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
        status: canceled ? 'canceled' : !safeToRetry && (sending || attempt) ? 'uncertain' : 'failed',
        failureKind: fundingRequired ? 'funding-required' : undefined,
        txHash: attempt?.txHash ?? memory.get(key)?.txHash,
        message: canceled
          ? 'No payment was sent. You can try again when you are ready.'
          : fundingRequired
            ? `This payment account could not cover the support and network fee. Add ${input.intent.asset.symbol} to the Polkadot account shown below, then try again. No payment was sent.`
            : error instanceof Error
              ? error.message
              : 'Payment could not be completed.'
      };
    }
  }
  return {
    run(input: SupportInput): Promise<SupportResult> {
      const key = keyFor(input);
      const inFlight = running.get(key);
      if (inFlight) return inFlight;
      const operation = execute(input, key)
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
