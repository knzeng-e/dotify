import { expect, test, type Page } from '@playwright/test';

async function instrumentOutput(page: Page) {
  await page.addInitScript(() => {
    const captures: { context: AudioContext; input: AudioNode; rms: () => number; frequency: () => number }[] = [];
    Reflect.set(window, '__hostOutputs', captures);
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (...args: Parameters<AudioNode['connect']>) {
      const destination = args[0];
      if (this instanceof MediaElementAudioSourceNode && destination instanceof AudioNode) {
        const context = this.context as AudioContext;
        const existing = captures.find(item => item.context === context);
        if (existing) existing.input = destination;
        else captures.push({ context, input: destination, rms: () => -1, frequency: () => -1 });
      }
      if (destination === this.context.destination) {
        const capture = captures.find(item => item.context === this.context);
        if (capture) {
          const analyser = this.context.createAnalyser();
          connect.call(this, analyser);
          const samples = new Float32Array(analyser.fftSize);
          capture.rms = () => {
            analyser.getFloatTimeDomainData(samples);
            return Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
          };
          const spectrum = new Float32Array(analyser.frequencyBinCount);
          capture.frequency = () => {
            analyser.getFloatFrequencyData(spectrum);
            let peak = 0;
            for (let index = 1; index < spectrum.length; index++) if (spectrum[index] > spectrum[peak]) peak = index;
            return (peak * capture.context.sampleRate) / analyser.fftSize;
          };
        }
      }
      return Reflect.apply(connect, this, args);
    } as AudioNode['connect'];
  });
}

async function openRoom(page: Page, autoplay = false) {
  await page.goto(`/?e2eRoom=public&e2eSync=on&e2eCatalog=sequence&e2eCapture=web-audio&e2eAutoplay=${autoplay ? 'on' : 'off'}`);
  await page.getByRole('button', { name: 'Open a room', exact: true }).click();
  await page.getByRole('button', { name: 'Select E2E Public Room Track', exact: true }).click();
  await page.getByLabel('Your name in the room').fill('Mobile host');
  await page.getByRole('button', { name: 'Open the room', exact: true }).click();
  await expect(page.getByTestId('room-code')).toHaveText(/[A-Z0-9]{4,}/);
  await expect(page.locator('.transport-play')).toBeEnabled();
  if (await page.getByRole('button', { name: 'Pause', exact: true }).isVisible()) {
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
  }
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
}

test('mobile host silences residual audio, switches while paused and resumes the selected track', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await instrumentOutput(page);
  await openRoom(page, true);
  const audio = page.locator('audio.native-player-source').first();
  const rms = () => page.evaluate(() => Reflect.get(window, '__hostOutputs').at(-1)?.rms() ?? -1);
  const frequency = () => page.evaluate(() => Reflect.get(window, '__hostOutputs').at(-1)?.frequency() ?? -1);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(rms).toBeGreaterThan(0.01);
  await expect.poll(frequency).toBeGreaterThan(410);
  expect(await frequency()).toBeLessThan(470);

  // Simulate an engine still producing residual frames after media.pause().
  // The output gate, rather than the browser's pause behavior, must stop them.
  await page.evaluate(() => {
    const capture = Reflect.get(window, '__hostOutputs').at(-1);
    const residual = capture.context.createOscillator();
    residual.connect(capture.input);
    residual.start();
    Reflect.set(window, '__retiredHostAudio', document.querySelector('audio.native-player-source'));
  });
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect.poll(rms).toBeLessThan(0.0001);
  await page.waitForTimeout(300);
  expect(await rms()).toBeLessThan(0.0001);

  await page.getByRole('button', { name: 'Next track', exact: true }).click();
  await expect(page.locator('.track-copy h2')).toHaveText('Second room track');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
  await expect(audio).toHaveJSProperty('paused', true);
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__hostOutputs')[0].context.state)).toBe('closed');
  expect(await page.evaluate(() => (Reflect.get(window, '__retiredHostAudio') as HTMLAudioElement).getAttribute('src'))).toBeNull();
  await page.waitForTimeout(300);
  await expect(audio).toHaveJSProperty('paused', true);

  // Mobile hosts may suspend Web Audio independently of the media element.
  await page.evaluate(() => Reflect.get(window, '__hostOutputs').at(-1).context.suspend());
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(audio).toHaveJSProperty('paused', false);
  await expect.poll(rms).toBeGreaterThan(0.01);
  await expect(page.locator('.track-copy h2')).toHaveText('Second room track');
  await expect.poll(frequency).toBeGreaterThan(630);
  expect(await frequency()).toBeLessThan(690);
  await audio.evaluate(element => {
    element.currentTime = 1;
  });
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Previous track', exact: true }).click();
  await expect(page.locator('.track-copy h2')).toHaveText('E2E Public Room Track');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
  await expect(audio).toHaveJSProperty('paused', true);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(rms).toBeGreaterThan(0.01);
  await expect.poll(frequency).toBeGreaterThan(410);
  expect(await frequency()).toBeLessThan(470);
  await page.screenshot({ path: testInfo.outputPath('mobile-host-playing.png'), animations: 'disabled' });
});

