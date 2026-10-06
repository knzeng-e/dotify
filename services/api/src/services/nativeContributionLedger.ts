import { mkdir, readFile, rename, writeFile, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { decodeEventLog } from 'viem';
import { z } from 'zod';
import { contributionsAbi } from '../generated/contributions.js';
import { PASEO_ASSET_HUB_GENESIS, NativeReceiptUnavailableError, type NativeReceiptResponse } from './nativeReceipts.js';

const hash = z.string().regex(/^0x[\da-f]{64}$/i);
const address = z.string().regex(/^0x[\da-f]{40}$/i);
const receiptSchema = z.object({
  hash,
  genesisHash: z.literal(PASEO_ASSET_HUB_GENESIS),
  status: z.literal('success'),
  block: z.object({ number: z.number().int().nonnegative(), hash, index: z.number().int().nonnegative().optional() }),
  logs: z
    .array(
      z.object({
        address,
        data: z.string().regex(/^0x(?:[\da-f]{2})*$/i),
        topics: z.array(hash).max(4),
        transactionHash: hash,
        logIndex: z.number().int().nonnegative()
      })
    )
    .max(512)
});
const snapshotSchema = z.object({
  version: z.literal(1),
  genesisHash: z.literal(PASEO_ASSET_HUB_GENESIS),
  updatedAt: z.string().datetime(),
  receipts: z.array(receiptSchema).max(10_000)
});
type Snapshot = z.infer<typeof snapshotSchema>;

/** A shared index of verified receipts, not an exhaustive native-chain indexer. */
export class NativeContributionLedger {
  private snapshot: Snapshot | undefined;
  private serial: Promise<unknown> = Promise.resolve();
  constructor(private readonly path: string) {}

  private async load() {
    if (this.snapshot) return this.snapshot;
    try {
      if ((await stat(this.path)).size > 64 * 1024 * 1024) throw new Error('Ledger exceeds its storage bound');
      this.snapshot = snapshotSchema.parse(JSON.parse(await readFile(this.path, 'utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      this.snapshot = { version: 1, genesisHash: PASEO_ASSET_HUB_GENESIS, updatedAt: new Date().toISOString(), receipts: [] };
    }
    return this.snapshot;
  }

  record(receipt: NativeReceiptResponse): Promise<void> {
    // Only the server's native proof reader calls this method. Clients cannot submit logs.
    const operation = this.serial.then(async () => {
      if (receipt.status !== 'success') return;
      const logs = receipt.logs.filter(log => {
        try {
          return (
            decodeEventLog({ abi: contributionsAbi, topics: log.topics as [`0x${string}`, ...`0x${string}`[]], data: log.data }).eventName !==
            'ContributionPolicy'
          );
        } catch {
          return false;
        }
      });
      const events = logs.map(log => ({
        log,
        event: decodeEventLog({ abi: contributionsAbi, topics: log.topics as [`0x${string}`, ...`0x${string}`[]], data: log.data })
      }));
      const received = events.filter(row => row.event.eventName === 'ContributionReceived');
      if (!received.length) return;
      for (const row of received) {
        if (row.event.eventName !== 'ContributionReceived') continue;
        const id = row.event.args.id;
        const shares = events.filter(
          other =>
            other.log.address.toLowerCase() === row.log.address.toLowerCase() && other.event.eventName === 'ContributionShare' && other.event.args.id === id
        );
        const sum = shares.reduce((total, share) => total + (share.event.eventName === 'ContributionShare' ? share.event.args.amount : 0n), 0n);
        if (!shares.length || sum !== row.event.args.amount) throw new Error('Incomplete native contribution distribution');
      }
      const verified = receiptSchema.parse({ ...receipt, logs });
      if (logs.some(log => log.transactionHash.toLowerCase() !== receipt.hash.toLowerCase())) throw new Error('Native receipt hash mismatch');
      const previous = await this.load();
      const existing = previous.receipts.find(row => row.hash.toLowerCase() === receipt.hash.toLowerCase());
      if (existing) {
        if (existing.block.hash.toLowerCase() !== verified.block.hash.toLowerCase()) throw new Error('Conflicting finalized receipt');
        return;
      }
      if (previous.receipts.length >= 10_000) throw new Error('Native contribution ledger capacity reached');
      const next: Snapshot = {
        ...previous,
        updatedAt: new Date(Math.max(Date.now(), Date.parse(previous.updatedAt) + 1)).toISOString(),
        receipts: [...previous.receipts, verified]
      };
      const serialized = JSON.stringify(next);
      if (Buffer.byteLength(serialized) > 64 * 1024 * 1024) throw new Error('Native contribution ledger capacity reached');
      await mkdir(dirname(this.path), { recursive: true });
      const temporary = `${this.path}.${randomUUID()}.tmp`;
      await writeFile(temporary, serialized, { encoding: 'utf8', mode: 0o600 });
      await rename(temporary, this.path);
      this.snapshot = next;
    });
    this.serial = operation.catch(() => {});
    return operation.catch(() => {
      throw new NativeReceiptUnavailableError('The receipt is verified but its shared history could not be saved. Check this contribution again.');
    });
  }

  async history(runtimes: string[], offset = 0, revision?: string) {
    await this.serial;
    const snapshot = await this.load();
    if (revision && revision !== snapshot.updatedAt) throw new Error('Contribution history changed during paging. Refresh again.');
    const allowed = new Set(runtimes.map(value => value.toLowerCase()));
    const matches = snapshot.receipts.filter(row => row.logs.some(log => allowed.has(log.address.toLowerCase())));
    return {
      genesisHash: snapshot.genesisHash,
      chainId: 420420417,
      coverage: 'verified-receipts' as const,
      updatedAt: snapshot.updatedAt,
      receipts: matches.slice(offset, offset + 100),
      nextOffset: offset + 100 < matches.length ? offset + 100 : null
    };
  }
}
