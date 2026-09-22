export type PreparedUploadRef<T = string> = {
  current: Promise<T> | null;
};

function isUsableUploadRef(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (!value || typeof value !== 'object' || !('ref' in value)) return false;
  return typeof value.ref === 'string' && value.ref.trim().length > 0;
}

/**
 * Resolve an eager upload result, retrying when the eager upload failed and
 * settled to an unusable empty ref. This matches the artist UI promise that
 * failed eager uploads are retried during registration.
 */
export async function resolvePreparedUpload<T>(ref: PreparedUploadRef<T>, upload: () => Promise<T>): Promise<T> {
  const prepared = ref.current;
  if (prepared) {
    try {
      const result = await prepared;
      if (isUsableUploadRef(result)) return result;
    } catch {
      if (ref.current === prepared) ref.current = null;
    }
  }

  const retry = upload();
  ref.current = retry;
  try {
    const result = await retry;
    if (!isUsableUploadRef(result) && ref.current === retry) ref.current = null;
    return result;
  } catch (error) {
    if (ref.current === retry) ref.current = null;
    throw error;
  }
}
