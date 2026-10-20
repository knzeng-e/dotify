import type { RuntimeReadPort } from '../runtime/runtimePorts';
import { getProductCdmHostSmokeSession, publishProductAccessReadbackMetric, type ProductAccessReadbackMetric } from './productCdmHostSmokeEvidence';

export async function captureProductAccessReadback(input: {
  reader: Pick<RuntimeReadPort, 'hasPaid' | 'canAccess'>;
  buildSha: string | undefined;
  productAppVersion: string | undefined;
  chainId: number;
  runtimeAddress: `0x${string}`;
  contentHash: `0x${string}`;
  listenerAddress: `0x${string}`;
  isCurrent: () => boolean;
}): Promise<void> {
  const session = getProductCdmHostSmokeSession();
  if (!session || session.candidate.gitSha !== input.buildSha || session.candidate.productAppVersion !== input.productAppVersion || !input.isCurrent()) return;

  let hasPaid: boolean | null = null;
  let canAccess: boolean | null = null;
  try {
    [hasPaid, canAccess] = await Promise.all([
      input.reader.hasPaid(input.runtimeAddress, input.contentHash, input.listenerAddress),
      input.reader.canAccess(input.runtimeAddress, input.contentHash, input.listenerAddress)
    ]);
  } catch {
    // Unknown evidence never grants access or changes ordinary playback.
  }

  const current = getProductCdmHostSmokeSession();
  if (
    !input.isCurrent() ||
    !current ||
    current.startedAt !== session.startedAt ||
    current.candidate.gitSha !== session.candidate.gitSha ||
    current.candidate.productAppVersion !== session.candidate.productAppVersion ||
    current.candidate.deployedCid !== session.candidate.deployedCid
  )
    return;

  const metric: ProductAccessReadbackMetric = {
    runtimeAddress: input.runtimeAddress,
    contentHash: input.contentHash,
    listenerAddress: input.listenerAddress,
    chainId: input.chainId,
    hasPaid,
    canAccess,
    timestamp: Date.now()
  };
  publishProductAccessReadbackMetric(metric);
}
