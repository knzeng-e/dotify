import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { syntheticWav } from './fixtures/syntheticWav';
const fixture = JSON.parse(readFileSync(process.env.DOTIFY_STREAMING_FIXTURE_PATH ?? path.join(process.cwd(), '.data/streaming-fixture.json'), 'utf8')) as {
  keyHex: string;
  scope: { chainId: number; runtimeAddress: string; contentHash: string; keyVersion: string };
  manifest: string;
  files: Record<string, string>;
};
type Fault =
  | 'none'
  | 'relay'
  | 'relay-capacity'
  | 'retry'
  | 'truncated'
  | 'slow'
  | 'held'
  | 'corrupt'
  | 'failed'
  | 'failed-startup'
  | 'denied'
  | 'key-retry'
  | 'held-startup'
  | 'held-next-startup'
  | 'access-stall';
async function setup(
  page: Page,
  fault: Fault = 'none',
  blob = false,
  continuous = false,
  plainPolicy?: { mode: 'classic' | 'human-free' | 'free'; initiallySeed?: boolean; encryptedOnPolicy?: boolean }
) {
  const requests: string[] = [];
  let attempts = 0,
    keyRequests = 0;
  let relayActive = 0,
    relayPeak = 0,
    relayBusy = 0,
    relayFallbacks = 0;
  let access: boolean | 'unavailable' = true,
    accessReads = 0,
    plainRequests = 0;
  let freeAccess = fault !== 'denied';
  let holdRoom = false;
  let failRoom = false;
  let release = () => {};
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  await page.addInitScript(
    ({ scope, blob, plainPolicy }) => {
      Reflect.set(window, '__STREAMING_SCOPE__', scope);
      Reflect.set(window, '__plainPolicy', plainPolicy?.mode);
      Reflect.set(window, '__plainSeedCandidate', plainPolicy?.initiallySeed ?? false);
      Reflect.set(window, '__encryptedOnPolicy', plainPolicy?.encryptedOnPolicy ?? false);
      if (blob) {
        Object.defineProperty(window, 'MediaSource', { value: undefined });
        Object.defineProperty(window, 'ManagedMediaSource', { value: undefined });
      }
    },
    { scope: fixture.scope, blob, plainPolicy }
  );
  await page.route('**/*', async route => {
    const request = route.request(),
      url = request.url();
    if (url === 'http://media.audio.test/unencrypted-policy.wav') {
      plainRequests++;
      return route.fulfill({ body: syntheticWav(), contentType: 'audio/wav', headers: { 'access-control-allow-origin': '*' } });
    }
    if (url.endsWith('/free-key')) {
      keyRequests++;
      if (fault === 'key-retry' && keyRequests === 1) return route.fulfill({ status: 503, json: { error: 'Temporarily unavailable' } });
      return route.fulfill({
        json: !freeAccess
          ? { access: 'denied', reason: 'ACCESS_DENIED', message: 'Unavailable', hostAction: { type: 'none', label: '' } }
          : { access: 'allowed', playbackMode: 'full', contentKey: `0x${fixture.keyHex}`, runtime: fixture.scope.runtimeAddress }
      });
    }
    if (url.startsWith('http://rpc.audio.test')) {
      const rpc = request.postDataJSON();
      if (rpc.method === 'eth_call') {
        accessReads++;
        if (fault === 'access-stall') await gate;
        if (access === 'unavailable') return route.fulfill({ json: { jsonrpc: '2.0', id: rpc.id, error: { code: -32000, message: 'Runtime unavailable' } } });
      }
      return route.fulfill({ json: { jsonrpc: '2.0', id: rpc.id, result: rpc.method === 'eth_call' ? `0x${'0'.repeat(63)}${access ? 1 : 0}` : '0x190f1b41' } });
    }
    const match = /\/(?:ipfs|api\/media)\/Qm([ab])\1{43}\/(?:stream\/)?(.+)$/.exec(url);
    if (match) {
      const [, name, object] = match;
      requests.push(`${name}:${object}`);
      expect(request.headers().range).toBeUndefined();
      expect(object).not.toContain('archive');
      const value = object === 'manifest.json' ? fixture.manifest : fixture.files[object];
      if (!value) return route.fulfill({ status: 404 });
      if ((fault === 'relay' || fault === 'relay-capacity') && !url.includes('/api/media/')) {
        relayFallbacks++;
        return route.fulfill({ status: 503 });
      }
      if (fault === 'relay-capacity') {
        if (relayActive >= 2) {
          relayBusy++;
          return route.fulfill({ status: 503 });
        }
        relayActive++;
        relayPeak = Math.max(relayPeak, relayActive);
        try {
          await new Promise(resolve => setTimeout(resolve, 100));
          return await route.fulfill({
            body: Buffer.from(value, 'base64'),
            headers: { 'content-type': 'application/octet-stream', 'access-control-allow-origin': '*' }
          });
        } finally {
          relayActive--;
        }
      }
      if (holdRoom && object === 'manifest.json') {
        await gate;
        if (failRoom) return route.fulfill({ status: 503 });
      }
      if (((fault === 'held-startup' && name === 'a') || (fault === 'held-next-startup' && name === 'b')) && object === '96/segment-000.bin') await gate;
      if (name === 'a' && object === '96/segment-001.bin') {
        attempts++;
        if (fault === 'held') await gate;
        if (fault === 'slow') await new Promise(resolve => setTimeout(resolve, 6000));
        if (fault === 'failed' || (fault === 'retry' && attempts === 1)) return route.fulfill({ status: 503 });
      }
      if (name === 'a' && fault === 'failed-startup' && object === 'manifest.json') return route.fulfill({ status: 503 });
      const body = Buffer.from(value, 'base64');
      if (name === 'a' && fault === 'corrupt' && object === '96/segment-001.bin') body[0] ^= 1;
      if (name === 'a' && fault === 'truncated' && object === '96/segment-001.bin' && attempts === 1)
        return route.fulfill({ body: body.subarray(0, body.length - 10), headers: { 'access-control-allow-origin': '*' } });
      return route.fulfill({ body, headers: { 'content-type': 'application/octet-stream', 'access-control-allow-origin': '*' } });
    }
    if (url.startsWith('http://127.0.0.1:5286') || url.startsWith('blob:')) return route.continue();
    return route.fulfill({ status: 503, body: 'No live network in synthetic regression tests' });
  });
  await page.goto('/e2e/fixtures/audio-continuity.html' + (continuous ? '?continuous=1' : ''));
  await page.getByRole('button', { name: 'Select a', exact: true }).click();
  return {
    requests,
    failRoom: () => {
      failRoom = true;
    },
    holdRoom: () => {
      holdRoom = true;
    },
    attempts: () => attempts,
    keyRequests: () => keyRequests,
    release,
    accessReads: () => accessReads,
    plainRequests: () => plainRequests,
    relayStats: () => ({ peak: relayPeak, busy: relayBusy, fallbacks: relayFallbacks }),
    setFreeAccess: (value: boolean) => {
      freeAccess = value;
    },
    setAccess: (value: boolean | 'unavailable') => {
      access = value;
    }
  };
}
const audio = (page: Page) => page.locator('audio').first();
const time = (page: Page) => audio(page).evaluate(element => element.currentTime);
async function installAudioProbe(page: Page) {
  await page.addInitScript(() => {
    const created: HTMLAudioElement[] = [];
    Reflect.set(window, '__createdAudio', created);
    window.Audio = new Proxy(Audio, {
      construct(target, args) {
        const audio = Reflect.construct(target, args) as HTMLAudioElement;
        created.push(audio);
        return audio;
      }
    });
  });
}
async function playing(page: Page, minimum = 0.2) {
  await expect.poll(() => time(page)).toBeGreaterThan(minimum);
  await expect(audio(page)).toHaveJSProperty('paused', false);
}
for (const fault of ['retry', 'truncated', 'relay'] as const)
  test(`${fault}: current streaming retries transport without replacing the player`, async ({ page }) => {
    const probe = await setup(page, fault);
    await playing(page);
    if (fault !== 'relay') await expect.poll(probe.attempts).toBe(2);
    await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '1');
    expect(probe.keyRequests()).toBe(1);
    expect(probe.requests.every(item => /manifest.json|(?:96|160|320)\//.test(item))).toBe(true);
  });
test('pause during an outstanding segment stays paused when transport resumes', async ({ page }) => {
  const probe = await setup(page, 'held');
  await playing(page);
  await expect.poll(probe.attempts).toBe(1);
  await page.getByRole('button', { name: 'Toggle playback' }).click();
  const position = await time(page);
  probe.release();
  await page.waitForTimeout(400);
  await expect(audio(page)).toHaveJSProperty('paused', true);
  expect(await time(page)).toBeCloseTo(position, 1);
  await page.getByRole('button', { name: 'Toggle playback' }).click();
  await playing(page, position + 0.2);
});
test('reselect and A to B to A create fresh authenticated streams', async ({ page }) => {
  await setup(page);
  await playing(page);
  for (const name of ['a', 'b', 'a']) {
    await page.getByRole('button', { name: `Select ${name}`, exact: true }).click();
    await playing(page);
    await expect(audio(page)).toHaveJSProperty('error', null);
  }
  await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '4');
});
test('a slow segment buffers and resumes without resetting the media clock', async ({ page }) => {
  await setup(page, 'slow');
  await playing(page);
  await expect(page.getByTestId('state')).toHaveAttribute('data-status', 'buffering');
  expect(await time(page)).toBeGreaterThan(3);
  await playing(page, 4.1);
  await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '1');
});
test('changing track cancels an outstanding read without overwriting the new selection', async ({ page }) => {
  const probe = await setup(page, 'held');
  await playing(page);
  await page.getByRole('button', { name: 'Select b', exact: true }).click();
  await playing(page);
  probe.release();
  await page.waitForTimeout(200);
  await expect(page.getByTestId('state')).toHaveAttribute('data-track', /:b$/);
  await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '2');
});
for (const blob of [false, true])
  test(`authentication failure is terminal, without another key or archival fallback (Blob=${blob})`, async ({ page }) => {
    const probe = await setup(page, 'corrupt', blob);
    if (blob) {
      await expect(page.getByTestId('state')).toHaveAttribute('data-pending', 'false');
      await expect(page.getByTestId('state')).toHaveAttribute('data-failure', /.+/);
      await expect(audio(page)).toHaveJSProperty('paused', true);
    } else await expect(page.getByTestId('state')).toHaveAttribute('data-status', 'no-audio');
    expect(probe.attempts()).toBe(1);
    expect(probe.keyRequests()).toBe(1);
  });
