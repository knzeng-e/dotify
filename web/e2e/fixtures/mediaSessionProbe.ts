import type { BrowserContext, Page } from '@playwright/test';

// A fresh-browser observer of app registration, not evidence of native OS UI.
export async function installMediaSessionProbe(page: Page | BrowserContext) {
  await page.addInitScript(() => {
    const handlers: Record<string, MediaSessionActionHandler | null> = {};
    let metadata: MediaMetadata | null = null;
    const history: { title: string | null; artist: string | null; preparedPng: boolean }[] = [];
    const media = {
      get metadata() {
        return metadata;
      },
      set metadata(value: MediaMetadata | null) {
        metadata = value;
        history.push({
          title: value?.title ?? null,
          artist: value?.artist ?? null,
          preparedPng: value?.artwork[0]?.src.startsWith('data:image/png;base64,') ?? false
        });
        if (history.length > 64) history.shift();
      },
      history,
      playbackState: 'none',
      setActionHandler: (action: string, handler: MediaSessionActionHandler | null) => {
        handlers[action] = handler;
      },
      setPositionState: () => {},
      handlers
    };
    Object.defineProperty(navigator, 'mediaSession', { configurable: true, value: media });
    Reflect.set(window, '__TEST_MUSIC_SESSION__', media);
  });
}

export async function readMediaSessionHistory(page: Page) {
  return page.evaluate(() => Reflect.get(window, '__TEST_MUSIC_SESSION__').history as { title: string | null; artist: string | null; preparedPng: boolean }[]);
}

export async function readMediaSessionProbe(page: Page) {
  return page.evaluate(() => {
    const media = Reflect.get(window, '__TEST_MUSIC_SESSION__');
    return {
      title: media.metadata?.title ?? null,
      artist: media.metadata?.artist ?? null,
      album: media.metadata?.album ?? null,
      artwork: (media.metadata?.artwork ?? []) as MediaImage[],
      actions: Object.keys(media.handlers).filter(action => media.handlers[action] !== null),
      state: media.playbackState
    };
  });
}
