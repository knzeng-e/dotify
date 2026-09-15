import { expect, test } from '@playwright/test';

for (const capture of ['standard', 'without-native-api']) {
  test(`room audio survives next and home navigation with ${capture} capture`, async ({ browser }, testInfo) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    try {
      if (capture === 'without-native-api')
        await hostContext.addInitScript(() => {
          Object.defineProperty(HTMLMediaElement.prototype, 'captureStream', { value: undefined, configurable: true });
          Object.defineProperty(HTMLMediaElement.prototype, 'mozCaptureStream', { value: undefined, configurable: true });
        });
      for (const context of [hostContext, guestContext])
        await context.addInitScript(() => {
          const Native = window.RTCPeerConnection;
          Reflect.set(window, '__continuityPeers', []);
          window.RTCPeerConnection = class extends Native {
            constructor(configuration?: RTCConfiguration) {
              super(configuration);
              Reflect.get(window, '__continuityPeers').push(this);
            }
          };
        });
      const host = await hostContext.newPage();
      const guest = await guestContext.newPage();
      await host.goto('/?e2eRoom=public&e2eSync=on&e2eCapture=web-audio&e2eCatalog=sequence&e2eAutoplay=on');
      await host.getByRole('button', { name: 'Open a room', exact: true }).click();
      await host.getByRole('button', { name: 'Select E2E Public Room Track', exact: true }).click();
      const hostName = `Continuity ${capture}`;
      await host.getByLabel('Your name in the room').fill(hostName);
      await host.getByRole('button', { name: 'Open the room', exact: true }).click();
      const code = host.getByTestId('room-code');
      await expect(code).toHaveText(/[A-Z0-9]{4,}/);
      const roomId = (await code.innerText()).trim();
      await guest.goto(`/#/rooms/${roomId}`);
      await guest.getByLabel('Your name in the room').fill('Continuous listener');
      await guest.getByRole('button', { name: 'Enter and listen', exact: true }).click();
      await expect(guest.getByTestId('room-listener-sync')).toHaveText('In sync', { timeout: 20_000 });
      await guest.evaluate(async () => {
        const audio = document.querySelectorAll<HTMLAudioElement>('audio.native-player-source')[1];
        const stream = audio.srcObject as MediaStream;
        const context = new AudioContext();
        await context.resume();
        const analyser = context.createAnalyser();
        analyser.fftSize = 4096;
        context.createMediaStreamSource(stream).connect(analyser);
        // Keep the graph rendering without duplicating audible output.
        const gain = context.createGain();
        gain.gain.value = 0;
        analyser.connect(gain).connect(context.destination);
        const data = new Uint8Array(analyser.frequencyBinCount);
        Reflect.set(window, '__continuityStream', stream);
        Reflect.set(window, '__continuityContext', context);
        Reflect.set(window, '__continuityTone', () => {
          analyser.getByteFrequencyData(data);
          let peak = 0;
          for (let i = 1; i < data.length; i++) if (data[i] > data[peak]) peak = i;
          return data[peak] > 30 ? (peak * context.sampleRate) / analyser.fftSize : 0;
        });
      });
      const tone = () => guest.evaluate(() => Reflect.get(window, '__continuityTone')() as number);
      const playing = host.locator('.transport-play');
      if ((await playing.getAttribute('aria-label')) === 'Play') await playing.click();
      await expect.poll(tone).toBeGreaterThan(400);
      const offers = await host.evaluate(() => window.__DOTIFY_E2E_ROOM_JOIN__?.offers);
      expect(await host.evaluate(() => window.__DOTIFY_E2E_ROOM_JOIN__?.webAudioCaptures)).toBe(1);
      for (const [action, title, frequency] of [
        ['Next track', 'Second room track', 660],
        ['Previous track', 'E2E Public Room Track', 440],
        ['Next track', 'Second room track', 660]
      ] as const) {
        await host.getByRole('button', { name: action, exact: true }).click();
        await expect(guest.locator('.track-copy h2')).toHaveText(title);
        await expect(host.locator('audio').first()).toHaveJSProperty('paused', false);
        try {
          await expect.poll(async () => Math.abs((await tone()) - frequency), { timeout: 12_000 }).toBeLessThan(25);
        } catch (error) {
          for (const page of [host, guest]) {
            const diagnostics = await page.evaluate(() => {
              const a = Array.from(document.querySelectorAll<HTMLAudioElement>('audio'));
              const ctx = Reflect.get(window, '__continuityContext') as AudioContext | undefined;
              const peers = Reflect.get(window, '__continuityPeers') as RTCPeerConnection[];
              return {
                title: document.querySelector('.track-copy h2')?.textContent,
                meter: [ctx?.state, ctx?.currentTime, Reflect.get(window, '__continuityTone')?.()],
                sameStream: Reflect.get(window, '__continuityStream') === a[1].srcObject,
                audio: a.map(x => ({
                  time: x.currentTime,
                  paused: x.paused,
                  muted: x.muted,
                  ready: x.readyState,
                  sourceTail: x.src.slice(-16),
                  tracks: (x.srcObject as MediaStream)?.getTracks().map(t => [t.id, t.enabled, t.readyState, t.muted])
                })),
                peers: peers.map(p => ({ state: p.connectionState, tracks: p.getSenders().map(s => [s.track?.id, s.track?.enabled, s.track?.readyState]) })),
                metrics: window.__DOTIFY_E2E_ROOM_JOIN__
              };
            });
            await testInfo.attach(page === host ? 'host-continuity' : 'guest-continuity', {
              body: JSON.stringify(diagnostics),
              contentType: 'application/json'
            });
          }
          throw error;
        }
        expect(
          await guest.evaluate(() => Reflect.get(window, '__continuityStream') === document.querySelectorAll<HTMLAudioElement>('audio')[1].srcObject)
        ).toBe(true);
      }
      expect(await host.evaluate(() => window.__DOTIFY_E2E_ROOM_JOIN__?.offers)).toBe(offers);
      await host.getByRole('button', { name: 'Music', exact: true }).click();
      await expect(host.getByRole('heading', { name: 'Music brings us together.' })).toBeVisible();
      await expect.poll(async () => Math.abs((await tone()) - 660)).toBeLessThan(25);
      // Re-entering our own public card must return to the room, never join it as a guest.
      await host.getByRole('button', { name: `Enter ${hostName}'s room`, exact: true }).click();
      await expect(code).toHaveText(roomId);
      await expect(host.locator('.room-live-chip')).toHaveText('Hosting');
      await expect.poll(async () => Math.abs((await tone()) - 660)).toBeLessThan(25);
      await host.getByRole('link', { name: 'Dotify home', exact: true }).click();
      await expect(host.getByRole('heading', { name: 'Music brings us together.' })).toBeVisible();
      await host.getByRole('button', { name: 'Return to your room', exact: true }).click();
      await expect(code).toHaveText(roomId);
      await expect(host.locator('.room-live-chip')).toHaveText('Hosting');
      await expect.poll(async () => Math.abs((await tone()) - 660)).toBeLessThan(25);
    } finally {
      await guestContext.close();
      await hostContext.close();
    }
  });
}