test('a denied key never starts playback or downloads media', async ({ page }) => {
  const probe = await setup(page, 'denied');
  await expect(page.getByTestId('state')).toHaveAttribute('data-pending', 'false');
  await expect(audio(page)).toHaveJSProperty('paused', true);
  expect(probe.requests).toHaveLength(0);
});
test('exhausted segment readers end the loading state and another track can play', async ({ page }) => {
  await setup(page, 'failed');
  await expect(page.getByTestId('state')).toHaveAttribute('data-status', 'no-audio');
  await page.getByRole('button', { name: 'Select b', exact: true }).click();
  await playing(page);
});
test('authorized compatibility preparation reports progress without marking Free access locked', async ({ page }) => {
  const probe = await setup(page, 'held-startup', true);
  try {
    await expect(page.getByTestId('state')).toHaveAttribute('data-pending', 'true');
    await expect(page.getByTestId('state')).toHaveAttribute('data-access', 'true');
    await expect(page.getByTestId('state')).toHaveAttribute('data-preparation', /^Preparing audio · \d+%$/);
    expect(await audio(page).getAttribute('src')).toBeNull();
    probe.release();
    await playing(page);
  } finally {
    probe.release();
  }
});

test('failure before metadata settles pending and permits a new selection', async ({ page }) => {
  await setup(page, 'failed-startup');
  await expect(page.getByTestId('state')).toHaveAttribute('data-pending', 'false');
  await expect(page.getByTestId('state')).toHaveAttribute('data-access', 'true');
  await expect(page.getByTestId('state')).toHaveAttribute('data-failure', /.+/);
  await page.getByRole('button', { name: 'Select b', exact: true }).click();
  await playing(page);
});
test('a temporary key failure recovers without refresh and anonymous reselect checks access again', async ({ page }) => {
  const probe = await setup(page, 'key-retry');
  // One transient failure, then the existing quiet retry starts real audio.
  await playing(page);
  await expect(page.getByTestId('state')).toHaveAttribute('data-pending', 'false');
  expect(probe.keyRequests()).toBe(2);
  // This visitor has no signed session/prepared grant. A new selection must
  // recheck Free access instead of reusing the retired indefinite key map.
  await page.getByRole('button', { name: 'Select a', exact: true }).click();
  await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '2');
  await playing(page);
  expect(probe.keyRequests()).toBe(3);
});
test('Free playback reaches the authorized key service without waiting for a client chain read', async ({ page }) => {
  const probe = await setup(page, 'access-stall');
  try {
    await expect.poll(probe.keyRequests).toBe(1);
    await playing(page);
    expect(probe.accessReads()).toBe(0);
    await expect(page.getByTestId('state')).toHaveAttribute('data-access', 'true');
  } finally {
    probe.release();
  }
});

