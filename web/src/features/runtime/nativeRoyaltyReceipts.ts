import { decodeEventLog, type Address, type Hash } from 'viem';
import { musicRoyaltiesAbi } from '../../generated/contracts/musicRoyalties';
import type { NativeContributionBlock, NativeContributionLog } from './runtimePorts';
import { readNativeContributionReceiptApi } from './nativeContributionReceiptApi';
import { browserPaymentLock, type PaymentLock } from '../payments/paymentJournal';

type Reference = { hash: Hash; runtime: Address; block?: NativeContributionBlock };
type Store = Pick<Storage, 'getItem' | 'setItem'>;
const validHex = (v: unknown, length: number) => typeof v === 'string' && new RegExp(`^0x[\\da-f]{${length}}$`, 'i').test(v);

function hasRoyalty(logs: NativeContributionLog[], runtime?: Address) {
  return logs.some(log => {
    if (runtime && log.address.toLowerCase() !== runtime.toLowerCase()) return false;
    try {
      const event = decodeEventLog({ abi: musicRoyaltiesAbi, topics: log.topics as [Hash, ...Hash[]], data: log.data });
      return ['MusicRoyAccessPaid', 'MusicRoyRoyaltyPaid', 'MusicRoyRoyaltyClaimable', 'MusicRoyRoyaltyClaimed', 'MusicRoyRoyaltyClaimFailed'].includes(
        event.eventName
      );
    } catch {
      return false;
    }
  });
}

/** Public receipt references only. Retries verify an existing transaction; never sign or pay. */
export function createNativeRoyaltyReceiptQueue(storage: () => Store, lock: PaymentLock = browserPaymentLock) {
  const memory = new Map<string, Reference[]>();
  let serial: Promise<unknown> = Promise.resolve();
  const key = (apiUrl: string) => `dotify.native-royalties.v1:${apiUrl.replace(/\/$/, '')}:420420417`;
  function read(apiUrl: string): Reference[] {
    const raw = storage().getItem(key(apiUrl));
    const value: unknown = raw === null ? [] : JSON.parse(raw);
    if (
      !Array.isArray(value) ||
      value.length > 1000 ||
      value.some(
        row =>
          !row ||
          !validHex(row.hash, 64) ||
          !validHex(row.runtime, 40) ||
          (row.block !== undefined &&
            (!Number.isSafeInteger(row.block.number) ||
              row.block.number < 0 ||
              !validHex(row.block.hash, 64) ||
              !Number.isSafeInteger(row.block.index) ||
              row.block.index < 0))
      )
    )
      throw new Error('Saved native payment references are unreadable. Keep them before repairing history.');
    const rows = new Map<string, Reference>(value.map(row => [row.hash.toLowerCase(), row]));
    for (const row of memory.get(key(apiUrl)) ?? []) rows.set(row.hash.toLowerCase(), row);
    return [...rows.values()];
  }
  function write(apiUrl: string, rows: Reference[]) {
    memory.set(key(apiUrl), rows);
    storage().setItem(key(apiUrl), JSON.stringify(rows));
  }
  return {
    enqueue(apiUrl: string, reference: Reference): Promise<void> {
      return lock(key(apiUrl), async () => {
        const rows = read(apiUrl);
        const existing = rows.find(row => row.hash.toLowerCase() === reference.hash.toLowerCase());
        if (!existing && rows.length >= 1000) throw new Error('Native payment history needs syncing before more references can be saved.');
        write(apiUrl, existing ? rows.map(row => (row === existing ? reference : row)) : [...rows, reference]);
      });
    },
    async recover(apiUrl: string, hash: Hash, block: NativeContributionBlock, fetchImpl?: typeof fetch) {
      const logs = await readNativeContributionReceiptApi({ apiUrl, hash, block, fetchImpl, kind: 'royalty' });
      if (!hasRoyalty(logs)) throw new Error('This transaction contains no listening payment or royalty claim.');
      await lock(key(apiUrl), async () =>
        write(
          apiUrl,
          read(apiUrl).filter(row => row.hash.toLowerCase() !== hash.toLowerCase())
        )
      );
    },
    flush(apiUrl: string, runtime?: Address, fetchImpl?: typeof fetch): Promise<void> {
      const operation = serial.then(async () => {
        const signal = AbortSignal.timeout(25_000);
        const pending = read(apiUrl).filter(row => !runtime || row.runtime.toLowerCase() === runtime.toLowerCase());
        for (const row of pending.slice(0, 4)) {
          if (!row.block) throw new Error(`Payment ${row.hash} is saved without its native block. Verify its block before syncing history.`);
          const logs = await readNativeContributionReceiptApi({ apiUrl, hash: row.hash, block: row.block, fetchImpl, kind: 'royalty', signal });
          if (!hasRoyalty(logs, row.runtime)) throw new Error('No royalty receipt was verified for the saved runtime.');
          await lock(key(apiUrl), async () =>
            write(
              apiUrl,
              read(apiUrl).filter(candidate => candidate.hash.toLowerCase() !== row.hash.toLowerCase())
            )
          );
        }
        if (pending.length > 4) throw new Error('More saved native payments are waiting to sync. Refresh history again; no new payment is needed.');
      });
      serial = operation.catch(() => {});
      return operation;
    }
  };
}

export const nativeRoyaltyReceipts = createNativeRoyaltyReceiptQueue(() => localStorage);
