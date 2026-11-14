import { classifyProtectedPlaybackFailure } from '../catalog/protectedPlaybackFailure';

/** This caller prepares the current solo track offscreen; failure opens no Room. */
export function roomPreparationFailureCopy(error: unknown): { title: string; message: string } {
  // RoomAudioPreparation starts this timer only after the key is authorized.
  if (error instanceof Error && error.name === 'TimeoutError')
    return {
      title: 'Room audio is taking too long',
      message: 'Listening access was confirmed, but the audio did not finish loading. The room was not opened. You can keep listening solo and try again.'
    };
  const kind = classifyProtectedPlaybackFailure(error);
  if (kind === 'access-not-confirmed' || kind === 'account-required' || kind === 'signature-declined')
    return {
      title: 'Room access could not be confirmed',
      message: 'The room was not opened. Check the listening access required for this track before trying again.'
    };
  return {
    title: 'Room audio could not be prepared',
    message: 'The room was not opened because its audio could not be loaded. Try again when the connection is ready.'
  };
}