test('cached compatibility audio cannot bypass a new Free-key denial', async ({ page }) => {
  const probe = await setup(page, 'none', true);
  await playing(page);
  const mediaReads = () => probe.requests.filter(request => request.startsWith('a:')).length;
  const downloaded = mediaReads();
  probe.setFreeAccess(false);
  await page.getByRole('button', { name: 'Select a', exact: true }).click();
  await expect(page.getByTestId('state')).toHaveAttribute('data-pending', 'false');
  await expect(page.getByTestId('state')).toHaveAttribute('data-access', 'false');
  await expect(page.getByTestId('state')).toHaveAttribute('data-failure', 'access-not-confirmed');
  await expect(audio(page)).toHaveJSProperty('paused', true);
  const deniedRequests = probe.keyRequests();
  expect(deniedRequests).toBeGreaterThan(1);
  expect(mediaReads()).toBe(downloaded);
  probe.setFreeAccess(true);
  await page.getByRole('button', { name: 'Select a', exact: true }).click();
  await playing(page);
  expect(probe.keyRequests()).toBe(deniedRequests + 1);
  expect(mediaReads()).toBe(downloaded);
});

test('a fresh mobile source explicitly starts loading instead of relying on implicit preload', async ({ page }) => {
  await page.addInitScript(() => {
    window.Audio = new Proxy(Audio, {
      construct(target, args) {
        const element = Reflect.construct(target, args) as HTMLAudioElement;
        element.preload = 'none';
        return element;
      }
    });
  });
  await setup(page, 'none', true);
  await playing(page);
});

async function requireNativePlayGesture(page: Page, releaseOnPlay: boolean) {
  await page.addInitScript(releaseOnPlay => {
    Reflect.set(window, '__holdNativeLoad', true);
    window.Audio = new Proxy(Audio, {
      construct(target, args) {
        const element = Reflect.construct(target, args) as HTMLAudioElement;
        if (Reflect.get(window, '__holdNativeLoad')) {
          // Chromium may ignore preload=none for Blobs. Defer actual resource
          // selection too, so this Host restriction is deterministic in either
          // engine while playback/decoding after the gesture remain native.
          const src = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src')!;
          const play = element.play.bind(element);
          let pendingSource = '';
          Object.defineProperty(element, 'src', {
            get: () => pendingSource,
            set: (value: string) => {
              pendingSource = value;
            }
          });
          element.load = () => {};
          element.play = () => {
            if (!releaseOnPlay) return new Promise(() => {});
            if (src.get!.call(element) !== pendingSource) src.set!.call(element, pendingSource);
            return play();
          };
        }
        return element;
      }
    });
  }, releaseOnPlay);
}

test('a mobile engine that requires Play before metadata does not trap the transport', async ({ page }) => {
  await requireNativePlayGesture(page, true);
  await setup(page, 'none', true);
  await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '1');
  await expect(page.getByTestId('state')).toHaveAttribute('data-pending', 'true');
  await page.getByRole('button', { name: 'Toggle playback' }).click();
  await playing(page);
  await expect(page.getByTestId('state')).toHaveAttribute('data-pending', 'false');
});

