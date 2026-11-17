import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { publishSystemArtwork } from './systemArtworkPublication';
import { preparedSystemArtwork, resolveSystemArtwork } from './systemArtwork';
import { clearSystemArtworkObservations, systemArtworkObservations } from './systemArtworkObservation';

vi.mock('./systemArtwork', () => ({
  preparedSystemArtwork: vi.fn(() => null),
  resolveSystemArtwork: vi.fn(),
  systemArtworkCandidates: vi.fn(() => [{ src: 'https://public.example/cover.png' }])
}));
const png = [{ src: 'data:image/png;base64,AA==', type: 'image/png', sizes: '640x640' }];
const url = [{ src: 'https://public.example/cover.png' }];
const track = { title: 'Synthetic', artist: 'Artist', imageRef: url[0].src };
let documentEvents: EventTarget & { visibilityState: string };
let session: MediaSession;
const cleanups: (() => void)[] = [];

beforeEach(() => {
  vi.resetAllMocks();
  clearSystemArtworkObservations();
  documentEvents = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  vi.stubGlobal('document', documentEvents);
  vi.stubGlobal(
    'MediaMetadata',
    class {
      constructor(input: MediaMetadataInit) {
        Object.assign(this, input);
      }
    }
  );
  session = { metadata: null, playbackState: 'paused' } as MediaSession;
  vi.mocked(preparedSystemArtwork).mockReturnValue(null);
});
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.unstubAllGlobals();
});
function start() {
  const cleanup = publishSystemArtwork(session, track, () => true);
  cleanups.push(cleanup);
  return cleanup;
}
function returnToApp() {
  for (const state of ['hidden', 'visible']) {
    documentEvents.visibilityState = state;
    documentEvents.dispatchEvent(new Event('visibilitychange'));
  }
}
const flush = async () => {
  await new Promise<void>(resolve => queueMicrotask(resolve));
  await new Promise<void>(resolve => queueMicrotask(resolve));
};

it('repairs a fallback once on foreground return while keeping Pause and current attribution', async () => {
  vi.mocked(resolveSystemArtwork).mockResolvedValueOnce(url).mockResolvedValueOnce(png);
  start();
  await flush();
  expect(session.metadata?.artwork).toEqual(url);
  returnToApp();
  await flush();
  expect(session.metadata).toMatchObject({ title: track.title, artist: track.artist, album: 'Dotify', artwork: png });
  expect(session.playbackState).toBe('paused');
  returnToApp();
  await flush();
  expect(resolveSystemArtwork).toHaveBeenCalledTimes(2);
  expect(systemArtworkObservations().filter(event => event.phase === 'retry-requested')).toHaveLength(1);
});

it('does not recompose or repaint a ready PNG on return', async () => {
  vi.mocked(preparedSystemArtwork).mockReturnValue(png);
  start();
  const metadata = session.metadata;
  returnToApp();
  await flush();
  expect(resolveSystemArtwork).not.toHaveBeenCalled();
  expect(session.metadata).toBe(metadata);
});

it('lets pending work finish first and skips recovery when it succeeds', async () => {
  let finish!: (artwork: MediaImage[]) => void;
  vi.mocked(resolveSystemArtwork).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  start();
  returnToApp();
  expect(resolveSystemArtwork).toHaveBeenCalledTimes(1);
  finish(png);
  await flush();
  expect(resolveSystemArtwork).toHaveBeenCalledTimes(1);
  expect(session.metadata?.artwork).toEqual(png);
});

it('services a return during pending work only after fallback, without a concurrent decoder', async () => {
  let finish!: (artwork: MediaImage[]) => void;
  vi.mocked(resolveSystemArtwork)
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        })
    )
    .mockResolvedValueOnce(png);
  start();
  returnToApp();
  expect(resolveSystemArtwork).toHaveBeenCalledTimes(1);
  finish(url);
  await flush();
  await flush();
  expect(resolveSystemArtwork).toHaveBeenCalledTimes(2);
  expect(session.metadata?.artwork).toEqual(png);
});

it('stops after one failed recovery instead of starting a retry loop', async () => {
  vi.mocked(resolveSystemArtwork).mockRejectedValue(new Error('Unavailable'));
  start();
  await flush();
  returnToApp();
  await flush();
  returnToApp();
  await flush();
  expect(resolveSystemArtwork).toHaveBeenCalledTimes(2);
  expect(session.metadata?.artwork).toEqual(url);
});

it('retires a pending recovery and cannot restore cleared metadata after disconnect', async () => {
  let finish!: (artwork: MediaImage[]) => void;
  vi.mocked(resolveSystemArtwork)
    .mockResolvedValueOnce(url)
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        })
    );
  const cleanup = start();
  await flush();
  returnToApp();
  const signal = vi.mocked(resolveSystemArtwork).mock.calls[1][1];
  cleanup();
  finish(png);
  await flush();
  returnToApp();
  expect(signal.aborted).toBe(true);
  const observations = systemArtworkObservations();
  expect(observations[observations.length - 1]?.phase).toBe('cancelled');
  expect(session.metadata).toBeNull();
  expect(resolveSystemArtwork).toHaveBeenCalledTimes(2);
});

it('does not recover or clear metadata replaced by another owner', async () => {
  vi.mocked(resolveSystemArtwork).mockResolvedValue(url);
  const cleanup = start();
  await flush();
  const other = new MediaMetadata({ title: 'Another owner' });
  session.metadata = other;
  returnToApp();
  await flush();
  cleanup();
  expect(session.metadata).toBe(other);
  expect(resolveSystemArtwork).toHaveBeenCalledTimes(1);
});

it('can retry a rejected PNG assignment without changing transport', async () => {
  let value: MediaMetadata | null = null;
  let rejectPng = true;
  Object.defineProperty(session, 'metadata', {
    configurable: true,
    get: () => value,
    set: (next: MediaMetadata | null) => {
      if (rejectPng && next?.artwork[0]?.type === 'image/png') {
        rejectPng = false;
        throw new Error('Temporary Host rejection');
      }
      value = next;
    }
  });
  vi.mocked(resolveSystemArtwork).mockResolvedValue(png);
  start();
  await flush();
  expect(session.metadata?.artwork).toEqual(url);
  returnToApp();
  await flush();
  expect(session.metadata?.artwork).toEqual(png);
  expect(session.playbackState).toBe('paused');
});
