import type { Address, Hash } from 'viem';
import { SupportNotSubmittedError, supportWasCanceled } from '../payments/supportPayment';
import type { DonationPort } from './donationModel';

type Record = { amount: string; hash?: Hash };
export type DonationResult = { status: 'confirmed' | 'canceled' | 'failed' | 'uncertain'; amount: bigint; hash?: Hash; message: string };
export function createDonationFlow(storage: () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>) {
  let operation: Promise<DonationResult> | null = null;
  const memory = new Map<string, Record>();
  return {
    run(input: { port: DonationPort; sender: Address; recipient: Address; amount: bigint; currentAccount: () => boolean }): Promise<DonationResult> {
      if (operation) return operation;
      const execute = async (): Promise<DonationResult> => {
        const key = `dotify.gift.v1:${input.port.asset.network}:${input.sender.toLowerCase()}:${input.recipient.toLowerCase()}`;
        let record: Record | undefined;
        let requestedAmount = input.amount;
        let sending = false;
        let submitted = false;
        try {
          const stored = storage().getItem(key);
          record = memory.get(key) ?? (stored ? (JSON.parse(stored) as Record) : undefined);
          if (record && (!/^[1-9]\d*$/.test(record.amount) || (record.hash !== undefined && !/^0x[\da-f]{64}$/i.test(record.hash))))
            throw new Error('Saved gift reference is unreadable. Check your account activity.');
          if (record) requestedAmount = BigInt(record.amount);
          if (!input.currentAccount()) throw new Error('Your account changed. Reopen the gift with the account you want to use.');
          if (record && !record.hash)
            return {
              status: 'uncertain',
              amount: BigInt(record.amount),
              message: 'A previous gift may still complete. Check your account activity before sending another.'
            };
          if (!record) {
            if (input.amount <= 0n) throw new Error('Choose an amount greater than zero.');
            record = { amount: input.amount.toString() };
            storage().setItem(key, JSON.stringify(record));
            memory.set(key, record);
            sending = true;
            const result = await input.port.send(input.recipient, input.amount);
            submitted = true;
            record = { ...record, hash: result.hash };
            memory.set(key, record);
            storage().setItem(key, JSON.stringify(record));
            if (!result.finalized) await input.port.confirm({ hash: result.hash, amount: input.amount }, input.recipient);
          } else {
            // Recovery only reads the original transfer; changing the amount
            // cannot bypass the reservation or create another gift.
            await input.port.confirm({ hash: record.hash!, amount: BigInt(record.amount) }, input.recipient);
          }
          storage().removeItem(key);
          memory.delete(key);
          return {
            status: 'confirmed',
            amount: BigInt(record.amount),
            hash: record.hash,
            message: 'Your gift is confirmed. Thank you for supporting the artist.'
          };
        } catch (error) {
          const canceled = sending && !submitted && supportWasCanceled(error);
          const safeToRetry = sending && !submitted && (canceled || error instanceof SupportNotSubmittedError);
          if (safeToRetry) {
            try {
              storage().removeItem(key);
              memory.delete(key);
            } catch {
              /* Keep the reservation if cleanup fails. */
            }
          }
          const uncertain = !safeToRetry && (sending || Boolean(record?.hash));
          return {
            status: canceled ? 'canceled' : uncertain ? 'uncertain' : 'failed',
            amount: requestedAmount,
            hash: record?.hash,
            message: canceled
              ? 'No gift was sent.'
              : uncertain
                ? 'Confirmation was interrupted. This gift may still complete; do not send it again.'
                : error instanceof Error
                  ? error.message
                  : 'The gift could not be prepared.'
          };
        }
      };
      operation = execute().finally(() => {
        operation = null;
      });
      return operation;
    }
  };
}
