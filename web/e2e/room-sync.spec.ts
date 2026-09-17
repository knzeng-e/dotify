import { expect, test, type Page } from '@playwright/test';

async function hostRoom(page: Page, captureMode = 'synthetic') {
  await page.goto(`/?e2eRoom=public&e2eSync=on&e2eCapture=${captureMode}`);
  await page.getByRole('button', { name: 'Open a room', exact: true }).click();
  await page.getByRole('button', { name: 'Select E2E Public Room Track' }).click();
  await page.getByLabel('Your name in the room').fill('Sync host');
  await page.getByRole('button', { name: 'Open the room', exact: true }).click();
  await expect(page.getByTestId('room-code')).toHaveText(/[A-Z0-9]{4,}/);
  await expect
    .poll(() =>
      page
        .locator('audio')
        .first()
        .evaluate((audio: HTMLAudioElement) => audio.duration)
    )
    .toBe(60);
  return (await page.getByTestId('room-code').innerText()).trim();
}
async function join(page: Page, id: string) {
  await page.goto(`/#/rooms/${id}`);
  await page.getByLabel('Your name in the room').fill('Sync guest');
  await page.getByRole('button', { name: 'Enter and listen' }).click();
  await expect(page.getByTestId('room-listener-sync')).toHaveText('In sync', { timeout: 20_000 });
}
async function seek(page: Page, percent: number) {
  await page.locator('.player-stage input[type=range]').evaluate((element, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, String(value));
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, percent);
}
async function progress(page: Page) {
  return page.locator('.player-stage input[type=range]').inputValue().then(Number);
}
async function remoteSilenced(page: Page) {
  return page
    .locator('audio')
    .nth(1)
    .evaluate((audio: HTMLAudioElement) => Boolean(audio.muted && (audio.srcObject as MediaStream)?.getAudioTracks().every(track => !track.enabled)));
}

test('host seek is reflected by late guests and pause holds the host position and silences the receiver', async ({ browser }, testInfo) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const host = await hostContext.newPage();
    const id = await hostRoom(host);
    await expect(host.getByRole('slider', { name: 'Seek', exact: true })).toBeVisible();
    await seek(host, 50);
    await expect.poll(() => progress(host)).toBeCloseTo(50, 0);
    const guest = await guestContext.newPage();
    await join(guest, id);
    await expect(guest.getByRole('slider', { name: 'Room progress', exact: true })).toBeVisible();
    await expect(guest.getByRole('slider', { name: 'Room progress', exact: true })).toBeDisabled();
    await expect(guest.getByRole('button', { name: 'Shuffle', exact: true })).toHaveCount(0);
    await expect(guest.getByRole('button', { name: 'Previous track', exact: true })).toHaveCount(0);
    await expect(guest.getByRole('button', { name: 'Next track', exact: true })).toHaveCount(0);
    await expect(guest.getByRole('button', { name: 'Repeat this track', exact: true })).toHaveCount(0);
    await expect(guest.getByRole('button', { name: 'Mute', exact: true })).toBeEnabled();
    await expect.poll(() => progress(guest)).toBeCloseTo(50, 0);
    await guest.waitForTimeout(1200); // several remote timeupdate events must not overwrite the room clock
    expect(await progress(guest)).toBeCloseTo(50, 0);
    await expect.poll(() => remoteSilenced(guest)).toBe(true);
    await expect(guest.locator('.player-stage input[type=range]')).toBeDisabled();
    await host.locator('.transport-play').click();
    await expect.poll(() => remoteSilenced(guest)).toBe(false);
    await expect.poll(() => progress(guest)).toBeGreaterThan(51);
    await seek(host, 75);
    await expect.poll(async () => Math.abs((await progress(host)) - (await progress(guest)))).toBeLessThan(1.5);
    await host.locator('.transport-play').click();
    await expect.poll(() => remoteSilenced(guest)).toBe(true);
    const paused = await progress(host);
    await guest.waitForTimeout(1400);
    expect(await progress(guest)).toBeCloseTo(paused, 0);
    await expect(guest.locator('.player-stage .transport-play')).toHaveAttribute('aria-label', 'Play');
    await expect(guest.locator('audio').nth(1)).toHaveJSProperty('paused', false);
    await guest.screenshot({ path: testInfo.outputPath('guest-paused-mobile.png'), fullPage: true });
    await host.screenshot({ path: testInfo.outputPath('host-paused-desktop.png'), fullPage: true });
    await host.locator('.transport-play').click();
    await expect.poll(() => remoteSilenced(guest)).toBe(false);
    await expect.poll(async () => Math.abs((await progress(host)) - (await progress(guest)))).toBeLessThan(1.5);
  } finally {
    await guestContext.close();
    await hostContext.close();
  }
});

