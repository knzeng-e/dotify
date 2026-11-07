/** A configured storage allowance does not admit every future artist release. */
export class PublicationAdmissionError extends Error {
  readonly code = 'STREAMING_PUBLICATION_NOT_ADMITTED';
  constructor() {
    super('New release publishing is not enabled for this audio yet. Your draft is safe. Please contact the Dotify operator before trying again.');
    this.name = 'PublicationAdmissionError';
  }
}