test('pending native Play displays Pause and can be cancelled before canplay', async ({ page }) => {
  await requireNativePlayGesture(page, true);
  const probe = await setup(page, 'held-startup');
  try {
    await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '1');
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(audio(page)).toHaveJSProperty('paused', false);
    await expect.poll(() => probe.requests.includes('a:96/segment-000.bin')).toBe(true);
    await expect(page.getByTestId('state')).toHaveAttribute('data-pending', 'true');
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
    await expect(page.getByTestId('state')).toHaveAttribute('data-time', '0');
    await expect(page.getByRole('slider', { name: 'Seek', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(audio(page)).toHaveJSProperty('paused', true);
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
    probe.release();
    await expect(page.getByTestId('state')).toHaveAttribute('data-pending', 'false');
    await expect(audio(page)).toHaveJSProperty('paused', true);
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await playing(page);
  } finally {
    probe.release();
  }
});

test('a new pending source does not inherit Pause from the previously playing track', async ({ page }) => {
  await requireNativePlayGesture(page, true);
  const probe = await setup(page, 'held-next-startup');
  try {
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await playing(page);
    await page.getByRole('button', { name: 'Select b', exact: true }).click();
    await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '2');
    await expect(page.getByTestId('state')).toHaveAttribute('data-pending', 'true');
    await expect(audio(page)).toHaveJSProperty('paused', true);
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
    await expect(page.getByRole('slider', { name: 'Seek', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
    probe.release();
    await playing(page);
  } finally {
    probe.release();
  }
});

test('a silent native startup expires with retry and cannot revive after its deadline', async ({ page }) => {
  await page.clock.install();
  await requireNativePlayGesture(page, false);
  await setup(page, 'none', true);
  await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '1');
  await page.clock.fastForward(60_001);
  await expect(page.getByTestId('state')).toHaveAttribute('data-pending', 'false');
  await expect(page.getByTestId('state')).toHaveAttribute('data-failure', 'audio-unavailable');
  expect(await audio(page).getAttribute('src')).toBeNull();
  await page.evaluate(() => Reflect.set(window, '__holdNativeLoad', false));
  await page.getByRole('button', { name: 'Select a', exact: true }).click();
  await playing(page);
  await expect(page.getByTestId('state')).toHaveAttribute('data-failure', '');
});

test('an expired startup deadline cannot clear a newer paused selection', async ({ page }) => {
  await page.clock.install();
  await setup(page, 'none', true);
  await playing(page);
  await page.getByRole('button', { name: 'Select b', exact: true }).click();
  await playing(page);
  await page.getByRole('button', { name: 'Toggle playback' }).click();
  await expect(audio(page)).toHaveJSProperty('paused', true);
  await page.clock.fastForward(60_001);
  await expect(page.getByTestId('state')).toHaveAttribute('data-track', /:b$/);
  await expect(page.getByTestId('state')).toHaveAttribute('data-failure', '');
  await expect(audio(page)).toHaveJSProperty('paused', true);
  expect(await audio(page).getAttribute('src')).toMatch(/^blob:/);
});

test('hosts without MSE retry ciphertext objects and play the same authenticated AAC rendition', async ({ page }) => {
  const probe = await setup(page, 'retry', true);
  await playing(page);
  expect(probe.attempts()).toBe(2);
  await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '1');
});

for (const changePurpose of [false, true])
  test(
    changePurpose
      ? 'a changed playback purpose rejects the prepared source and authorizes again'
      : 'an authorized silent next source is adopted at the boundary without another key or download',
    async ({ page }) => {
      await installAudioProbe(page);
      const probe = await setup(page, 'none', false, true);
      await playing(page);
      await audio(page).evaluate(element => {
        element.currentTime = 11;
      });
      await expect.poll(() => probe.requests.some(path => path === 'b:96/segment-001.bin')).toBe(true);
      await expect.poll(probe.keyRequests).toBe(2);
      await expect
        .poll(() =>
          page.evaluate(() => {
            const prepared = (Reflect.get(window, '__createdAudio') as HTMLAudioElement[]).find(
              audio => !audio.isConnected && audio.src && audio.readyState >= 3
            );
            Reflect.set(window, '__expectedWarmAudio', prepared);
            return Boolean(prepared);
          })
        )
        .toBe(true);
      if (changePurpose) await page.evaluate(() => Reflect.set(window, '__selectForRoom', true));
      await page.evaluate(() => {
        const sample = { ended: 0, playing: 0 };
        Reflect.set(window, '__warmBoundary', sample);
        document.querySelector('audio')!.addEventListener(
          'ended',
          () => {
            sample.ended = performance.now();
          },
          { once: true }
        );
        document.addEventListener(
          'playing',
          event => {
            if (sample.ended && event.target === document.querySelector('audio')) sample.playing = performance.now();
          },
          true
        );
      });
      await expect(page.getByTestId('state')).toHaveAttribute('data-track', /:b$/, { timeout: 20000 });
      await expect(audio(page)).toHaveJSProperty('paused', false);
      await expect.poll(() => page.evaluate(() => (Reflect.get(window, '__warmBoundary') as { playing: number }).playing)).toBeGreaterThan(0);
      const gap = await page.evaluate(() => {
        const value = Reflect.get(window, '__warmBoundary') as { ended: number; playing: number };
        return value.playing - value.ended;
      });
      expect(gap).toBeGreaterThanOrEqual(0);
      if (!changePurpose) expect(gap).toBeLessThan(300);
      expect(await page.evaluate(() => document.querySelector('audio') === Reflect.get(window, '__expectedWarmAudio'))).toBe(!changePurpose);
      expect(probe.keyRequests()).toBe(changePurpose ? 3 : 2);
      await expect(audio(page)).toHaveJSProperty('error', null);
    }
  );

for (const scenario of [
  { mode: 'classic', access: false },
  { mode: 'human-free', access: false },
  { mode: 'classic', access: true },
  { mode: 'classic', access: 'unavailable' }
] as const) {
  test(`unencrypted ${scenario.mode} keeps policy checks when access is ${scenario.access}`, async ({ page }) => {
    await installAudioProbe(page);
    const probe = await setup(page, 'none', false, true, { mode: scenario.mode });
    await playing(page);
    probe.setAccess(scenario.access);
    await audio(page).evaluate(element => {
      element.currentTime = 11;
    });
    await expect(page.getByTestId('state')).toHaveAttribute('data-preparations', '1');
    // Preparation must not attach even a paused source for a policy-managed URL.
    expect(
      await page.evaluate(() => (Reflect.get(window, '__createdAudio') as HTMLAudioElement[]).some(element => element.src.includes('unencrypted-policy.wav')))
    ).toBe(false);
    expect(probe.plainRequests()).toBe(0);
    const readsBeforeSelection = probe.accessReads();
    await page.getByRole('button', { name: 'Select b', exact: true }).click();
    await expect(page.getByTestId('state')).toHaveAttribute('data-track', /:b$/);
    await expect(page.getByTestId('state')).toHaveAttribute('data-pending', 'false');
    await expect(page.getByTestId('state')).toHaveAttribute('data-access', String(scenario.access === true));
    expect(probe.accessReads()).toBeGreaterThan(readsBeforeSelection);
    if (scenario.access === true) {
      await playing(page);
      expect(probe.plainRequests()).toBeGreaterThan(0);
    } else {
      await expect(audio(page)).toHaveJSProperty('paused', true);
      expect(probe.plainRequests()).toBe(0);
    }
    expect(probe.keyRequests()).toBe(1);
  });
}

for (const encryptedOnPolicy of [false, true])
  test(`a ready local candidate cannot bypass a newly applied artist policy (encrypted=${encryptedOnPolicy})`, async ({ page }) => {
    await installAudioProbe(page);
    const probe = await setup(page, 'none', false, true, { mode: encryptedOnPolicy ? 'free' : 'classic', initiallySeed: true, encryptedOnPolicy });
    await playing(page);
    probe.setAccess(false);
    if (encryptedOnPolicy) probe.setFreeAccess(false);
    await audio(page).evaluate(element => {
      element.currentTime = 11;
    });
    await expect
      .poll(() =>
        page.evaluate(() =>
          (Reflect.get(window, '__createdAudio') as HTMLAudioElement[]).some(
            element => !element.isConnected && element.src.includes('unencrypted-policy.wav') && element.readyState >= 3
          )
        )
      )
      .toBe(true);
    const readsBeforeSelection = probe.accessReads();
    await page.getByRole('button', { name: 'Apply artist policy to b', exact: true }).click();
    await page.getByRole('button', { name: 'Select b', exact: true }).click();
    await expect(page.getByTestId('state')).toHaveAttribute('data-track', /:b$/);
    await expect(page.getByTestId('state')).toHaveAttribute('data-pending', 'false');
    await expect(page.getByTestId('state')).toHaveAttribute('data-access', 'false');
    if (encryptedOnPolicy) expect(probe.accessReads()).toBe(readsBeforeSelection);
    else expect(probe.accessReads()).toBeGreaterThan(readsBeforeSelection);
    await expect(audio(page)).toHaveJSProperty('paused', true);
    expect(
      await page.evaluate(() => (Reflect.get(window, '__createdAudio') as HTMLAudioElement[]).some(element => element.src.includes('unencrypted-policy.wav')))
    ).toBe(false);
  });

// Real native AAC decoding with controlled MMS demand/eviction. This does not
// replace physical Product/iPhone acceptance.
async function installManagedReader(page: Page, automaticDemand = true, stopDuringFirstMediaAppend = false) {
  await page.addInitScript(
    ({ automaticDemand, stopDuringFirstMediaAppend }) => {
      const Native = window.MediaSource;
      const sources: MediaSource[] = [];
      Reflect.set(window, '__managedSources', sources);
      const urls = new Set<string>();
      const create = URL.createObjectURL.bind(URL);
      URL.createObjectURL = object => {
        const url = create(object);
        if (sources.includes(object as MediaSource)) urls.add(url);
        return url;
      };
      const src = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src')!;
      Object.defineProperty(HTMLMediaElement.prototype, 'src', {
        ...src,
        set(value: string) {
          if (urls.has(value) && !(this as HTMLAudioElement).disableRemotePlayback) throw new Error('Managed attachment configured too late');
          src.set!.call(this, value);
        }
      });
      class ManagedReader extends Native {
        streaming = false;
        appendCalls = 0;
        constructor() {
          super();
          sources.push(this);
          this.addEventListener('sourceopen', () => {
            if (automaticDemand) this.demand(true);
          });
        }
        addSourceBuffer(mime: string) {
          const buffer = super.addSourceBuffer(mime);
          if (stopDuringFirstMediaAppend) {
            const append = buffer.appendBuffer.bind(buffer);
            buffer.appendBuffer = data => {
              append(data);
              this.appendCalls++;
              // Init is first. Stop demand during the first real AAC append,
              // before native updateend completes, as observed on iPhone.
              if (this.appendCalls === 2) this.demand(false);
            };
          }
          return buffer;
        }
        demand(value: boolean) {
          this.streaming = value;
          this.dispatchEvent(new Event(value ? 'startstreaming' : 'endstreaming'));
        }
      }
      Reflect.set(window, 'ManagedMediaSource', ManagedReader);
      Object.defineProperty(window, 'MediaSource', { value: undefined, configurable: true });
    },
    { automaticDemand, stopDuringFirstMediaAppend }
  );
}

test('managed AAC starts before the rest of the encrypted track arrives', async ({ page }) => {
  await installManagedReader(page);
  const probe = await setup(page, 'held');
  await playing(page);
  expect(probe.attempts()).toBe(1);
  await expect(audio(page)).toHaveJSProperty('disableRemotePlayback', true);
  expect(probe.keyRequests()).toBe(1);
  probe.release();
  await playing(page, 4.2);
});

test('managed AAC respects demand before requesting media and resumes after eviction', async ({ page }) => {
  await installManagedReader(page, false);
  const probe = await setup(page);
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__managedSources').length)).toBe(1);
  await page.waitForTimeout(300);
  expect(probe.requests.some(item => /segment-001/.test(item))).toBe(false);
  await page.evaluate(() => Reflect.get(window, '__managedSources')[0].demand(true));
  await playing(page);
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__managedSources')[0].readyState)).toBe('ended');
  await page.getByRole('button', { name: 'Toggle playback' }).click();
  await page.evaluate(async () => {
    const source = Reflect.get(window, '__managedSources')[0];
    const buffer: SourceBuffer = source.sourceBuffers[0];
    source.demand(false);
    await new Promise<void>(resolve => {
      buffer.addEventListener('updateend', () => resolve(), { once: true });
      buffer.remove(0, 4);
    });
    buffer.dispatchEvent(Object.assign(new Event('bufferedchange'), { removedRanges: { length: 1, start: () => 0, end: () => 4 } }));
    document.querySelector('audio')!.currentTime = 0.5;
    source.demand(true);
  });
  await expect.poll(() => audio(page).evaluate(a => (a.buffered.length ? a.buffered.start(0) : 99))).toBeLessThan(0.1);
  await expect(audio(page)).toHaveJSProperty('paused', true);
  await page.getByRole('button', { name: 'Toggle playback' }).click();
  await playing(page, 0.8);
  expect(probe.keyRequests()).toBe(1);
});

test('managed AAC does not append completed frames again after a demand stop during update', async ({ page }) => {
  await installManagedReader(page, true, true);
  const probe = await setup(page);
  await playing(page);
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__managedSources')[0].sourceBuffers[0].updating)).toBe(false);
  expect(await page.evaluate(() => Reflect.get(window, '__managedSources')[0].appendCalls)).toBe(2);
  await page.evaluate(() => Reflect.get(window, '__managedSources')[0].demand(true));
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__managedSources')[0].readyState)).toBe('ended');
  const segments = Object.keys(fixture.files).filter(name => /^96\/segment-\d+\.bin$/.test(name)).length;
  expect(segments).toBeGreaterThan(1);
  expect(await page.evaluate(() => Reflect.get(window, '__managedSources')[0].appendCalls)).toBe(segments + 1); // One init, each media fragment once.
  expect(probe.keyRequests()).toBe(1);
  expect(probe.requests.some(item => /archive/.test(item))).toBe(false);
});

test('managed AAC does not download or play denied audio', async ({ page }) => {
  await installManagedReader(page);
  const probe = await setup(page, 'denied');
  await expect(page.getByTestId('state')).toHaveAttribute('data-pending', 'false');
  expect(probe.requests.some(item => /segment-001/.test(item))).toBe(false);
  expect(await page.evaluate(() => Reflect.get(window, '__managedSources').length)).toBe(0);
  expect(await time(page)).toBe(0);
});

test('managed AAC fails closed on authenticated segment corruption', async ({ page }) => {
  await installManagedReader(page);
  const probe = await setup(page, 'corrupt');
  await expect(page.getByTestId('state')).toHaveAttribute('data-status', 'no-audio');
  expect(probe.keyRequests()).toBe(1);
  expect(probe.attempts()).toBe(1);
  expect(probe.requests.some(item => /archive/.test(item))).toBe(false);
});

test('managed AAC cancellation cannot replace the next selected track', async ({ page }) => {
  await installManagedReader(page);
  const probe = await setup(page, 'held-startup');
  await expect.poll(() => probe.requests.includes('a:96/segment-000.bin')).toBe(true);
  await page.getByRole('button', { name: 'Select b', exact: true }).click();
  await playing(page);
  probe.release();
  await page.waitForTimeout(300);
  await expect(page.getByTestId('state')).toHaveAttribute('data-track', /:b$/);
  await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '2');
});

test('managed AAC adopts an authorized silent next source without replaying authorization', async ({ page }) => {
  await installManagedReader(page);
  await installAudioProbe(page);
  const probe = await setup(page, 'none', false, true);
  await playing(page);
  await audio(page).evaluate(a => {
    a.currentTime = 11;
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const prepared = (Reflect.get(window, '__createdAudio') as HTMLAudioElement[]).find(a => !a.isConnected && a.src && a.readyState >= 3);
        Reflect.set(window, '__expectedWarmAudio', prepared);
        return Boolean(prepared);
      })
    )
    .toBe(true);
  await page.getByRole('button', { name: 'Select b', exact: true }).click();
  await playing(page);
  expect(await page.evaluate(() => document.querySelector('audio') === Reflect.get(window, '__expectedWarmAudio'))).toBe(true);
  expect(probe.keyRequests()).toBe(2);
  await expect(audio(page)).toHaveJSProperty('disableRemotePlayback', true);
});

