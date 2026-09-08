import type { Address } from 'viem';
import type { ExecutableTrackAccessPaymentIntent } from './paymentModel';
import type { RuntimeReadPort } from '../runtime/runtimePorts';

export type RuntimeAccessPaymentReadback = {
  intent: ExecutableTrackAccessPaymentIntent;
  listenerAddress: Address;
  hasPaid: boolean;
  canAccess: boolean;
};

export type RuntimeAccessPaymentVerificationResult =
  | {
      ok: true;
      attempts: number;
      readback: RuntimeAccessPaymentReadback;
      error: null;
    }
  | {
      ok: false;
      attempts: number;
      readback: RuntimeAccessPaymentReadback | null;
      error: string;
    };

export const DEFAULT_RUNTIME_ACCESS_READBACK_ATTEMPTS = 6;
export const DEFAULT_RUNTIME_ACCESS_READBACK_DELAY_MS = 1_200;

export async function readRuntimeAccessPayment(input: {
  reader: RuntimeReadPort;
  intent: ExecutableTrackAccessPaymentIntent;
  listenerAddress: Address;
}): Promise<RuntimeAccessPaymentReadback> {
  const [hasPaid, canAccess] = await Promise.all([
    input.reader.hasPaid(input.intent.runtimeAddress, input.intent.contentHash, input.listenerAddress),
    input.reader.canAccess(input.intent.runtimeAddress, input.intent.contentHash, input.listenerAddress)
  ]);

  return {
    intent: input.intent,
    listenerAddress: input.listenerAddress,
    hasPaid,
    canAccess
  };
}

export async function verifyRuntimeAccessPayment(input: {
  reader: RuntimeReadPort;
  intent: ExecutableTrackAccessPaymentIntent;
  listenerAddress: Address;
  attempts?: number;
  delayMs?: number;
  sleep?: (delayMs: number) => Promise<void>;
}): Promise<RuntimeAccessPaymentVerificationResult> {
  const attempts = Math.max(1, Math.floor(input.attempts ?? DEFAULT_RUNTIME_ACCESS_READBACK_ATTEMPTS));
  const delayMs = Math.max(0, Math.floor(input.delayMs ?? DEFAULT_RUNTIME_ACCESS_READBACK_DELAY_MS));
  const sleep = input.sleep ?? wait;
  let lastReadback: RuntimeAccessPaymentReadback | null = null;
  let lastError = 'Runtime access read-back did not complete.';

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const readback = await readRuntimeAccessPayment(input);
      const readbackError = runtimeAccessPaymentReadbackError(readback);
      if (!readbackError) {
        return { ok: true, attempts: attempt, readback, error: null };
      }
      lastReadback = readback;
      lastError = readbackError;
    } catch (error) {
      lastError = `Runtime access read-back query failed: ${errorMessage(error)}`;
    }

    if (attempt < attempts) {
      await sleep(delayMs);
    }
  }

  return {
    ok: false,
    attempts,
    readback: lastReadback,
    error: lastError
  };
}

export function runtimeAccessPaymentReadbackError(readback: RuntimeAccessPaymentReadback): string | null {
  if (!readback.hasPaid && !readback.canAccess) {
    return 'The runtime did not confirm paid access for this account after the payment transaction was included.';
  }
  if (!readback.hasPaid) {
    return 'The runtime reports access, but not a paid Classic grant, after the payment transaction was included.';
  }
  if (!readback.canAccess) {
    return 'The runtime recorded the payment, but still denies playable access for this account. The release may be inactive or no longer using a policy that grants this wallet access.';
  }
  return null;
}

function wait(delayMs: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