test('a delayed capture fetch cannot replace the newer paused selection', async ({ page }) => {
  let releaseFetch!: () => void;
  const gate = new Promise<void>(resolve => {
    releaseFetch = resolve;
  });
  let captureRequested = false;
  let wave = Buffer.alloc(0);
  await page.route('**/__dotify_e2e__/room-sequence.wav', async route => {
    if (route.request().resourceType() === 'fetch') {
      captureRequested = true;
      await gate;
    }
    await route.fulfill({ contentType: 'audio/wav', body: wave });
  });
  try {
    await page.goto('/?e2eRoom=public&e2eSync=on&e2eCapture=web-audio&e2eCatalog=sequence&e2eTrackDelay=on');
    await page.getByRole('button', { name: /^Play E2E Public Room Track by Dotify Room Host,/ }).click();
    const audio = page.locator('audio.native-player-source').first();
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
    const original = await audio.getAttribute('src');
    wave = Buffer.from(original!.split(',')[1], 'base64');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByRole('button', { name: 'Next track', exact: true }).click();
    await expect.poll(() => captureRequested).toBe(true);
    await page.getByRole('button', { name: 'Previous track', exact: true }).click();
    await expect(page.locator('.track-copy h2')).toHaveText('E2E Public Room Track');
    releaseFetch();
    await page.waitForTimeout(400);
    await expect(audio).toHaveAttribute('src', original!);
    await expect(audio).toHaveJSProperty('paused', true);
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(audio).toHaveJSProperty('paused', false);
  } finally {
    releaseFetch();
  }
});

test('room colors stay consistent between desktop and mobile in either system theme', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openRoom(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.mouse.move(0, 0);
  const colors = () =>
    page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      const shell = getComputedStyle(document.querySelector('.app-shell')!);
      const backdrop = shell.backgroundColor === 'rgba(0, 0, 0, 0)' ? getComputedStyle(document.body) : shell;
      return {
        tokens: ['--canvas', '--ink', '--action', '--aura-a', '--aura-b', '--aura-accent'].map(name => style.getPropertyValue(name)),
        canvas: backdrop.backgroundColor,
        background: backdrop.backgroundImage,
        aura: getComputedStyle(document.querySelector('.app-shell > .aura-bg')!).backgroundImage,
        play: getComputedStyle(document.querySelector('.transport-play')!).backgroundColor
      };
    });
  const desktop = await colors();
  await page.screenshot({ path: testInfo.outputPath('desktop-colors.png'), animations: 'disabled' });
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await colors()).toEqual(desktop);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`mobile-colors-${colorScheme}.png`), animations: 'disabled' });
  }
});