test('native WebKit managed AAC starts while a later segment is still unavailable', async ({ page, browserName }) => {
  test.skip(browserName !== 'webkit', 'Native ManagedMediaSource requires a supporting WebKit build.');
  const supported = await page.evaluate(() => Boolean(Reflect.get(window, 'ManagedMediaSource')?.isTypeSupported('audio/mp4; codecs="mp4a.40.2"')));
  test.skip(!supported, 'This platform WebKit build does not expose native managed AAC.');
  await page.addInitScript(() => {
    const Native = Reflect.get(window, 'ManagedMediaSource');
    Reflect.set(
      window,
      'ManagedMediaSource',
      new Proxy(Native, {
        construct(target, args) {
          const source = Reflect.construct(target, args);
          Reflect.set(window, '__nativeManagedSource', source);
          return source;
        }
      })
    );
    Object.defineProperty(window, 'MediaSource', { value: undefined });
  });
  const probe = await setup(page, 'held');
  await playing(page);
  await expect(audio(page)).toHaveJSProperty('disableRemotePlayback', true);
  probe.release();
  await playing(page, 4.2);
  await page.getByRole('button', { name: 'Toggle playback' }).click();
  await page.evaluate(async () => {
    const buffer: SourceBuffer = Reflect.get(window, '__nativeManagedSource').sourceBuffers[0];
    if (buffer.updating) await new Promise<void>(resolve => buffer.addEventListener('updateend', () => resolve(), { once: true }));
    await new Promise<void>(resolve => {
      buffer.addEventListener('updateend', () => resolve(), { once: true });
      buffer.remove(0, 3);
    });
    // Native bufferedchange and demand events, with no manual event injection.
    document.querySelector('audio')!.currentTime = 0.5;
  });
  await page.getByRole('button', { name: 'Toggle playback' }).click();
  await playing(page, 1);
  expect(probe.keyRequests()).toBe(1);
});

