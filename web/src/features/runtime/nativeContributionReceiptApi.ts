import type { Hash } from 'viem';
import type { NativeContributionBlock, NativeContributionLog } from './runtimePorts';
import { FinalizedNativeContributionFailedError } from './nativeContributionProof';

const GENESIS = '0xd6eec26135305a8ad257a20d003357284c8aa03d0bdb2b357ab0a22371e11ef2';
const isHex = (value: unknown, bytes: number): value is Hash => typeof value === 'string' && new RegExp(`^0x[\\da-f]{${bytes * 2}}$`, 'i').test(value);

export async function readNativeContributionReceiptApi(input: {
  apiUrl?: string;
  hash: Hash;
  block: NativeContributionBlock;
  fetchImpl?: typeof fetch;
}): Promise<NativeContributionLog[]> {
  if (!input.apiUrl) throw new Error('Native receipt checks need the Dotify API. Keep this contribution pending.');
  let response: Response;
  try {
    response = await (input.fetchImpl ?? fetch)(`${input.apiUrl.replace(/\/$/, '')}/api/contributions/native-receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hash: input.hash, block: input.block }),
      signal: AbortSignal.timeout(25_000)
    });
  } catch {
    throw new Error('The native receipt service could not be reached. Check this saved contribution again.');
  }
  const body = (await response.json()) as {
    error?: string;
    requestId?: string;
    genesisHash?: string;
    hash?: string;
    block?: NativeContributionBlock;
    status?: string;
    logs?: NativeContributionLog[];
  };
  if (!response.ok)
    throw new Error(
      `${typeof body.error === 'string' ? body.error : 'The native receipt could not be verified.'}${body.requestId ? ` Reference: ${body.requestId}` : ''}`
    );
  if (
    body.genesisHash !== GENESIS ||
    body.hash?.toLowerCase() !== input.hash.toLowerCase() ||
    body.block?.number !== input.block.number ||
    !isHex(body.block?.hash, 32) ||
    (input.block.hash && body.block.hash.toLowerCase() !== input.block.hash.toLowerCase()) ||
    (input.block.index !== undefined && body.block.index !== input.block.index)
  )
    throw new Error('The native receipt service returned a different network or transaction. Keep this contribution pending.');
  if (body.status === 'failed') throw new FinalizedNativeContributionFailedError();
  if (
    body.status !== 'success' ||
    !Array.isArray(body.logs) ||
    !body.logs.every(
      log =>
        isHex(log.address, 20) &&
        typeof log.data === 'string' &&
        /^0x(?:[\da-f]{2})*$/i.test(log.data) &&
        Array.isArray(log.topics) &&
        log.topics.every(topic => isHex(topic, 32)) &&
        log.transactionHash?.toLowerCase() === input.hash.toLowerCase() &&
        Number.isSafeInteger(log.logIndex) &&
        log.logIndex >= 0
    )
  )
    throw new Error('The native receipt service returned unreadable events. Keep this contribution pending.');
  return body.logs;
}
