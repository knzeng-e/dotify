export const CATALOG_LOAD_ERROR_STATUS = 'Catalog temporarily unavailable. Check your connection or try again shortly.';

export function catalogLoadFailureStatus(_error: unknown): string {
  return CATALOG_LOAD_ERROR_STATUS;
}