test('real Web Audio stays silent through repeated host pauses and local pause survives host changes', async ({ browser }, testInfo) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  try {
    await hostContext.addInitScript(() => {
      Object.defineProperty(HTMLMediaElement.prototype, 'captureStream', { value: undefined, configurable: true });
      Object.defineProperty(HTMLMediaElement.prototype, 'mozCaptureStream', { value: undefined, configurable: true });
    });
    const host = await hostContext.newPage();
    const id = await hostRoom(host, 'web-audio');
    const guest = await guestContext.newPage();
    await join(guest, id);
    await guest.evaluate(async () => {
      const audio = document.querySelectorAll<HTMLAudioElement>('audio.native-player-source')[1];
      const stream = audio.srcObject as MediaStream;
      const context = new AudioContext();
      await context.resume();
      Reflect.set(window, '__roomSyncContext', context);
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      Reflect.set(window, '__roomSyncMeter', () => {
        analyser.getFloatTimeDomainData(samples);
        return Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
      });
      Reflect.set(window, '__roomSyncStream', stream);
    });
    const rms = () => guest.evaluate(() => Reflect.get(window, '__roomSyncMeter')() as number);
    await host.locator('.transport-play').click();
    await expect.poll(rms).toBeGreaterThan(0.02);
    for (let i = 0; i < 3; i++) {
      await host.locator('.transport-play').click();
      await expect.poll(() => remoteSilenced(guest)).toBe(true);
      await expect.poll(rms).toBeLessThan(0.0001);
      await guest.waitForTimeout(350);
      expect(await rms()).toBeLessThan(0.0001);
      await host.locator('.transport-play').click();
      await expect.poll(rms).toBeGreaterThan(0.02);
    }
    await guest.locator('.transport-play').click();
    await expect.poll(() => remoteSilenced(guest)).toBe(true);
    await host.locator('.transport-play').click();
    await seek(host, 60);
    await host.locator('.transport-play').click();
    await expect.poll(() => progress(guest)).toBeGreaterThan(60);
    expect(await remoteSilenced(guest)).toBe(true);
    await guest.locator('.transport-play').click();
    await expect.poll(rms).toBeGreaterThan(0.02);
    expect(
      await guest.evaluate(
        () => Reflect.get(window, '__roomSyncStream') === document.querySelectorAll<HTMLAudioElement>('audio.native-player-source')[1].srcObject
      )
    ).toBe(true);
    await guest.getByRole('button', { name: 'Music', exact: true }).click();
    await expect(guest.locator('.player-dock input[type=range]')).toBeDisabled();
    const dockProgress = Number(await guest.locator('.player-dock input[type=range]').inputValue());
    expect(Math.abs(dockProgress - (await progress(host)))).toBeLessThan(1.5);
  } catch (error) {
    const guest = guestContext.pages()[0];
    if (guest)
      await testInfo.attach('audio-meter-state', {
        body: JSON.stringify(
          await guest.evaluate(() => {
            const context = Reflect.get(window, '__roomSyncContext') as AudioContext | undefined;
            const audio = document.querySelectorAll<HTMLAudioElement>('audio.native-player-source')[1];
            return {
              meterState: context?.state,
              meterTime: context?.currentTime,
              visibility: document.visibilityState,
              audioPaused: audio?.paused,
              muted: audio?.muted,
              tracks: (audio?.srcObject as MediaStream)
                ?.getAudioTracks()
                .map(track => ({ enabled: track.enabled, muted: track.muted, readyState: track.readyState })),
              rms: Reflect.get(window, '__roomSyncMeter')?.()
            };
          })
        ),
        contentType: 'application/json'
      });
    throw error;
  } finally {
    await guestContext.close();
    await hostContext.close();
  }
});
