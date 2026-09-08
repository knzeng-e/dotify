import { protectedAudioUploadToRuntimeAddress, type ProtectedAudioUpload } from '../../services/pinata';
import { resolvePreparedUpload, type PreparedUploadRef } from './preparedUpload';

function sameRuntimeAddress(left: `0x${string}`, right: `0x${string}`): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

type RuntimeMismatchHandler = (uploadRuntime: `0x${string}`, publicationRuntime: `0x${string}`) => void | Promise<void>;

export async function resolvePreparedAudioUploadForRuntime(input: {
  ref: PreparedUploadRef<ProtectedAudioUpload>;
  upload: () => Promise<ProtectedAudioUpload>;
  publicationRuntimeAddress: `0x${string}` | null | undefined;
  canRetry: boolean;
  onBeforeRetry?: RuntimeMismatchHandler;
  mismatchMessage: (uploadRuntime: `0x${string}`, publicationRuntime: `0x${string}`) => string;
}): Promise<ProtectedAudioUpload> {
  let resolved = await resolvePreparedUpload(input.ref, input.upload);
  const uploadRuntime = protectedAudioUploadToRuntimeAddress(resolved);
  const publicationRuntime = input.publicationRuntimeAddress;

  if (!uploadRuntime || !publicationRuntime || sameRuntimeAddress(uploadRuntime, publicationRuntime)) {
    return resolved;
  }

  input.ref.current = null;
  if (!input.canRetry) {
    throw new Error(input.mismatchMessage(uploadRuntime, publicationRuntime));
  }

  await input.onBeforeRetry?.(uploadRuntime, publicationRuntime);
  resolved = await resolvePreparedUpload(input.ref, input.upload);
  const retriedRuntime = protectedAudioUploadToRuntimeAddress(resolved);
  if (retriedRuntime && !sameRuntimeAddress(retriedRuntime, publicationRuntime)) {
    input.ref.current = null;
    throw new Error(input.mismatchMessage(retriedRuntime, publicationRuntime));
  }
  return resolved;
}
