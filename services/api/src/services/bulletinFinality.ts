// One explicit PAPI submission. Cancellation only stops observation, not finality.
import assert from 'node:assert/strict';
import type { PolkadotClient } from 'polkadot-api';
import type { getTxCreator } from 'polkadot-api/tx-creator';
export type BulletinTransactionCreator = ReturnType<typeof getTxCreator>;
type StoreTransaction = ReturnType<ReturnType<PolkadotClient['getUnsafeApi']>['tx'][string][string]>;

export function watchFinalized(
  tx: StoreTransaction,
  signer: BulletinTransactionCreator,
  nonce: number,
  { timeoutMs = 120_000, signal }: { timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<{ block: number; index: number }> {
  assert.equal(typeof signer, 'function', 'PAPI 3 requires an explicit transaction creator, not a PAPI 2 signer object');
  assert.ok(Number.isSafeInteger(nonce) && nonce >= 0 && nonce <= 0xffffffff, 'Invalid explicit nonce');
  assert.ok(Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 120_000, 'Invalid finality deadline');
  signal?.throwIfAborted();
  return new Promise<{ block: number; index: number }>((resolve, reject) => {
    const abort = () => finish(signal?.reason instanceof Error ? signal.reason : new Error('Bulletin submission cancelled; outcome is unknown'));
    let subscription: { unsubscribe(): void } | undefined,
      timer: ReturnType<typeof setTimeout> | undefined,
      settled = false;
    const finish = (error: Error | null, receipt?: { block: number; index: number }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      try {
        subscription?.unsubscribe();
      } catch {}
      if (error) reject(error);
      else resolve(receipt!);
    };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) {
      abort();
      return;
    }
    timer = setTimeout(() => finish(new Error('Finality deadline exceeded; submission outcome is unknown')), timeoutMs);
    try {
      subscription = tx.createSubmitAndWatch(signer, { nonce }).subscribe({
        next(event) {
          if (settled || event.type !== 'finalized') return;
          try {
            assert.ok(event.ok === true, 'Finalized transaction dispatch did not succeed');
            assert.ok(Number.isSafeInteger(event.block?.number) && event.block.number >= 0, 'Missing finalized block');
            // This is the storage pallet index, not the extrinsic's index in the block.
            const stored = event.events?.filter(e => e.type === 'TransactionStorage' && e.value?.type === 'Stored');
            assert.equal(stored?.length, 1, 'Expected exactly one direct storage receipt');
            const index = (stored[0].value.value as { index?: number })?.index;
            assert.ok(Number.isSafeInteger(index) && index! >= 0, 'Missing finalized storage index');
            finish(null, { block: event.block.number, index: index! });
          } catch (error) {
            finish(error instanceof Error ? error : new Error('Unknown transaction failure'));
          }
        },
        error: error => finish(error instanceof Error ? error : new Error('Unknown transaction failure')),
        complete: () => finish(new Error('Subscription ended without finalized storage; outcome is unknown'))
      });
      if (settled) {
        try {
          subscription.unsubscribe();
        } catch {}
      } // Synchronous observable test/implementation.
    } catch (error) {
      finish(error instanceof Error ? error : new Error('Unknown transaction failure'));
    }
  });
}