test('failed complete preparation is not a ready Room source and explicit solo retry recovers without reloading', async ({ page }) => {
  const probe = await setup(page, 'failed-startup', true);
  await expect(page.getByTestId('state')).toHaveAttribute('data-failure', 'audio-unavailable');
  await expect(page.getByTestId('state')).toHaveAttribute('data-preparation-failed', 'true');
  await expect(page.locator('audio[src]')).toHaveCount(0);
  const keysBefore = probe.keyRequests();
  await page.route('**/api/media/**/stream/manifest.json', route =>
    route.fulfill({
      body: Buffer.from(fixture.manifest, 'base64'),
      headers: { 'content-type': 'application/octet-stream', 'access-control-allow-origin': '*' }
    })
  );
  await page.getByRole('button', { name: 'Select a', exact: true }).click();
  await playing(page);
  await expect(page.getByTestId('state')).toHaveAttribute('data-failure', '');
  await expect(page.getByTestId('state')).toHaveAttribute('data-preparation-failed', 'false');
  expect(probe.keyRequests()).toBe(keysBefore + 1);
});

test('complete authenticated preparation respects the relay capacity without triggering gateway recovery', async ({ page }) => {
  const probe = await setup(page, 'relay-capacity', true);
  await playing(page);
  expect(probe.relayStats()).toEqual({ peak: 2, busy: 0, fallbacks: 0 });
  expect(probe.keyRequests()).toBe(1);
  await expect(page.getByTestId('state')).toHaveAttribute('data-preparation-failed', 'false');
});

