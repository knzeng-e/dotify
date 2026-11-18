import type { Address, Hash } from 'viem';
import type { NativeContributionBlock, NativeContributionLog } from './runtimePorts';
import { validateNativeContributionReceipt } from './nativeContributionReceiptApi';
const GENESIS = '0xd6eec26135305a8ad257a20d003357284c8aa03d0bdb2b357ab0a22371e11ef2';
export function nativeRoyaltyApiUrl(): string | undefined {
  // Same explicit test opt-in as the contribution-history journey. A production
  // build cannot select a test service through its URL.
  if (import.meta.env.DEV && import.meta.env.VITE_E2E_ARTIST_PUBLISH === 'true' && new URLSearchParams(location.search).get('e2eNativeHistory') === 'on')
    return 'https://receipt.dotify.test';
  return import.meta.env.VITE_DOTIFY_API_URL;
}
export type NativePaymentReceipt = { hash: Hash; block: NativeContributionBlock; logs: NativeContributionLog[] };

/** One bounded, revision-consistent snapshot; coverage is saved verified receipts only. */
export async function readNativePaymentHistory(apiUrl: string, runtimes: Address[], kind: 'contributions' | 'royalties', fetchImpl: typeof fetch = fetch) {
  const addresses = [...new Set(runtimes.map(runtime => runtime.toLowerCase()))];
  const rows: NativePaymentReceipt[] = [];
  let revision: string | undefined;
  const signal = AbortSignal.timeout(25_000);
  for (let start = 0; start < addresses.length; start += 100) {
    const batch = addresses.slice(start, start + 100);
    let offset = 0;
    for (let page = 0; page < 100; page++) {
      const response = await fetchImpl(`${apiUrl.replace(/\/$/, '')}/api/${kind}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({ runtimes: batch, offset, revision })
      });
      if (!response.ok) throw new Error('Native support history is unavailable. Your payments remain recorded on the network.');
      const body = await response.json();
      if (
        body?.genesisHash !== GENESIS ||
        body.chainId !== 420420417 ||
        body.coverage !== 'verified-receipts' ||
        !Array.isArray(body.receipts) ||
        body.receipts.length > 100 ||
        typeof body.updatedAt !== 'string' ||
        (revision && revision !== body.updatedAt)
      )
        throw new Error('Native support history could not be verified.');
      revision = body.updatedAt;
      for (const receipt of body.receipts) {
        if (!/^0x[\da-f]{64}$/i.test(receipt?.hash ?? '') || !Number.isSafeInteger(receipt?.block?.number) || receipt.block.number < 0)
          throw new Error('Native support receipt has no valid reference.');
        const logs = validateNativeContributionReceipt(receipt, receipt.hash, receipt.block);
        rows.push({ hash: receipt.hash, block: receipt.block, logs });
      }
      if (body.nextOffset === null) break;
      if (body.nextOffset !== offset + 100) throw new Error('Native support history returned an invalid page.');
      offset = body.nextOffset;
      if (page === 99) throw new Error('Native support history exceeded its read budget.');
    }
  }
  return [...new Map(rows.map(row => [row.hash.toLowerCase(), row])).values()];
}
