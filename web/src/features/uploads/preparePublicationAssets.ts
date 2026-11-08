/** Backend audio and cover share one Bulletin writer; do not start an HTTP
 * upload whose connection lifetime will be spent waiting behind encoding/storage.
 * Local demo uploads retain their independent parallel path. Cached promises
 * remain owned by the caller, so a cover retry can reuse ready audio. */
export async function preparePublicationAssets<A, C>(input: { serial: boolean; audio: () => Promise<A>; cover: () => Promise<C> }): Promise<[A, C]> {
  if (!input.serial) return Promise.all([input.audio(), input.cover()]);
  const audio = await input.audio();
  return [audio, await input.cover()];
}