for (const clipboardWorks of [true, false]) {
  test(`audio failure support export ${clipboardWorks ? 'copies a sanitized report' : 'offers a readable fallback when the Host blocks copying'}`, async ({
    page
  }) => {
    await page.addInitScript(allowed => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            if (!allowed) throw new Error('Clipboard unavailable');
            Reflect.set(window, '__copiedAudioReport', text);
          }
        }
      });
    }, clipboardWorks);
    const probe = await setup(page, 'failed-startup', true);
    await expect(page.getByTestId('state')).toHaveAttribute('data-failure', 'audio-unavailable');
    const keysBefore = probe.keyRequests();
    const requestsBefore = probe.requests.length;
    await page.getByRole('button', { name: 'Copy support report', exact: true }).click();
    let text: string;
    if (clipboardWorks) {
      await expect(page.getByText('Report copied', { exact: true })).toBeVisible();
      text = await page.evaluate(() => Reflect.get(window, '__copiedAudioReport'));
    } else {
      const report = page.getByRole('textbox', { name: 'Audio support report' });
      await expect(report).toBeVisible();
      await expect(report).toHaveAttribute('readonly', '');
      text = await report.inputValue();
    }
    const report = JSON.parse(text);
    expect(report.schema).toBe('dotify.audio-diagnostics.v1');
    expect(report.streaming.some((event: { phase: string }) => event.phase === 'key-authorized')).toBe(true);
    expect(text).not.toContain(fixture.keyHex);
    expect(text).not.toContain(fixture.scope.runtimeAddress);
    expect(text).not.toContain('Qmaaaaa');
    expect(text).not.toContain('http://api.audio.test');
    expect(probe.keyRequests()).toBe(keysBefore);
    expect(probe.requests.length).toBe(requestsBefore);
    await expect(page.getByTestId('state')).toHaveAttribute('data-failure', 'audio-unavailable');
  });
}

test('successful complete preparation keeps correlated reader and host timing evidence', async ({ page }) => {
  const probe = await setup(page, 'none', true);
  await playing(page);
  const report = await page.evaluate(async () => {
    const { getAudioStartupTelemetrySnapshot, serializeAudioDiagnostics } = await import('/src/features/catalog/audioStartupTelemetry.ts');
    return JSON.parse(serializeAudioDiagnostics(getAudioStartupTelemetrySnapshot()));
  });
  const ready = report.streaming.find((event: { phase: string }) => event.phase === 'compatibility-ready');
  expect(ready).toMatchObject({ readAttempt: 1, forRoomCapture: false });
  expect(ready.attempt).toBeGreaterThan(0);
  expect(ready.readTimings.objectsRead).toBeGreaterThan(2);
  expect(ready.readTimings.objectsDecrypted).toBe(ready.readTimings.objectsRead);
  expect(ready.readTimings.encryptedBytes).toBeGreaterThan(0);
  const downloaded = report.streaming.find((event: { phase: string }) => event.phase === 'compatibility-downloaded');
  expect(ready.elapsedMs).toBeGreaterThanOrEqual(downloaded.elapsedMs);
  expect(ready.selectionElapsedMs).toBeGreaterThanOrEqual(ready.elapsedMs);
  expect(report.host.some((event: { phase: string; attempt: number }) => event.phase === 'media-playing' && event.attempt === ready.attempt)).toBe(true);
  expect(probe.keyRequests()).toBe(1);
});

test('a retried access request stays in one startup attempt and reports Room intent', async ({ page }) => {
  await page.addInitScript(() => Reflect.set(window, '__captureForRoom', true));
  const probe = await setup(page, 'key-retry', true);
  await playing(page);
  const report = await page.evaluate(async () => {
    const { getAudioStartupTelemetrySnapshot, serializeAudioDiagnostics } = await import('/src/features/catalog/audioStartupTelemetry.ts');
    return JSON.parse(serializeAudioDiagnostics(getAudioStartupTelemetrySnapshot()));
  });
  const starts = report.streaming.filter((event: { phase: string }) => event.phase === 'preparation-started');
  expect(starts.map((event: { readAttempt: number }) => event.readAttempt)).toEqual([1, 2]);
  expect(starts[0].attempt).toBe(starts[1].attempt);
  expect(starts[0].forRoomCapture).toBe(true);
  const failure = report.streaming.find((event: { phase: string; errorKind: string }) => event.phase === 'error' && event.errorKind === 'key-unavailable');
  expect(failure).toMatchObject({ attempt: starts[0].attempt, readAttempt: 1 });
  const ready = report.streaming.find((event: { phase: string }) => event.phase === 'compatibility-ready');
  expect(ready).toMatchObject({ attempt: starts[0].attempt, readAttempt: 2, forRoomCapture: true });
  expect(probe.keyRequests()).toBe(2);
});

