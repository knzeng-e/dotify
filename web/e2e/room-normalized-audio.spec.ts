import { expect, test } from '@playwright/test';

test('normalized Room output pauses on context suspension and recovers only through explicit Play', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  try {
    const host = await hostContext.newPage();
    await host.addInitScript(() => {
      const Original = window.AudioContext;
      window.AudioContext = class extends Original {
        createMediaElementSource(element: HTMLMediaElement) {
          Reflect.set(window, '__roomOutputContext', this);
          return super.createMediaElementSource(element);
        }
      };
    });
    await host.goto('/?e2eRoom=public&e2eSync=on&e2eCapture=web-audio&e2eAutoplay=on');
    // Exercise the production normalized graph, which encrypted streaming
    // sources register before PersistentAudio attaches them. No real key/media.
    await host.evaluate(async () => {
      const fixturePath = '/src/e2e/roomJoinMock.ts';
      const normalizationPath = '/src/features/player/audioNormalization.ts';
      const fixture = await import(fixturePath),
        normalization = await import(normalizationPath);
      normalization.registerAudioGain(fixture.E2E_ROOM_PUBLIC_AUDIO_URL, 0);
    });
    await host.getByRole('button', { name: 'Open a room', exact: true }).click();
    await host.getByRole('button', { name: 'Select E2E Public Room Track', exact: true }).click();
    await host.getByLabel('Your name or nickname').fill('Normalized host');
    await host.getByRole('button', { name: 'Open the room', exact: true }).click();
    const code = await host.getByTestId('room-code').innerText();
    await expect
      .poll(() =>
        host
          .locator('audio')
          .first()
          .evaluate((a: HTMLAudioElement) => !a.paused)
      )
      .toBe(true);
    const guest = await guestContext.newPage();
    await guest.goto(`/#/rooms/${code}`);
    await guest.getByLabel('Your name or nickname').fill('Energy guest');
    await guest.getByRole('button', { name: 'Join and listen' }).click();
    await expect(guest.getByTestId('room-listener-sync')).toHaveText('In sync', { timeout: 20_000 });
    await guest.evaluate(async () => {
      const audio = document.querySelectorAll<HTMLAudioElement>('audio.native-player-source')[1];
      const context = new AudioContext();
      await context.resume();
      Reflect.set(window, '__meterContext', context);
      const analyser = context.createAnalyser(),
        samples = new Float32Array(analyser.fftSize);
      context.createMediaStreamSource(audio.srcObject as MediaStream).connect(analyser);
      const output = context.createGain();
      output.gain.value = 0;
      analyser.connect(output).connect(context.destination);
      Reflect.set(window, '__normalizedRoomEnergy', () => {
        analyser.getFloatTimeDomainData(samples);
        return Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
      });
    });
    await expect.poll(() => guest.evaluate(() => Reflect.get(window, '__normalizedRoomEnergy')()), { timeout: 10_000 }).toBeGreaterThan(0.01);
    expect(await guest.evaluate(() => window.__DOTIFY_E2E_ROOM_JOIN__?.keyRequests ?? 0)).toBe(0);
    const position = await host
      .locator('audio')
      .first()
      .evaluate((audio: HTMLAudioElement) => audio.currentTime);
    await host.evaluate(async () => {
      await Reflect.get(window, '__roomOutputContext').suspend();
    });
    await expect(host.locator('audio').first()).toHaveJSProperty('paused', true);
    await expect(host.getByText('Audio interrupted · tap Play to resume', { exact: true }).first()).toBeVisible();
    await expect.poll(() => guest.evaluate(() => Reflect.get(window, '__normalizedRoomEnergy')()), { timeout: 10_000 }).toBeLessThan(0.002);
    const stoppedAt = await host
      .locator('audio')
      .first()
      .evaluate((audio: HTMLAudioElement) => audio.currentTime);
    expect(stoppedAt - position).toBeLessThan(1);
    await host.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(host.locator('audio').first()).toHaveJSProperty('paused', true);
    await host.locator('.player-transport').getByRole('button', { name: 'Play', exact: true }).first().click();
    await expect.poll(() => guest.evaluate(() => Reflect.get(window, '__normalizedRoomEnergy')()), { timeout: 10_000 }).toBeGreaterThan(0.01);
    await host.locator('.player-transport').getByRole('button', { name: 'Pause', exact: true }).first().click();
    await host.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(host.locator('audio').first()).toHaveJSProperty('paused', true);
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
