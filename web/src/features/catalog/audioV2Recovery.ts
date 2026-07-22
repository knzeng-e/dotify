export class AudioV2ChunkAuthenticationError extends Error {
  constructor(readonly cause: unknown) {
    super('DAV2 chunk authentication failed');
    this.name = 'AudioV2ChunkAuthenticationError';
  }
}

type AudioV2MseFailureHandlers = {
  error: unknown;
  contextActive: boolean;
  retire: () => void;
  recover: (error: unknown) => void;
  reportAuthenticationFailure: (error: AudioV2ChunkAuthenticationError) => void;
};

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/** Keeps authentication failures out of the recoverable full-file path. */
export function routeAudioV2MseFailure({ error, contextActive, retire, recover, reportAuthenticationFailure }: AudioV2MseFailureHandlers): void {
  if (isAbortError(error) || !contextActive) {
    retire();
    return;
  }

  if (error instanceof AudioV2ChunkAuthenticationError) {
    reportAuthenticationFailure(error);
    retire();
    return;
  }

  recover(error);
}
