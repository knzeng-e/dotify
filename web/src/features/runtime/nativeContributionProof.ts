export class FinalizedNativeContributionFailedError extends Error {
  constructor() {
    super('The finalized native transaction failed. No contribution was recorded.');
    this.name = 'FinalizedNativeContributionFailedError';
  }
}
