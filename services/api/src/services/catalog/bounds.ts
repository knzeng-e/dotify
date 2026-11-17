/** Deterministic content-policy failure, distinct from an unavailable RPC.
 * Only this error may exclude one release while allowing a checkpoint to commit. */
export class CatalogBoundsError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = 'CatalogBoundsError';
  }
}
