export type PreparedUploadRef = {
  current: Promise<string> | null;
};

function isUsableUploadRef(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * Resolve an eager upload result, retrying when the eager upload failed and
 * settled to an unusable empty ref. This matches the artist UI promise that
 * failed eager uploads are retried during registration.
 */
export async function resolvePreparedUpload(ref: PreparedUploadRef, upload: () => Promise<string>): Promise<string> {
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