async function managedSolo(page: Page) {
  const probe = await setup(page);
  await playing(page);
  await page.evaluate(async () => {
    const path = '/src/features/catalog/streamingMediaSource.ts';
    const { ownManagedAudioUrl } = await import(path);
    ownManagedAudioUrl(document.querySelector('audio')!.getAttribute('src')!, new AbortController().signal);
    // Exercise the managed-only capability contract with the real MSE solo
    // decoder still alive, then the real complete AAC compatibility reader.
    Object.defineProperty(window, 'ManagedMediaSource', { value: window.MediaSource, configurable: true });
    Object.defineProperty(window, 'MediaSource', { value: undefined, configurable: true });
    Reflect.set(window, '__soloBeforeRoom', document.querySelector('audio'));
    if (!(await import(path)).roomCaptureNeedsCompatibility(true)) throw new Error('Managed-only capability was not installed');
  });
  // Expire the documented 30-second ciphertext cache so the network gate
  // observes an actual new preparation rather than a fully warm replay.
  await page.clock.setFixedTime(Date.now() + 60_000);
  return probe;
}

async function managedHandoff(page: Page) {
  const probe = await managedSolo(page);
  probe.holdRoom();
  await page.getByRole('button', { name: 'Prepare current for room', exact: true }).click();
  await expect.poll(() => probe.requests.filter(path => path === 'a:manifest.json').length).toBe(2);
  await expect(page.getByTestId('room-preparation')).toHaveText('preparing');
  return probe;
}

test('solo media continues through delayed Room preparation, then switches at the live position', async ({ page }) => {
  const probe = await managedHandoff(page);
  await audio(page).evaluate((audio: HTMLAudioElement) => {
    audio.currentTime = 5;
  });
  await playing(page, 5.3);
  await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '1');
  await expect(page.getByTestId('state')).toHaveAttribute('data-pending', 'false');
  const atHandoff = await time(page);
  probe.release();
  await expect(page.getByTestId('room-preparation')).toHaveText('ready');
  await playing(page, atHandoff);
  await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '2');
  expect(await audio(page).evaluate(audio => audio !== Reflect.get(window, '__soloBeforeRoom'))).toBe(true);
});

for (const action of ['cancel', 'select'] as const)
  test(`a ${action} during Room preparation cannot replace the continuing solo selection`, async ({ page }) => {
    const probe = await managedHandoff(page);
    if (action === 'cancel') await page.getByRole('button', { name: 'Cancel room preparation', exact: true }).click();
    else {
      await page.evaluate(() => Object.defineProperty(window, 'MediaSource', { value: Reflect.get(window, 'ManagedMediaSource'), configurable: true }));
      await page.getByRole('button', { name: 'Select b', exact: true }).click();
    }
    await expect(page.getByTestId('room-preparation')).toHaveText('cancelled-or-failed');
    probe.release();
    await page.waitForTimeout(200);
    await playing(page);
    await expect(page.getByTestId('state')).toHaveAttribute('data-generation', action === 'cancel' ? '1' : '2');
    await expect(page.getByTestId('state')).toHaveAttribute('data-track', action === 'cancel' ? /:a$/ : /:b$/);
  });

test('a pause during Room preparation stays paused across the replacement', async ({ page }) => {
  const probe = await managedHandoff(page);
  await page.getByRole('button', { name: 'Toggle playback', exact: true }).click();
  const position = await time(page);
  probe.release();
  await expect(page.getByTestId('room-preparation')).toHaveText('ready');
  await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '2');
  await expect(audio(page)).toHaveJSProperty('paused', true);
  await expect.poll(() => time(page)).toBeCloseTo(position, 1);
});

test('a native pause during Room preparation stays paused across the replacement', async ({ page }) => {
  const probe = await managedHandoff(page);
  await audio(page).evaluate(element => element.pause());
  await expect(page.getByTestId('state')).toHaveAttribute('data-playing', 'false');
  const position = await time(page);
  probe.release();
  await expect(page.getByTestId('room-preparation')).toHaveText('ready');
  await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '2');
  await expect.poll(() => audio(page).evaluate(element => element.readyState)).toBeGreaterThanOrEqual(3);
  await expect(audio(page)).toHaveJSProperty('paused', true);
  await expect.poll(() => time(page)).toBeCloseTo(position, 1);
  await page.waitForTimeout(250);
  expect(await time(page)).toBeCloseTo(position, 1);
  await page.getByRole('button', { name: 'Toggle playback', exact: true }).click();
  await playing(page, position + 0.2);
});

test('a Room transport failure leaves the current solo decoder usable', async ({ page }) => {
  const probe = await managedHandoff(page);
  const position = await time(page);
  probe.failRoom();
  probe.release();
  await expect(page.getByTestId('room-preparation')).toHaveText('cancelled-or-failed');
  await playing(page, position + 0.2);
  await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '1');
  await expect(page.getByTestId('state')).toHaveAttribute('data-failure', '');
});

test('an authoritative access denial during Room preparation retires the solo decoder too', async ({ page }) => {
  const probe = await managedSolo(page);
  probe.setFreeAccess(false);
  await page.getByRole('button', { name: 'Prepare current for room', exact: true }).click();
  await expect(page.getByTestId('room-preparation')).toHaveText('cancelled-or-failed');
  await expect(page.getByTestId('state')).toHaveAttribute('data-access', 'false');
  await expect(audio(page)).toHaveJSProperty('paused', true);
  await expect(audio(page)).not.toHaveAttribute('src', /blob:/);
});
