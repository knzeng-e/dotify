import type { BrowserContext, Page } from '@playwright/test';

// A fresh-browser observer of app registration, not evidence of native OS UI.
export async function installMediaSessionProbe(page: Page | BrowserContext) {
  await page.addInitScript(() => {
    const handlers: Record<string, MediaSessionActionHandler | null> = {};
    const media = {
      metadata: null as MediaMetadata | null,
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

export async function readMediaSessionProbe(page: Page) {
  return page.evaluate(() => {
    const media = Reflect.get(window, '__TEST_MUSIC_SESSION__');
    return {
      title: media.metadata?.title ?? null,
      artwork: (media.metadata?.artwork ?? []) as MediaImage[],
      actions: Object.keys(media.handlers).filter(action => media.handlers[action] !== null),
      state: media.playbackState
    };
  });
}
