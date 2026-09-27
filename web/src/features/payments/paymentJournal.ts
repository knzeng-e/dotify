type JournalStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

// Migrate lazily by exact scope, without discarding an unresolved tab receipt.
// Storage errors must propagate: no durable reservation means no new payment.
export function persistentPaymentJournal(durable: () => JournalStorage, legacy: () => JournalStorage): JournalStorage {
  return {
    getItem(key) {
      const saved = durable().getItem(key);
      if (saved !== null) return saved;
      const previous = legacy().getItem(key);
      if (previous !== null) {
        durable().setItem(key, previous);
        legacy().removeItem(key);
      }
      return previous;
    },
    setItem(key, value) {
      durable().setItem(key, value);
    },
    removeItem(key) {
      legacy().removeItem(key);
      durable().removeItem(key);
    }
  };
}

export type PaymentLock = <T>(key: string, operation: () => Promise<T>) => Promise<T>;

export const browserPaymentLock: PaymentLock = (key, operation) =>
  typeof navigator !== 'undefined' && navigator.locks ? navigator.locks.request(key, operation) : operation();
